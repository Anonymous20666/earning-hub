import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { openDatabase } from "../backend/database";
import {
  recordProviderPairing,
  syncProviderInventory,
  recordVerifiedGroupPermission,
} from "../backend/inventory";
import {
  recordVerifiedFunding,
  createHouseCampaign,
  fundHouseCampaign,
  reserveNextDelivery,
  reconcileTreasury,
  type ConfirmedReceipt,
} from "../backend/earning";
import {
  createDispatchQueue,
  createDispatchWorker,
  publishDispatchOutbox,
  processReservedDelivery,
  type DeliveryProvider,
} from "../backend/dispatch";
const group = {
  jid: "120363000000000041@g.us",
  subject: "SYNTHETIC queue group",
  memberCount: 256,
  announce: false,
  userIsAdmin: false,
};
class SyntheticProvider implements DeliveryProvider {
  readonly name = "SYNTHETIC TEST ONLY — NOT WHATSAPP";
  sends = 0;
  online = true;
  outcome: "ACCEPTED" | "REJECTED_BEFORE_ACCEPTANCE" | "TIMEOUT" = "ACCEPTED";
  fresh = { ...group };
  callback: ((r: ConfirmedReceipt) => Promise<boolean>) | null = null;
  lastMessage: any;
  async ready() {
    return this.online;
  }
  async refreshGroup() {
    return this.fresh;
  }
  async prepareMessageId() {
    return "synthetic-provider-" + randomUUID();
  }
  async send(input: any) {
    this.sends++;
    this.lastMessage = input;
    if (this.outcome === "TIMEOUT")
      throw Error("SYNTHETIC simulated transport uncertainty");
    return { status: this.outcome };
  }
  subscribeConfirmedReceipts(
    callback: (r: ConfirmedReceipt) => Promise<boolean>,
  ) {
    this.callback = callback;
    return () => {
      this.callback = null;
    };
  }
  async close() {}
}
function fixture() {
  const db = openDatabase(":memory:");
  const date = new Date().toISOString();
  for (const [id, role] of [
    ["admin", "ADMIN"],
    ["worker", "EARNER"],
  ])
    db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?)").run(
      id,
      id + "@example.test",
      id,
      "synthetic",
      role,
      0,
      date,
    );
  db.prepare("INSERT INTO wallets(user_id) VALUES('worker')").run();
  db.prepare("UPDATE broadcast_settings SET dispatch_enabled=1").run();
  const a = recordProviderPairing(db, {
    userId: "worker",
    slot: 1,
    providerJid: "2348000000041@s.whatsapp.net",
    hashKey: "synthetic-dispatch-provider-hmac-key-32-plus",
  });
  syncProviderInventory(db, a.id, [group], true);
  recordVerifiedGroupPermission(db, {
    groupJid: group.jid,
    approverHash: "c".repeat(64),
    consentReference: "SYNTHETIC verified consent fixture",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  recordVerifiedFunding(db, {
    adminId: "admin",
    amountMilli: 1000000,
    source: "OWNER_CAPITAL",
    reference: "synthetic-queue-ref-001",
    evidenceNote: "SYNTHETIC funding for isolated queue tests, not real money.",
  });
  const c = createHouseCampaign(db, {
    adminId: "admin",
    title: "Synthetic queue campaign",
    message: "Synthetic test content, never sent to real users.",
    targetUrl: "https://example.test",
    rewardBudgetMilli: 1000,
  });
  fundHouseCampaign(db, c.id, "admin");
  const j = reserveNextDelivery(db, c.id).job!;
  return { db, j, provider: new SyntheticProvider() };
}
test("outbound server acceptance never credits earned wallet; replay cannot send again", async () => {
  const f = fixture();
  try {
    assert.equal(
      (await processReservedDelivery(f.db, f.j.id, f.provider)).status,
      "AWAITING_DELIVERY_CONFIRMATION",
    );
    assert.equal(
      (f.db.prepare("SELECT earned_milli FROM wallets").get() as any)
        .earned_milli,
      0,
    );
    assert.equal(
      (await processReservedDelivery(f.db, f.j.id, f.provider)).status,
      "UNKNOWN",
    );
    assert.equal(f.provider.sends, 1);
    assert.equal(reconcileTreasury(f.db).ok, true);
  } finally {
    f.db.close();
  }
});
test("uncertain transport outcomes hold cash and are never automatically resent", async () => {
  const f = fixture();
  try {
    f.provider.outcome = "TIMEOUT";
    assert.equal(
      (await processReservedDelivery(f.db, f.j.id, f.provider)).status,
      "UNKNOWN",
    );
    await processReservedDelivery(f.db, f.j.id, f.provider);
    assert.equal(f.provider.sends, 1);
    assert.equal(
      (f.db.prepare("SELECT allocated_milli FROM house_campaigns").get() as any)
        .allocated_milli,
      256,
    );
    assert.equal(reconcileTreasury(f.db).ok, true);
  } finally {
    f.db.close();
  }
});
test("fresh membership mismatch cancels the unsent job without posting or underpaying", async () => {
  const f = fixture();
  try {
    f.provider.fresh.memberCount = 290;
    assert.equal(
      (await processReservedDelivery(f.db, f.j.id, f.provider)).status,
      "FAILED",
    );
    assert.equal(f.provider.sends, 0);
    assert.equal(reconcileTreasury(f.db).ok, true);
  } finally {
    f.db.close();
  }
});
test("explicit provider rejection returns reserved rewards without creating earnings", async () => {
  const f = fixture();
  try {
    f.provider.outcome = "REJECTED_BEFORE_ACCEPTANCE";
    assert.equal(
      (await processReservedDelivery(f.db, f.j.id, f.provider)).status,
      "FAILED",
    );
    assert.equal(
      (f.db.prepare("SELECT remaining_milli FROM house_campaigns").get() as any)
        .remaining_milli,
      1000,
    );
    assert.equal(reconcileTreasury(f.db).ok, true);
  } finally {
    f.db.close();
  }
});
test("unready provider does not begin sending or consume an unsent reservation", async () => {
  const f = fixture();
  try {
    f.provider.online = false;
    await assert.rejects(
      () => processReservedDelivery(f.db, f.j.id, f.provider),
      /not ready/,
    );
    assert.equal(f.provider.sends, 0);
    assert.equal(
      (f.db.prepare("SELECT status FROM delivery_jobs").get() as any).status,
      "RESERVED",
    );
  } finally {
    f.db.close();
  }
});
const redisUrl = process.env.TEST_REDIS_URL;
test(
  "real Redis/BullMQ outbox replay, worker processing and confirmed-receipt settlement",
  { skip: !redisUrl },
  async () => {
    assert.match(
      redisUrl!,
      /^redis:\/\/127\.0\.0\.1:1\d{4}\/?$/,
      "Only a dedicated local high-port test Redis is accepted",
    );
    const f = fixture(),
      name = "synthetic-pappy-" + randomUUID(),
      q = createDispatchQueue(redisUrl!, name);
    let consumer: ReturnType<typeof createDispatchWorker> | undefined;
    try {
      await q.queue.waitUntilReady();
      assert.equal(await publishDispatchOutbox(f.db, q.queue), 1);
      assert.equal(await publishDispatchOutbox(f.db, q.queue), 0);
      f.db.prepare("UPDATE dispatch_outbox SET enqueued_at=NULL").run();
      assert.equal(await publishDispatchOutbox(f.db, q.queue), 1);
      assert.equal(await q.queue.getWaitingCount(), 1);
      consumer = createDispatchWorker(f.db, redisUrl!, f.provider, name);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              Error("Isolated queue worker did not complete in 6 seconds"),
            ),
          6000,
        );
        consumer!.worker.once("completed", () => {
          clearTimeout(timer);
          resolve();
        });
        consumer!.worker.once("failed", (_job, error) => {
          clearTimeout(timer);
          reject(error);
        });
      });
      assert.equal(f.provider.sends, 1);
      assert.equal(
        (f.db.prepare("SELECT earned_milli FROM wallets").get() as any)
          .earned_milli,
        0,
      );
      const proof = {
        jobId: f.j.id,
        groupJid: group.jid,
        messageId: f.provider.lastMessage.messageId,
        receiptId: "synthetic-receipt-" + f.j.id,
        status: "DELIVERY_CONFIRMED" as const,
      };
      assert.equal(
        await f.provider.callback!({ ...proof, messageId: "wrong-id" }),
        false,
      );
      assert.equal(await f.provider.callback!(proof), true);
      assert.equal(await f.provider.callback!(proof), true);
      assert.equal(
        (f.db.prepare("SELECT earned_milli FROM wallets").get() as any)
          .earned_milli,
        256,
      );
      assert.equal(reconcileTreasury(f.db).ok, true);
    } finally {
      if (consumer) await consumer.close();
      await q.queue.obliterate({ force: true });
      await q.queue.close();
      await q.connection.quit();
      f.db.close();
    }
  },
);
