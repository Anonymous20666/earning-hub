import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../backend/database";
import {
  referralCode,
  registerReferral,
  referralSummary,
  recordVerifiedFunding,
  createHouseCampaign,
  fundHouseCampaign,
  closeHouseCampaign,
  reserveNextDelivery,
  markSending,
  markDeliveryUnknown,
  failUnsentDelivery,
  settleConfirmedDelivery,
  reconcileTreasury,
  earningWorkspace,
} from "../backend/earning";
import {
  recordProviderPairing,
  syncProviderInventory,
  recordVerifiedGroupPermission,
} from "../backend/inventory";
import {
  groupEligibility,
  inventorySummary,
  parseNgnMilli,
  sessionTier,
} from "../shared/earningRules";
const key = "isolated-synthetic-testing-key-not-production";
function user(
  db: ReturnType<typeof openDatabase>,
  id: string,
  role = "EARNER",
) {
  db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?)").run(
    id,
    id + "@example.test",
    id,
    "not-a-real-password-hash",
    role,
    0,
    new Date().toISOString(),
  );
  if (role === "EARNER")
    db.prepare("INSERT INTO wallets(user_id) VALUES(?)").run(id);
}
function fixture() {
  const db = openDatabase(":memory:");
  user(db, "admin", "ADMIN");
  user(db, "worker");
  db.prepare("UPDATE broadcast_settings SET dispatch_enabled=1").run();
  return db;
}
function funding(
  db: ReturnType<typeof openDatabase>,
  amountMilli = 1000000,
  reference = "synthetic-bank-001",
) {
  return recordVerifiedFunding(db, {
    adminId: "admin",
    amountMilli,
    reference,
    source: "OWNER_CAPITAL",
    evidenceNote:
      "SYNTHETIC TEST ONLY: cleared funds fixture, not a real bank receipt.",
  });
}
function campaign(db: ReturnType<typeof openDatabase>, budget = 10000) {
  const c = createHouseCampaign(db, {
    adminId: "admin",
    title: "Synthetic approved campaign",
    message: "Synthetic test message; never sent to WhatsApp.",
    targetUrl: "https://example.test/approved",
    rewardBudgetMilli: budget,
  });
  fundHouseCampaign(db, c.id, "admin");
  return c.id;
}
function groupJid(index: number) {
  return `${120363000000000000n + BigInt(index)}@g.us`;
}
function inventory(
  db: ReturnType<typeof openDatabase>,
  counts: number[],
  owner = "worker",
  slot: 1 | 2 = 1,
  offset = 0,
) {
  const a = recordProviderPairing(db, {
    userId: owner,
    slot,
    providerJid: `234801${owner === "worker" ? "000" : "111"}000${slot}@s.whatsapp.net`,
    hashKey: key,
  });
  syncProviderInventory(
    db,
    a.id,
    counts.map((memberCount, i) => ({
      jid: groupJid(offset + i),
      subject: "SYNTHETIC group " + i,
      memberCount,
      announce: false,
      userIsAdmin: false,
    })),
    true,
  );
  for (let i = 0; i < counts.length; i++)
    recordVerifiedGroupPermission(db, {
      groupJid: groupJid(offset + i),
      consentReference: "SYNTHETIC admin consent evidence",
      approverHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
  return a.id;
}
function reserved(db: ReturnType<typeof openDatabase>, c: string) {
  const r = reserveNextDelivery(db, c);
  assert.ok(r.job, r.reason || "job expected");
  return r.job;
}
function receipt(
  db: ReturnType<typeof openDatabase>,
  j: any,
  id = "synthetic-" + j.id,
) {
  return settleConfirmedDelivery(db, {
    jobId: j.id,
    groupJid: j.group_jid,
    messageId: id,
    receiptId: "receipt-" + j.id,
    status: "DELIVERY_CONFIRMED",
  });
}
function start(db: ReturnType<typeof openDatabase>, j: any) {
  markSending(db, j.id, "synthetic-" + j.id);
}
function reconciled(db: ReturnType<typeof openDatabase>) {
  assert.equal(
    reconcileTreasury(db).ok,
    true,
    JSON.stringify(reconcileTreasury(db)),
  );
}

test("standard rewards: exact counts, membership cap, permission and minimum", () => {
  const g = { isMember: true, announce: false, userIsAdmin: false };
  for (const [members, reward] of [
    [0, 0],
    [99, 0],
    [100, 100],
    [256, 256],
    [290, 290],
    [466, 466],
    [278, 278],
    [1000, 1000],
    [2000, 1000],
  ])
    assert.equal(
      groupEligibility({ ...g, memberCount: members }).rewardMilli,
      reward,
    );
  assert.equal(
    [256, 290, 466, 278].reduce(
      (n, m) => n + groupEligibility({ ...g, memberCount: m }).rewardMilli,
      0,
    ),
    1290,
  );
  assert.equal(
    groupEligibility({ ...g, memberCount: 100, announce: true }).qualified,
    false,
  );
  assert.equal(
    groupEligibility({
      ...g,
      memberCount: 100,
      announce: true,
      userIsAdmin: true,
    }).qualified,
    true,
  );
  assert.equal(
    groupEligibility({ ...g, memberCount: 100, isMember: false }).qualified,
    false,
  );
  assert.equal(groupEligibility({ ...g, memberCount: 100.5 }).qualified, false);
});
test("amount parsing uses integer decimals, rejects floats, exponent, negative, overflow and extra precision", () => {
  for (const [s, n] of [
    ["0.001", 1],
    ["1.29", 1290],
    ["5", 5000],
    ["500.000", 500000],
    ["999999999.999", 999999999999],
  ] as const)
    assert.equal(parseNgnMilli(s), n);
  for (const v of [
    0,
    5,
    NaN,
    "0",
    "-1",
    "1e3",
    "1.0001",
    "1.",
    " 5",
    "1000000000",
    "Infinity",
    "5,000",
  ])
    assert.throws(() => parseNgnMilli(v));
});
test("tier bands and 100-GC virtual units do not cap groups", () => {
  for (const [n, tier] of [
    [0, "UNQUALIFIED"],
    [1, "BRONZE"],
    [25, "BRONZE"],
    [26, "SILVER"],
    [99, "SILVER"],
    [100, "GOLD"],
    [299, "GOLD"],
  ] as const)
    assert.equal(sessionTier(n).tier, tier);
  assert.deepEqual(sessionTier(299), {
    tier: "GOLD",
    goldUnits: 2,
    remainderGroups: 99,
  });
});
test("zero cash cannot fund, and promised money never appears in treasury", () => {
  const db = fixture();
  const c = createHouseCampaign(db, {
    adminId: "admin",
    title: "Unfunded campaign",
    message: "Test campaign content",
    targetUrl: "https://example.test",
    rewardBudgetMilli: 1000,
  });
  assert.throws(
    () => fundHouseCampaign(db, c.id, "admin"),
    /Insufficient verified/,
  );
  assert.equal(
    (db.prepare("SELECT cash_milli FROM treasury").get() as any).cash_milli,
    0,
  );
  reconciled(db);
  db.close();
});
test("cleared funding requires admin, verification note and unique reference", () => {
  const db = fixture();
  assert.throws(
    () =>
      recordVerifiedFunding(db, {
        adminId: "worker",
        amountMilli: 1000,
        reference: "test-01",
        source: "OWNER_CAPITAL",
        evidenceNote: "Synthetic test evidence only.",
      }),
    /Administrator/,
  );
  assert.throws(() =>
    recordVerifiedFunding(db, {
      adminId: "admin",
      amountMilli: 1000,
      reference: "test-01",
      source: "OWNER_CAPITAL",
      evidenceNote: "unverified",
    }),
  );
  funding(db);
  assert.throws(() => funding(db), /already recorded/);
  assert.equal(
    (db.prepare("SELECT cash_milli FROM treasury").get() as any).cash_milli,
    1000000,
  );
  reconciled(db);
  db.close();
});
test("two slots and number ownership persist across disconnects; failed third slot changes nothing", () => {
  const db = fixture();
  user(db, "other");
  const a = inventory(db, [100]);
  inventory(db, [100], "worker", 2);
  assert.throws(() =>
    recordProviderPairing(db, {
      userId: "worker",
      slot: 3 as 1,
      providerJid: "2348000000099@s.whatsapp.net",
      hashKey: key,
    }),
  );
  db.prepare("UPDATE paired_accounts SET status='DISCONNECTED' WHERE id=?").run(
    a,
  );
  assert.throws(
    () =>
      recordProviderPairing(db, {
        userId: "other",
        slot: 1,
        providerJid: "2348010000001@s.whatsapp.net",
        hashKey: key,
      }),
    /another owner/,
  );
  assert.equal(
    (db.prepare("SELECT COUNT(*) n FROM paired_accounts").get() as any).n,
    2,
  );
  db.close();
});
test("inventory accepts only complete valid provider snapshots and retains manual exclusions", () => {
  const db = fixture();
  const id = inventory(db, [256, 290]);
  db.prepare(
    "UPDATE group_inventory SET excluded=1 WHERE account_id=? AND group_jid=?",
  ).run(id, groupJid(0));
  syncProviderInventory(
    db,
    id,
    [
      {
        jid: groupJid(0),
        subject: "Changed",
        memberCount: 278,
        announce: false,
        userIsAdmin: false,
      },
    ],
    true,
  );
  const e = earningWorkspace(db, "worker");
  assert.equal(e.summary.memberships, 1);
  assert.equal(e.summary.uniqueQualified, 0);
  assert.throws(() => syncProviderInventory(db, id, [], false), /complete/);
  assert.equal(
    (db.prepare("SELECT COUNT(*) n FROM group_inventory").get() as any).n,
    2,
  );
  db.close();
});
test("duplicate shared groups count once per campaign, but can count for another campaign", () => {
  const db = fixture();
  funding(db);
  inventory(db, [256, 290, 466, 278]);
  inventory(db, [256, 290], "worker", 2);
  const e = earningWorkspace(db, "worker");
  assert.equal(e.summary.memberships, 6);
  assert.equal(e.summary.uniqueQualified, 4);
  assert.equal(e.summary.duplicateMemberships, 2);
  assert.equal(e.summary.estimatedRewardMilli, 1290);
  const c = campaign(db, 1290);
  let total = 0;
  for (let i = 0; i < 4; i++) {
    const j = reserved(db, c);
    total += j.reward_milli;
    start(db, j);
    receipt(db, j);
  }
  assert.equal(total, 1290);
  assert.equal(reserveNextDelivery(db, c).job, null);
  const c2 = campaign(db, 256);
  assert.ok(reserveNextDelivery(db, c2).job);
  reconciled(db);
  db.close();
});
test("all 130 qualifying groups earn; no 100-group ceiling", () => {
  const db = fixture();
  funding(db);
  inventory(db, Array(130).fill(100));
  const c = campaign(db, 13000);
  let total = 0;
  for (let i = 0; i < 130; i++) {
    const j = reserved(db, c);
    start(db, j);
    receipt(db, j);
    total += j.reward_milli;
  }
  assert.equal(total, 13000);
  assert.equal(
    (
      db
        .prepare("SELECT earned_milli FROM wallets WHERE user_id=?")
        .get("worker") as any
    ).earned_milli,
    13000,
  );
  reconciled(db);
  db.close();
});
test("campaign cannot reserve a partial reward and backing cash is separate from the campaign reward budget", () => {
  const db = fixture();
  funding(db, 1000);
  inventory(db, [256]);
  const c = campaign(db, 256);
  assert.equal(reserveNextDelivery(db, c).job, null);
  funding(db, 200000, "synthetic-extra-backing");
  const j = reserved(db, c);
  assert.equal(j.reward_milli, 256);
  assert.equal(
    (
      db
        .prepare("SELECT bonus_backed_milli FROM wallets WHERE user_id=?")
        .get("worker") as any
    ).bonus_backed_milli,
    200000,
  );
  reconciled(db);
  db.close();
});
test("unapproved, expired, revoked, stale, locked and excluded groups never receive reserved jobs", () => {
  const db = fixture();
  funding(db);
  const a = inventory(db, [100, 100, 100, 100, 100, 100, 100]);
  const c = campaign(db, 10000);
  db.prepare("DELETE FROM group_permissions WHERE group_jid=?").run(
    groupJid(0),
  );
  db.prepare("UPDATE group_permissions SET expires_at=? WHERE group_jid=?").run(
    "2000-01-01T00:00:00.000Z",
    groupJid(1),
  );
  db.prepare("UPDATE group_permissions SET revoked_at=? WHERE group_jid=?").run(
    new Date().toISOString(),
    groupJid(2),
  );
  db.prepare("UPDATE group_inventory SET synced_at=? WHERE group_jid=?").run(
    "2000-01-01T00:00:00.000Z",
    groupJid(3),
  );
  db.prepare("UPDATE group_inventory SET announce=1 WHERE group_jid=?").run(
    groupJid(4),
  );
  db.prepare("UPDATE group_inventory SET excluded=1 WHERE group_jid=?").run(
    groupJid(5),
  );
  db.prepare("UPDATE group_inventory SET is_member=0 WHERE group_jid=?").run(
    groupJid(6),
  );
  assert.equal(reserveNextDelivery(db, c).job, null);
  reconciled(db);
  db.close();
});
test("changed members or revoked permission block sending after reservation", () => {
  const db = fixture();
  funding(db);
  inventory(db, [256]);
  const c = campaign(db);
  const j = reserved(db, c);
  db.prepare("UPDATE group_inventory SET member_count=290").run();
  assert.throws(() => start(db, j), /Membership changed/);
  db.prepare("UPDATE group_inventory SET member_count=256").run();
  db.prepare("UPDATE group_permissions SET revoked_at=?").run(
    new Date().toISOString(),
  );
  assert.throws(() => start(db, j), /revalidated/);
  failUnsentDelivery(db, j.id, "CANCELLED_BEFORE_SEND");
  assert.equal(
    (
      db
        .prepare("SELECT earned_milli FROM wallets WHERE user_id=?")
        .get("worker") as any
    ).earned_milli,
    0,
  );
  reconciled(db);
  db.close();
});
test("receipt matching, idempotency and no credit from reservation or sending alone", () => {
  const db = fixture();
  funding(db);
  inventory(db, [256]);
  const c = campaign(db);
  const j = reserved(db, c);
  assert.throws(() => receipt(db, j), /does not match/);
  start(db, j);
  assert.equal(
    (
      db
        .prepare("SELECT earned_milli FROM wallets WHERE user_id=?")
        .get("worker") as any
    ).earned_milli,
    0,
  );
  assert.throws(
    () =>
      settleConfirmedDelivery(db, {
        jobId: j.id,
        groupJid: "wrong",
        messageId: "synthetic-" + j.id,
        receiptId: "test-receipt",
        status: "DELIVERY_CONFIRMED",
      }),
    /does not match/,
  );
  receipt(db, j);
  assert.equal(receipt(db, j).idempotent, true);
  assert.throws(() => start(db, j), /never blindly resend/);
  assert.equal(
    (
      db
        .prepare("SELECT earned_milli FROM wallets WHERE user_id=?")
        .get("worker") as any
    ).earned_milli,
    256,
  );
  reconciled(db);
  db.close();
});
test("unknown delivery retains cash, cannot close or resend, but a later verified receipt settles", () => {
  const db = fixture();
  funding(db);
  inventory(db, [256]);
  const c = campaign(db);
  const j = reserved(db, c);
  start(db, j);
  markDeliveryUnknown(db, j.id, "Synthetic simulated network timeout");
  assert.throws(() => closeHouseCampaign(db, c, "admin"), /Unresolved/);
  assert.throws(() => start(db, j), /never blindly resend/);
  assert.throws(
    () => failUnsentDelivery(db, j.id, "PROVIDER_REJECTED_BEFORE_ACCEPTANCE"),
    /Cannot release/,
  );
  assert.equal(
    (db.prepare("SELECT payable_milli FROM treasury").get() as any)
      .payable_milli,
    0,
  );
  reconciled(db);
  receipt(db, j);
  closeHouseCampaign(db, c, "admin");
  reconciled(db);
  db.close();
});
test("unsent failure returns reward to the campaign, is idempotent and never credits a worker", () => {
  const db = fixture();
  funding(db);
  inventory(db, [256]);
  const c = campaign(db, 1000);
  const j = reserved(db, c);
  failUnsentDelivery(db, j.id, "CANCELLED_BEFORE_SEND");
  assert.equal(
    failUnsentDelivery(db, j.id, "CANCELLED_BEFORE_SEND").idempotent,
    true,
  );
  assert.equal(
    (db.prepare("SELECT remaining_milli FROM house_campaigns").get() as any)
      .remaining_milli,
    1000,
  );
  closeHouseCampaign(db, c, "admin");
  reconciled(db);
  db.close();
});
test("100-Coin referral is pending at signup; another simultaneous delivery may qualify it exactly once", () => {
  const db = fixture();
  user(db, "referrer");
  registerReferral(db, "worker", referralCode(db, "referrer"));
  assert.equal(referralSummary(db, "referrer").pending_milli, 100000);
  funding(db);
  inventory(db, [256, 290]);
  const c = campaign(db);
  const first = reserved(db, c),
    second = reserved(db, c);
  start(db, first);
  start(db, second);
  receipt(db, second);
  assert.equal(referralSummary(db, "referrer").earned_milli, 100000);
  receipt(db, first);
  assert.equal(referralSummary(db, "referrer").earned_milli, 100000);
  assert.equal(
    (
      db
        .prepare("SELECT earned_milli FROM wallets WHERE user_id=?")
        .get("referrer") as any
    ).earned_milli,
    100000,
  );
  reconciled(db);
  db.close();
});
test("referral funding is transferred to another in-flight delivery, not prematurely released on failure", () => {
  const db = fixture();
  user(db, "referrer");
  registerReferral(db, "worker", referralCode(db, "referrer"));
  funding(db);
  inventory(db, [256, 290]);
  const c = campaign(db);
  const a = reserved(db, c),
    b = reserved(db, c);
  failUnsentDelivery(db, a.id, "CANCELLED_BEFORE_SEND");
  assert.equal(
    (db.prepare("SELECT reserved_job_id FROM referrals").get() as any)
      .reserved_job_id,
    b.id,
  );
  start(db, b);
  receipt(db, b);
  assert.equal(referralSummary(db, "referrer").earned_milli, 100000);
  reconciled(db);
  db.close();
});
test("failed first delivery releases conditional referral cash but preserves separately disclosed bonus backing", () => {
  const db = fixture();
  user(db, "referrer");
  registerReferral(db, "worker", referralCode(db, "referrer"));
  funding(db);
  inventory(db, [100]);
  const c = campaign(db);
  const j = reserved(db, c);
  failUnsentDelivery(db, j.id, "CANCELLED_BEFORE_SEND");
  assert.equal(referralSummary(db, "referrer").pending_milli, 100000);
  assert.equal(
    (db.prepare("SELECT bonus_backing_milli FROM treasury").get() as any)
      .bonus_backing_milli,
    400000,
  );
  reconciled(db);
  db.close();
});
test("daily capacity applies to owners, not separately to their two numbers; campaign groups are not extra broadcasts", () => {
  const db = fixture();
  funding(db, 10000000);
  inventory(db, [100, 100]);
  inventory(db, [100], "worker", 2, 20);
  for (let i = 0; i < 10; i++) {
    const c = campaign(db, 10000);
    const a = reserved(db, c);
    start(db, a);
    receipt(db, a);
    if (i === 0) {
      const b = reserved(db, c);
      start(db, b);
      receipt(db, b);
    }
  }
  assert.equal(earningWorkspace(db, "worker").today, 10);
  const eleventh = campaign(db);
  assert.equal(reserveNextDelivery(db, eleventh).job, null);
  reconciled(db);
  db.close();
});
test("round-robin takes the least recently selected account, using real inventory", () => {
  const db = fixture();
  funding(db);
  const a = inventory(db, [100], "worker", 1),
    b = inventory(db, [100], "worker", 2, 20);
  db.prepare("UPDATE paired_accounts SET last_broadcast_at=? WHERE id=?").run(
    "2000-01-01T00:00:00.000Z",
    a,
  );
  const c = campaign(db);
  assert.equal(reserved(db, c).account_id, b);
  assert.equal(reserved(db, c).account_id, a);
  reconciled(db);
  db.close();
});
test("kill switch blocks reservation and send without erasing earned obligations", () => {
  const db = fixture();
  funding(db);
  inventory(db, [256]);
  const c = campaign(db);
  const j = reserved(db, c);
  db.prepare("UPDATE broadcast_settings SET dispatch_enabled=0").run();
  assert.throws(() => reserveNextDelivery(db, c), /disabled/);
  assert.throws(() => start(db, j), /disabled/);
  failUnsentDelivery(db, j.id, "CANCELLED_BEFORE_SEND");
  reconciled(db);
  db.close();
});
test("money events are append-only, and reconciliation detects unsupported manual wallet credit", () => {
  const db = fixture();
  funding(db);
  assert.throws(
    () => db.exec("UPDATE money_events SET amount_milli=1"),
    /append-only/,
  );
  assert.throws(() => db.exec("DELETE FROM money_events"), /append-only/);
  db.prepare(
    "UPDATE wallets SET earned_milli=100 WHERE user_id='worker'",
  ).run();
  assert.equal(reconcileTreasury(db).ok, false);
  assert.throws(() => campaign(db), /reconciliation/);
  db.close();
});

test("reconciliation detects an unsupported credit even if wallet and treasury totals were manually balanced", () => {
  const db = fixture();
  funding(db);
  db.prepare(
    "UPDATE wallets SET earned_milli=100 WHERE user_id='worker'",
  ).run();
  db.prepare(
    "UPDATE treasury SET available_milli=available_milli-100,payable_milli=100",
  ).run();
  const result = reconcileTreasury(db);
  assert.equal(result.checks.cashConserved, true);
  assert.equal(result.checks.payableMatchesWallets, true);
  assert.equal(result.checks.walletsMatchEarnedLedger, false);
  assert.equal(result.ok, false);
  db.close();
});
test("reused provider receipt rolls back the entire second settlement atomically", () => {
  const db = fixture();
  funding(db);
  inventory(db, [256, 290]);
  const c = campaign(db),
    a = reserved(db, c),
    b = reserved(db, c);
  start(db, a);
  start(db, b);
  const r = {
    jobId: a.id,
    groupJid: a.group_jid,
    messageId: "synthetic-" + a.id,
    receiptId: "synthetic-shared-provider-receipt",
    status: "DELIVERY_CONFIRMED" as const,
  };
  settleConfirmedDelivery(db, r);
  assert.throws(
    () =>
      settleConfirmedDelivery(db, {
        ...r,
        jobId: b.id,
        groupJid: b.group_jid,
        messageId: "synthetic-" + b.id,
      }),
    /UNIQUE/,
  );
  assert.equal(
    (
      db
        .prepare("SELECT earned_milli FROM wallets WHERE user_id='worker'")
        .get() as any
    ).earned_milli,
    256,
  );
  assert.equal(
    (db.prepare("SELECT status FROM delivery_jobs WHERE id=?").get(b.id) as any)
      .status,
    "SENDING",
  );
  reconciled(db);
  db.close();
});
