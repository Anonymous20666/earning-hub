import { randomBytes, randomUUID } from "node:crypto";
import { type Database, transaction } from "./database";
import {
  EARNING_RULES,
  inventorySummary,
  sessionTier,
  type GroupSnapshot,
} from "../shared/earningRules";
const now = () => new Date().toISOString();
const one = (db: Database, sql: string, ...args: any[]): any =>
  db.prepare(sql).get(...args);
const all = (db: Database, sql: string, ...args: any[]): any[] =>
  db.prepare(sql).all(...args) as any[];
function requireAdmin(db: Database, id: string) {
  if (one(db, "SELECT role FROM users WHERE id=?", id)?.role !== "ADMIN")
    throw Error("Administrator required");
}
function positiveMilli(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 999999999999)
    throw Error("Invalid integer milliCoin amount");
}
function event(
  db: Database,
  kind: string,
  reference: string,
  amount: number,
  actor: string | null,
  detail: unknown,
) {
  db.prepare("INSERT INTO money_events VALUES(?,?,?,?,?,?,?)").run(
    randomUUID(),
    kind,
    reference,
    amount,
    actor,
    JSON.stringify(detail),
    now(),
  );
}
function move(
  db: Database,
  available: number,
  reserved: number,
  payable: number,
  bonus: number,
  cash = 0,
) {
  db.prepare(
    "UPDATE treasury SET cash_milli=cash_milli+?,available_milli=available_milli+?,reserved_milli=reserved_milli+?,payable_milli=payable_milli+?,bonus_backing_milli=bonus_backing_milli+? WHERE id=1",
  ).run(cash, available, reserved, payable, bonus);
}
export function referralCode(db: Database, userId: string) {
  const user = one(db, "SELECT role FROM users WHERE id=?", userId);
  if (user?.role !== "EARNER") throw Error("Worker account required");
  db.prepare("INSERT OR IGNORE INTO referral_codes VALUES(?,?,?)").run(
    userId,
    randomBytes(10).toString("hex"),
    now(),
  );
  return one(db, "SELECT code FROM referral_codes WHERE user_id=?", userId)
    .code as string;
}
// Called within the registration transaction. Pending rewards are conditional, NOT earned funds.
export function registerReferral(
  db: Database,
  referredId: string,
  code: unknown,
) {
  referralCode(db, referredId);
  if (code === undefined || code === "") return;
  if (typeof code !== "string" || !/^[a-f0-9]{20}$/.test(code))
    throw Error("Invalid referral code");
  const ref = one(db, "SELECT user_id FROM referral_codes WHERE code=?", code);
  if (!ref || ref.user_id === referredId)
    throw Error("Referral code not found");
  db.prepare(
    "INSERT INTO referrals(id,referrer_id,referred_id,created_at) VALUES(?,?,?,?)",
  ).run(randomUUID(), ref.user_id, referredId, now());
}
export function referralSummary(db: Database, userId: string) {
  const counts = one(
    db,
    `SELECT COUNT(*) total, COALESCE(SUM(CASE WHEN status IN('PENDING','RESERVED') THEN reward_milli ELSE 0 END),0) pending_milli,
 COALESCE(SUM(CASE WHEN status='EARNED' THEN reward_milli ELSE 0 END),0) earned_milli FROM referrals WHERE referrer_id=?`,
    userId,
  );
  return {
    code: referralCode(db, userId),
    ...counts,
    referrals: all(
      db,
      "SELECT id,status,reward_milli,created_at,earned_at FROM referrals WHERE referrer_id=? ORDER BY created_at DESC LIMIT 100",
      userId,
    ),
  };
}
export function groupsForUser(db: Database, userId: string): GroupSnapshot[] {
  return all(
    db,
    `SELECT g.*,a.status account_status,p.expires_at,p.revoked_at FROM group_inventory g
 JOIN paired_accounts a ON a.id=g.account_id LEFT JOIN group_permissions p ON p.group_jid=g.group_jid WHERE a.user_id=? ORDER BY a.slot,g.subject,g.group_jid`,
    userId,
  ).map((g) => ({
    accountId: g.account_id,
    groupJid: g.group_jid,
    subject: g.subject,
    memberCount: g.member_count,
    announce: !!g.announce,
    userIsAdmin: !!g.user_is_admin,
    isMember: !!g.is_member,
    excluded: !!g.excluded,
    online: g.account_status === "ONLINE",
    approved: !!g.expires_at && g.expires_at > now() && !g.revoked_at,
  }));
}
export function earningWorkspace(db: Database, userId: string) {
  const groups = groupsForUser(db, userId),
    summary = inventorySummary(groups);
  return {
    summary,
    tier: sessionTier(summary.uniqueQualified),
    groups,
    accounts: all(
      db,
      "SELECT id,slot,phone_label,status,last_broadcast_at,connected_at,scanner_at FROM paired_accounts WHERE user_id=? ORDER BY slot",
      userId,
    ),
    referrals: referralSummary(db, userId),
    rules: EARNING_RULES,
    today: one(
      db,
      "SELECT COUNT(*) count FROM campaign_participation WHERE user_id=? AND day_utc=?",
      userId,
      now().slice(0, 10),
    ).count,
    deliveries: all(
      db,
      `SELECT j.id,j.campaign_id,c.title,j.status,j.reward_milli,j.reserved_at,j.settled_at FROM delivery_jobs j JOIN house_campaigns c ON c.id=j.campaign_id WHERE j.user_id=? ORDER BY j.reserved_at DESC LIMIT 100`,
      userId,
    ),
    providerConfigured: false,
    dispatchEnabled: !!one(
      db,
      "SELECT dispatch_enabled FROM broadcast_settings WHERE id=1",
    ).dispatch_enabled,
  };
}
// Records cleared, independently checked funds only. No public HTTP deposit/credit endpoint.
export function recordVerifiedFunding(
  db: Database,
  input: {
    adminId: string;
    amountMilli: number;
    source: "BANK_TRANSFER" | "OWNER_CAPITAL" | "SETTLED_REVENUE";
    reference: string;
    evidenceNote: string;
  },
) {
  return transaction(db, () => {
    requireAdmin(db, input.adminId);
    positiveMilli(input.amountMilli);
    if (
      !["BANK_TRANSFER", "OWNER_CAPITAL", "SETTLED_REVENUE"].includes(
        input.source,
      ) ||
      typeof input.reference !== "string" ||
      input.reference.trim().length < 6 ||
      input.reference.length > 160 ||
      typeof input.evidenceNote !== "string" ||
      input.evidenceNote.trim().length < 20 ||
      input.evidenceNote.length > 2000
    )
      throw Error(
        "Cleared-funds reference and verification evidence are required",
      );
    if (input.reference !== input.reference.trim())
      throw Error(
        "Funding reference must not contain leading or trailing spaces",
      );
    if (
      one(
        db,
        "SELECT id FROM funding_receipts WHERE source_reference=?",
        input.reference,
      )
    )
      throw Error("Funding reference already recorded");
    const id = randomUUID();
    db.prepare("INSERT INTO funding_receipts VALUES(?,?,?,?,?,?,?)").run(
      id,
      input.reference,
      input.amountMilli,
      input.source,
      input.evidenceNote,
      input.adminId,
      now(),
    );
    move(db, input.amountMilli, 0, 0, 0, input.amountMilli);
    event(
      db,
      "CLEARED_FUNDING",
      `funding:${input.reference}`,
      input.amountMilli,
      input.adminId,
      { receiptId: id, source: input.source },
    );
    return { id };
  });
}
export function createHouseCampaign(
  db: Database,
  input: {
    adminId: string;
    title: string;
    message: string;
    targetUrl: string;
    rewardBudgetMilli: number;
  },
) {
  requireAdmin(db, input.adminId);
  positiveMilli(input.rewardBudgetMilli);
  if (
    typeof input.title !== "string" ||
    input.title.trim().length < 3 ||
    input.title.length > 120 ||
    typeof input.message !== "string" ||
    input.message.trim().length < 10 ||
    input.message.length > 2000
  )
    throw Error("Enter a title (3–120) and message (10–2,000 characters)");
  let url: URL;
  try {
    url = new URL(input.targetUrl);
  } catch {
    throw Error("A valid HTTPS destination is required");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.href.length > 1000
  )
    throw Error("A valid HTTPS destination is required");
  const id = randomUUID();
  db.prepare(
    "INSERT INTO house_campaigns(id,title,message,target_url,reward_budget_milli,created_by,created_at) VALUES(?,?,?,?,?,?,?)",
  ).run(
    id,
    input.title.trim(),
    input.message.trim(),
    url.href,
    input.rewardBudgetMilli,
    input.adminId,
    now(),
  );
  return { id };
}
export function fundHouseCampaign(
  db: Database,
  campaignId: string,
  adminId: string,
) {
  return transaction(db, () => {
    requireAdmin(db, adminId);
    const c = one(db, "SELECT * FROM house_campaigns WHERE id=?", campaignId);
    if (!reconcileTreasury(db).ok)
      throw Error(
        "Treasury reconciliation required before reserving new campaigns",
      );
    if (!c || c.status !== "DRAFT")
      throw Error("Only an unfunded draft may be funded");
    const t = one(db, "SELECT * FROM treasury WHERE id=1");
    if (t.available_milli < c.reward_budget_milli)
      throw Error(
        "Insufficient verified available cash. Expected revenue is not funding.",
      );
    move(db, -c.reward_budget_milli, c.reward_budget_milli, 0, 0);
    db.prepare(
      "UPDATE house_campaigns SET status='FUNDED',remaining_milli=? WHERE id=?",
    ).run(c.reward_budget_milli, c.id);
    event(
      db,
      "CAMPAIGN_RESERVED",
      `campaign:${c.id}`,
      c.reward_budget_milli,
      adminId,
      {},
    );
  });
}
export function closeHouseCampaign(
  db: Database,
  campaignId: string,
  adminId: string,
) {
  return transaction(db, () => {
    requireAdmin(db, adminId);
    const c = one(db, "SELECT * FROM house_campaigns WHERE id=?", campaignId);
    if (!c || ["COMPLETED", "CANCELLED"].includes(c.status))
      throw Error("Campaign is already closed or not found");
    if (c.allocated_milli > 0)
      throw Error(
        "Unresolved deliveries still hold funds; reconcile them before closing",
      );
    move(db, c.remaining_milli, -c.remaining_milli, 0, 0);
    db.prepare(
      "UPDATE house_campaigns SET status='CANCELLED',remaining_milli=0 WHERE id=?",
    ).run(c.id);
    event(
      db,
      "CAMPAIGN_RELEASED",
      `close:${c.id}`,
      c.remaining_milli,
      adminId,
      {},
    );
  });
}
function ensureBonusBacking(db: Database, userId: string) {
  const w = one(db, "SELECT * FROM wallets WHERE user_id=?", userId);
  if (!w) throw Error("Worker wallet not found");
  if (w.bonus_claimed) return;
  const needed = Math.max(0, w.locked_milli - w.bonus_backed_milli);
  if (!needed) return;
  if (
    one(db, "SELECT available_milli FROM treasury WHERE id=1").available_milli <
    needed
  )
    throw Error("Insufficient cash to back the conditional welcome bonus");
  move(db, -needed, 0, 0, needed);
  db.prepare(
    "UPDATE wallets SET bonus_backed_milli=bonus_backed_milli+? WHERE user_id=?",
  ).run(needed, userId);
  event(db, "BONUS_BACKED", `bonus:${userId}`, needed, null, { userId });
}
// Fair owner/account selection. Group consent and fresh scan must be rechecked before actual sending.
export function reserveNextDelivery(db: Database, campaignId: string) {
  return transaction(db, () => {
    if (
      !one(db, "SELECT dispatch_enabled FROM broadcast_settings WHERE id=1")
        .dispatch_enabled
    )
      throw Error("Dispatch is disabled");
    if (!reconcileTreasury(db).ok)
      throw Error("Treasury reconciliation required");
    const c = one(
      db,
      "SELECT * FROM house_campaigns WHERE id=? AND status IN ('FUNDED','RUNNING')",
      campaignId,
    );
    if (!c) throw Error("Funded active campaign required");
    const date = now(),
      day = date.slice(0, 10),
      fresh = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const candidates = all(
      db,
      `SELECT g.*,a.user_id,a.last_broadcast_at FROM group_inventory g JOIN paired_accounts a ON a.id=g.account_id
 JOIN group_permissions p ON p.group_jid=g.group_jid WHERE a.status='ONLINE' AND g.is_member=1 AND g.excluded=0
 AND g.member_count>=100 AND (g.announce=0 OR g.user_is_admin=1) AND g.synced_at>=?
 AND p.revoked_at IS NULL AND p.expires_at>? AND NOT EXISTS(SELECT 1 FROM delivery_jobs j WHERE j.campaign_id=? AND j.group_jid=g.group_jid)
 AND (EXISTS(SELECT 1 FROM campaign_participation cp WHERE cp.campaign_id=? AND cp.user_id=a.user_id)
 OR (SELECT COUNT(*) FROM campaign_participation cp WHERE cp.user_id=a.user_id AND cp.day_utc=?)<(SELECT daily_limit FROM broadcast_settings WHERE id=1))
 ORDER BY a.last_broadcast_at ASC,a.last_selected_at ASC,a.connected_at ASC,a.id ASC,g.group_jid ASC`,
      fresh,
      date,
      c.id,
      c.id,
      day,
    );
    let g: any = null;
    let lastReason = "No eligible consent-approved groups with a fresh scan";
    for (const candidate of candidates) {
      const reward = Math.min(candidate.member_count, 1000);
      if (reward > c.remaining_milli) {
        lastReason =
          "Campaign reward budget exhausted or below the next full group reward";
        continue;
      }
      const w = one(
        db,
        "SELECT * FROM wallets WHERE user_id=?",
        candidate.user_id,
      );
      let sideCost =
        w && !w.bonus_claimed
          ? Math.max(0, w.locked_milli - w.bonus_backed_milli)
          : 0;
      const ref = one(
        db,
        "SELECT * FROM referrals WHERE referred_id=? AND status='PENDING'",
        candidate.user_id,
      );
      if (ref) {
        sideCost += ref.reward_milli;
        const rw = one(
          db,
          "SELECT * FROM wallets WHERE user_id=?",
          ref.referrer_id,
        );
        if (rw && !rw.bonus_claimed)
          sideCost += Math.max(0, rw.locked_milli - rw.bonus_backed_milli);
      }
      if (
        one(db, "SELECT available_milli FROM treasury WHERE id=1")
          .available_milli < sideCost
      ) {
        lastReason =
          "Additional cash is required for bonus backing and any referral reward";
        continue;
      }
      g = candidate;
      break;
    }
    if (!g) return { job: null, reason: lastReason };
    const id = randomUUID(),
      reward = Math.min(g.member_count, 1000);
    ensureBonusBacking(db, g.user_id);
    const ref = one(
      db,
      "SELECT * FROM referrals WHERE referred_id=? AND status='PENDING'",
      g.user_id,
    );
    if (ref) {
      ensureBonusBacking(db, ref.referrer_id);
      move(db, -ref.reward_milli, ref.reward_milli, 0, 0);
      db.prepare(
        "UPDATE referrals SET status='RESERVED',reserved_job_id=? WHERE id=? AND status='PENDING'",
      ).run(id, ref.id);
    }
    db.prepare(
      "INSERT INTO delivery_jobs(id,campaign_id,group_jid,account_id,user_id,reward_milli,member_snapshot,status,referral_id,reserved_at) VALUES(?,?,?,?,?,?,?,'RESERVED',?,?)",
    ).run(
      id,
      c.id,
      g.group_jid,
      g.account_id,
      g.user_id,
      reward,
      g.member_count,
      ref?.id || null,
      date,
    );
    db.prepare(
      "UPDATE house_campaigns SET remaining_milli=remaining_milli-?,allocated_milli=allocated_milli+?,status='RUNNING' WHERE id=?",
    ).run(reward, reward, c.id);
    db.prepare(
      "INSERT OR IGNORE INTO campaign_participation VALUES(?,?,?)",
    ).run(c.id, g.user_id, day);
    db.prepare("UPDATE paired_accounts SET last_selected_at=? WHERE id=?").run(
      date,
      g.account_id,
    );
    db.prepare(
      "INSERT INTO dispatch_outbox(job_id,created_at) VALUES(?,?)",
    ).run(id, date);
    event(db, "DELIVERY_RESERVED", `reserve:${id}`, reward, null, {
      campaignId: c.id,
      referralMilli: ref?.reward_milli || 0,
    });
    return {
      job: one(db, "SELECT * FROM delivery_jobs WHERE id=?", id),
      reason: null,
    };
  });
}
export function markSending(db: Database, jobId: string, messageId: string) {
  return transaction(db, () => {
    if (
      typeof messageId !== "string" ||
      messageId.length < 5 ||
      messageId.length > 250
    )
      throw Error("Provider-generated message ID is required");
    const job = one(
      db,
      "SELECT * FROM delivery_jobs WHERE id=? AND status='RESERVED'",
      jobId,
    );
    if (!job) throw Error("Job is not reserved; never blindly resend");
    if (
      !one(db, "SELECT dispatch_enabled FROM broadcast_settings WHERE id=1")
        .dispatch_enabled
    )
      throw Error("Dispatch is disabled");
    const campaign = one(
      db,
      "SELECT status FROM house_campaigns WHERE id=?",
      job.campaign_id,
    );
    if (!["FUNDED", "RUNNING"].includes(campaign.status))
      throw Error("Campaign is paused or closed");
    const group = one(
      db,
      `SELECT g.*,a.status,p.expires_at,p.revoked_at FROM group_inventory g JOIN paired_accounts a ON a.id=g.account_id LEFT JOIN group_permissions p ON p.group_jid=g.group_jid WHERE g.account_id=? AND g.group_jid=?`,
      job.account_id,
      job.group_jid,
    );
    if (
      !group ||
      group.status !== "ONLINE" ||
      !group.is_member ||
      group.excluded ||
      group.member_count < 100 ||
      (group.announce && !group.user_is_admin) ||
      !group.expires_at ||
      group.expires_at <= now() ||
      group.revoked_at ||
      group.synced_at < new Date(Date.now() - 15 * 60 * 1000).toISOString()
    )
      throw Error("Group eligibility or permission must be revalidated");
    // Do not silently underpay for changed membership. Cancel/replan before sending.
    if (group.member_count !== job.member_snapshot)
      throw Error(
        "Membership changed; cancel this unsent job and create a fresh authorised campaign plan",
      );
    db.prepare(
      "UPDATE delivery_jobs SET status='SENDING',provider_message_id=?,sent_at=? WHERE id=?",
    ).run(messageId, now(), jobId);
  });
}
export function markDeliveryUnknown(
  db: Database,
  jobId: string,
  reason: string,
) {
  db.prepare(
    "UPDATE delivery_jobs SET status='UNKNOWN',failure_reason=? WHERE id=? AND status='SENDING'",
  ).run(reason.slice(0, 300), jobId);
}
export function failUnsentDelivery(
  db: Database,
  jobId: string,
  proof: "CANCELLED_BEFORE_SEND" | "PROVIDER_REJECTED_BEFORE_ACCEPTANCE",
) {
  return transaction(db, () => {
    const j = one(db, "SELECT * FROM delivery_jobs WHERE id=?", jobId);
    if (!j) throw Error("Delivery not found");
    if (j.status === "FAILED") return { idempotent: true };
    if (
      !(
        (proof === "CANCELLED_BEFORE_SEND" && j.status === "RESERVED") ||
        (proof === "PROVIDER_REJECTED_BEFORE_ACCEPTANCE" &&
          j.status === "SENDING")
      )
    )
      throw Error(
        "Cannot release funds without evidence that no message was sent",
      );
    db.prepare(
      "UPDATE delivery_jobs SET status='FAILED',failure_reason=?,settled_at=? WHERE id=?",
    ).run(proof, now(), j.id);
    db.prepare(
      "UPDATE house_campaigns SET remaining_milli=remaining_milli+?,allocated_milli=allocated_milli-? WHERE id=?",
    ).run(j.reward_milli, j.reward_milli, j.campaign_id);
    const reservedRef = one(
      db,
      "SELECT * FROM referrals WHERE referred_id=? AND status='RESERVED' AND reserved_job_id=?",
      j.user_id,
      j.id,
    );
    if (reservedRef) {
      const next = one(
        db,
        "SELECT id FROM delivery_jobs WHERE user_id=? AND status IN('RESERVED','SENDING','UNKNOWN') ORDER BY reserved_at,id LIMIT 1",
        j.user_id,
      );
      if (next)
        db.prepare("UPDATE referrals SET reserved_job_id=? WHERE id=?").run(
          next.id,
          reservedRef.id,
        );
      else {
        move(db, reservedRef.reward_milli, -reservedRef.reward_milli, 0, 0);
        db.prepare(
          "UPDATE referrals SET status='PENDING',reserved_job_id=NULL WHERE id=?",
        ).run(reservedRef.id);
      }
    }
    event(db, "UNSENT_RELEASED", `fail:${j.id}`, j.reward_milli, null, {
      proof,
    });
    return { idempotent: false };
  });
}
export type ConfirmedReceipt = {
  jobId: string;
  groupJid: string;
  messageId: string;
  receiptId: string;
  status: "DELIVERY_CONFIRMED";
};
// INTERNAL TRUST BOUNDARY: only a verified provider adapter may call this. Never expose client acknowledgement as delivery proof.
export function settleConfirmedDelivery(db: Database, r: ConfirmedReceipt) {
  return transaction(db, () => {
    if (
      r.status !== "DELIVERY_CONFIRMED" ||
      typeof r.receiptId !== "string" ||
      r.receiptId.length < 5 ||
      r.receiptId.length > 250
    )
      throw Error("Verified provider delivery receipt required");
    const j = one(db, "SELECT * FROM delivery_jobs WHERE id=?", r.jobId);
    if (
      !j ||
      j.group_jid !== r.groupJid ||
      j.provider_message_id !== r.messageId
    )
      throw Error("Receipt does not match reserved delivery");
    if (j.status === "DELIVERED") return { idempotent: true };
    if (!["SENDING", "UNKNOWN"].includes(j.status))
      throw Error("Delivery is not awaiting confirmation");
    move(db, 0, -j.reward_milli, j.reward_milli, 0);
    db.prepare(
      "UPDATE wallets SET earned_milli=earned_milli+? WHERE user_id=?",
    ).run(j.reward_milli, j.user_id);
    db.prepare("INSERT INTO ledger VALUES(?,?,?,?,?,?)").run(
      randomUUID(),
      j.user_id,
      "VERIFIED_GROUP_DELIVERY",
      j.reward_milli,
      `delivery:${j.id}`,
      now(),
    );
    db.prepare(
      "UPDATE delivery_jobs SET status='DELIVERED',provider_receipt_id=?,settled_at=?,failure_reason=NULL WHERE id=?",
    ).run(r.receiptId, now(), j.id);
    db.prepare(
      "UPDATE house_campaigns SET paid_milli=paid_milli+?,allocated_milli=allocated_milli-? WHERE id=?",
    ).run(j.reward_milli, j.reward_milli, j.campaign_id);
    const ref = one(
      db,
      "SELECT * FROM referrals WHERE referred_id=? AND status='RESERVED'",
      j.user_id,
    );
    if (ref) {
      move(db, 0, -ref.reward_milli, ref.reward_milli, 0);
      db.prepare(
        "UPDATE wallets SET earned_milli=earned_milli+? WHERE user_id=?",
      ).run(ref.reward_milli, ref.referrer_id);
      db.prepare("INSERT INTO ledger VALUES(?,?,?,?,?,?)").run(
        randomUUID(),
        ref.referrer_id,
        "QUALIFIED_REFERRAL",
        ref.reward_milli,
        `referral:${ref.id}`,
        now(),
      );
      db.prepare(
        "UPDATE referrals SET status='EARNED',earned_at=? WHERE id=?",
      ).run(now(), ref.id);
    }
    db.prepare("UPDATE paired_accounts SET last_broadcast_at=? WHERE id=?").run(
      j.sent_at || now(),
      j.account_id,
    );
    event(db, "DELIVERY_SETTLED", `settle:${j.id}`, j.reward_milli, null, {
      providerReceiptId: r.receiptId,
    });
    return { idempotent: false };
  });
}
export function reconcileTreasury(db: Database): {
  ok: boolean;
  checks: Record<string, boolean>;
  treasury: any;
  expected: { payableMilli: number; bonusMilli: number; reservedMilli: number };
} {
  if (!db.isTransaction) return transaction(db, () => reconcileTreasury(db));
  const t = one(db, "SELECT * FROM treasury WHERE id=1");
  const expectedPayable = one(
    db,
    "SELECT COALESCE(SUM(earned_milli),0) total FROM wallets",
  ).total;
  const expectedBonus = one(
    db,
    "SELECT COALESCE(SUM(bonus_backed_milli),0) total FROM wallets",
  ).total;
  const campaigns = one(
    db,
    "SELECT COALESCE(SUM(remaining_milli+allocated_milli),0) total FROM house_campaigns",
  ).total;
  const referrals = one(
    db,
    "SELECT COALESCE(SUM(reward_milli),0) total FROM referrals WHERE status='RESERVED'",
  ).total;
  const receipts = one(
    db,
    "SELECT COALESCE(SUM(amount_milli),0) total FROM funding_receipts",
  ).total;
  const expectedReserved = campaigns + referrals;
  const checks = {
    cashConserved:
      t.cash_milli ===
      t.available_milli +
        t.reserved_milli +
        t.payable_milli +
        t.bonus_backing_milli,
    payableMatchesWallets: t.payable_milli === expectedPayable,
    bonusMatchesWallets: t.bonus_backing_milli === expectedBonus,
    reservationsMatch: t.reserved_milli === expectedReserved,
    cashMatchesReceipts: t.cash_milli === receipts,
    walletsMatchEarnedLedger: !one(
      db,
      `SELECT w.user_id FROM wallets w WHERE w.earned_milli<>
      (SELECT COALESCE(SUM(l.amount_milli),0) FROM ledger l WHERE l.user_id=w.user_id AND l.kind IN('VERIFIED_GROUP_DELIVERY','QUALIFIED_REFERRAL')) LIMIT 1`,
    ),
    campaignAllocationsMatchJobs: !one(
      db,
      `SELECT c.id FROM house_campaigns c WHERE c.allocated_milli<>
      (SELECT COALESCE(SUM(j.reward_milli),0) FROM delivery_jobs j WHERE j.campaign_id=c.id AND j.status IN('RESERVED','SENDING','UNKNOWN'))
      OR c.paid_milli<>(SELECT COALESCE(SUM(j.reward_milli),0) FROM delivery_jobs j WHERE j.campaign_id=c.id AND j.status='DELIVERED') LIMIT 1`,
    ),
    deliveriesMatchCredits: !one(
      db,
      `SELECT j.id FROM delivery_jobs j WHERE j.status='DELIVERED' AND NOT EXISTS
      (SELECT 1 FROM ledger l WHERE l.idempotency_key='delivery:'||j.id AND l.kind='VERIFIED_GROUP_DELIVERY' AND l.user_id=j.user_id AND l.amount_milli=j.reward_milli) LIMIT 1`,
    ),
    referralsMatchCredits: !one(
      db,
      `SELECT r.id FROM referrals r WHERE r.status='EARNED' AND NOT EXISTS
      (SELECT 1 FROM ledger l WHERE l.idempotency_key='referral:'||r.id AND l.kind='QUALIFIED_REFERRAL' AND l.user_id=r.referrer_id AND l.amount_milli=r.reward_milli) LIMIT 1`,
    ),
  };
  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    treasury: t,
    expected: {
      payableMilli: expectedPayable,
      bonusMilli: expectedBonus,
      reservedMilli: expectedReserved,
    },
  };
}
export function treasuryOverview(db: Database) {
  return {
    ...reconcileTreasury(db),
    funding: all(
      db,
      "SELECT id,source_reference,amount_milli,source,created_at FROM funding_receipts ORDER BY created_at DESC LIMIT 100",
    ),
    campaigns: all(
      db,
      "SELECT * FROM house_campaigns ORDER BY created_at DESC LIMIT 100",
    ),
    unresolved: all(
      db,
      "SELECT id,campaign_id,status,reward_milli,sent_at FROM delivery_jobs WHERE status IN('SENDING','UNKNOWN') ORDER BY reserved_at LIMIT 100",
    ),
    settings: one(db, "SELECT * FROM broadcast_settings WHERE id=1"),
    providerConfigured: false,
    payoutsConfigured: false,
  };
}
