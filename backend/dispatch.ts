import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { type Database } from "./database";
import {
  markSending,
  markDeliveryUnknown,
  failUnsentDelivery,
  settleConfirmedDelivery,
  type ConfirmedReceipt,
} from "./earning";
import type { ScannedGroup } from "./inventory";
export interface DeliveryProvider {
  readonly name: string;
  ready(): Promise<boolean>;
  // Must fetch current membership/posting metadata from the real provider, not a web client.
  refreshGroup(
    accountId: string,
    groupJid: string,
  ): Promise<ScannedGroup | null>;
  prepareMessageId(accountId: string): Promise<string>;
  send(input: {
    accountId: string;
    groupJid: string;
    messageId: string;
    text: string;
  }): Promise<{
    status: "ACCEPTED" | "REJECTED_BEFORE_ACCEPTANCE";
    reason?: string;
  }>;
  // This subscription must authenticate/match provider delivery evidence; acceptance alone is insufficient.
  subscribeConfirmedReceipts(
    callback: (receipt: ConfirmedReceipt) => Promise<boolean>,
  ): () => void;
  close(): Promise<void>;
}
export function queueConnection(url: string) {
  const u = new URL(url);
  if (!["redis:", "rediss:"].includes(u.protocol))
    throw Error("A private Redis URL is required");
  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectTimeout: 5000,
  });
}
export function createDispatchQueue(
  url: string,
  name = "pappy-approved-delivery",
) {
  const connection = queueConnection(url);
  const queue = new Queue(name, {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: 86400, count: 10000 },
      removeOnFail: { count: 10000 },
    },
  });
  queue.on("error", () => {
    /* Never log connection URLs/passwords. Outbox stays authoritative. */
  });
  return { queue, connection };
}
export async function publishDispatchOutbox(db: Database, queue: Queue) {
  const rows = db
    .prepare(
      `SELECT o.job_id FROM dispatch_outbox o JOIN delivery_jobs j ON j.id=o.job_id
 WHERE o.enqueued_at IS NULL AND j.status='RESERVED' ORDER BY o.created_at,o.job_id LIMIT 100`,
    )
    .all() as any[];
  let published = 0;
  for (const row of rows) {
    const prior = await queue.getJob(row.job_id);
    if (prior && ["failed", "completed"].includes(await prior.getState()))
      await prior.remove();
    await queue.add(
      "deliver-approved-group",
      { jobId: row.job_id },
      { jobId: row.job_id },
    );
    db.prepare("UPDATE dispatch_outbox SET enqueued_at=? WHERE job_id=?").run(
      new Date().toISOString(),
      row.job_id,
    );
    published++;
  }
  return published;
}
export async function processReservedDelivery(
  db: Database,
  jobId: string,
  provider: DeliveryProvider,
) {
  const job = db
    .prepare("SELECT * FROM delivery_jobs WHERE id=?")
    .get(jobId) as any;
  if (!job) throw Error("Reserved delivery not found");
  if (job.status === "SENDING") {
    markDeliveryUnknown(
      db,
      job.id,
      "Worker recovered a send without confirmed outcome; do not retry blindly",
    );
    return { status: "UNKNOWN" };
  }
  if (job.status !== "RESERVED")
    return { status: job.status, idempotent: true };
  if (!(await provider.ready()))
    throw Error("Provider is not ready; no message sent");
  let sending = false;
  try {
    const g = await provider.refreshGroup(job.account_id, job.group_jid);
    if (g) {
      if (
        g.jid !== job.group_jid ||
        !Number.isSafeInteger(g.memberCount) ||
        g.memberCount < 0 ||
        typeof g.announce !== "boolean" ||
        typeof g.userIsAdmin !== "boolean" ||
        typeof g.subject !== "string" ||
        g.subject.length > 250
      )
        throw Error("Invalid fresh provider metadata");
      db.prepare(
        "UPDATE group_inventory SET member_count=?,announce=?,user_is_admin=?,subject=?,is_member=1,synced_at=? WHERE account_id=? AND group_jid=?",
      ).run(
        g.memberCount,
        Number(g.announce),
        Number(g.userIsAdmin),
        g.subject,
        new Date().toISOString(),
        job.account_id,
        job.group_jid,
      );
    } else
      db.prepare(
        "UPDATE group_inventory SET is_member=0 WHERE account_id=? AND group_jid=?",
      ).run(job.account_id, job.group_jid);
    const messageId = await provider.prepareMessageId(job.account_id);
    markSending(db, job.id, messageId);
    sending = true;
    const campaign = db
      .prepare("SELECT message,target_url FROM house_campaigns WHERE id=?")
      .get(job.campaign_id) as any;
    const result = await provider.send({
      accountId: job.account_id,
      groupJid: job.group_jid,
      messageId,
      text: campaign.message + "\n\n" + campaign.target_url,
    });
    if (result.status === "REJECTED_BEFORE_ACCEPTANCE") {
      failUnsentDelivery(db, job.id, "PROVIDER_REJECTED_BEFORE_ACCEPTANCE");
      return { status: "FAILED" };
    }
    if (result.status !== "ACCEPTED")
      throw Error("Provider returned an unknown sending result");
    // ACCEPTED is intentionally NOT DELIVERED, and NEVER credits a wallet.
    return { status: "AWAITING_DELIVERY_CONFIRMATION" };
  } catch (error: any) {
    if (sending) {
      markDeliveryUnknown(
        db,
        job.id,
        "Transport interrupted after send began; provider reconciliation required",
      );
      return { status: "UNKNOWN" };
    }
    const current = db
      .prepare("SELECT status FROM delivery_jobs WHERE id=?")
      .get(job.id) as any;
    if (current?.status === "RESERVED")
      failUnsentDelivery(db, job.id, "CANCELLED_BEFORE_SEND");
    return {
      status:
        current?.status === "RESERVED"
          ? "FAILED"
          : current?.status || "UNKNOWN",
      reason:
        "Pre-send validation failed; inspect provider setup and group permissions",
    };
  }
}
export function createDispatchWorker(
  db: Database,
  url: string,
  provider: DeliveryProvider,
  name = "pappy-approved-delivery",
) {
  const connection = queueConnection(url);
  const worker = new Worker(
    name,
    async (job) =>
      processReservedDelivery(db, String(job.data.jobId), provider),
    { connection, concurrency: 1, limiter: { max: 1, duration: 10000 } },
  );
  worker.on("error", () => {
    /* Operational health must not expose provider secrets. */
  });
  const unsubscribe = provider.subscribeConfirmedReceipts(async (receipt) => {
    try {
      settleConfirmedDelivery(db, receipt);
      return true;
    } catch {
      // Do not acknowledge to the adapter on failure. The adapter must retain/replay the event for reconciliation.
      return false;
    }
  });
  return {
    worker,
    connection,
    async close() {
      unsubscribe();
      await worker.close();
      await connection.quit();
      await provider.close();
    },
  };
}
