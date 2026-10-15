import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../backend/database";
import { migrateReferralSchema } from "../backend/referralSchema";
import { EARNING_RULES, DAILY_EARNING_EXAMPLE } from "../shared/earningRules";
import {
  registerReferral,
  referralCode,
  recordVerifiedFunding,
  createHouseCampaign,
  fundHouseCampaign,
  reconcileTreasury,
} from "../backend/earning";
import {
  recordProviderPairing,
  syncProviderInventory,
} from "../backend/inventory";
import { reservePaidRun, cancelUnsentPlacement } from "../backend/broadcasts";
const date = () => new Date().toISOString();
function user(db: any, id: string, role = "EARNER") {
  db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?)").run(
    id,
    id + "@example.test",
    id,
    "SYNTHETIC",
    role,
    0,
    date(),
  );
  if (role === "EARNER")
    db.prepare("INSERT INTO wallets(user_id) VALUES(?)").run(id);
}
test("v4 referral rebuild preserves identities, child foreign keys, settled ledger and booked rates; only pending reward changes", () => {
  const db = openDatabase(":memory:");
  try {
    for (const id of ["inviter", "pending", "booked", "settled"]) user(db, id);
    user(db, "admin", "ADMIN");
    db.exec(
      `PRAGMA foreign_keys=OFF;DROP TRIGGER IF EXISTS referral_locked_amount_immutable;DROP TABLE referrals;CREATE TABLE referrals(id TEXT PRIMARY KEY,referrer_id TEXT NOT NULL REFERENCES users(id),referred_id TEXT NOT NULL UNIQUE REFERENCES users(id),reward_milli INTEGER NOT NULL DEFAULT 5000 CHECK(reward_milli=5000),status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','RESERVED','EARNED','DISQUALIFIED')),reserved_job_id TEXT,created_at TEXT NOT NULL,earned_at TEXT,CHECK(referrer_id<>referred_id));PRAGMA foreign_keys=ON;DELETE FROM schema_migrations WHERE version=5;`,
    );
    for (const [id, referred, status] of [
      ["p", "pending", "PENDING"],
      ["r", "booked", "RESERVED"],
      ["e", "settled", "EARNED"],
    ])
      db.prepare("INSERT INTO referrals VALUES(?,?,?,5000,?,?,?,?)").run(
        id,
        "inviter",
        referred,
        status,
        status === "RESERVED" ? "SYNTHETIC-booked-job" : null,
        date(),
        status === "EARNED" ? date() : null,
      );
    recordVerifiedFunding(db, {
      adminId: "admin",
      amountMilli: 20000,
      source: "OWNER_CAPITAL",
      reference: "SYNTHETIC-legacy-backing",
      evidenceNote: "SYNTHETIC old funded referral balances",
    });
    db.prepare(
      "UPDATE wallets SET earned_milli=5000 WHERE user_id='inviter'",
    ).run();
    db.prepare(
      "INSERT INTO ledger VALUES('old-credit','inviter','QUALIFIED_REFERRAL',5000,'referral:e',?)",
    ).run(date());
    db.exec(
      "UPDATE treasury SET available_milli=available_milli-10000,reserved_milli=5000,payable_milli=5000",
    );
    assert.equal(reconcileTreasury(db).ok, true);
    db.exec(
      "CREATE TABLE referral_test_child(id TEXT PRIMARY KEY,referral_id TEXT REFERENCES referrals(id));",
    );
    db.prepare("INSERT INTO referral_test_child VALUES(?,?)").run("child", "r");
    const before = db
        .prepare("SELECT * FROM referrals ORDER BY id")
        .all() as any[],
      wallets = db.prepare("SELECT * FROM wallets").all(),
      ledger = db.prepare("SELECT * FROM ledger").all(),
      treasury = db.prepare("SELECT * FROM treasury").all();
    migrateReferralSchema(db);
    assert.equal(reconcileTreasury(db).ok, true);
    const after = db
      .prepare("SELECT * FROM referrals ORDER BY id")
      .all() as any[];
    for (let i = 0; i < before.length; i++) {
      if (before[i].status === "PENDING")
        assert.equal(after[i].reward_milli, 100000);
      else assert.deepEqual(after[i], before[i]);
      assert.equal(after[i].id, before[i].id);
      assert.equal(after[i].created_at, before[i].created_at);
    }
    assert.deepEqual(db.prepare("SELECT * FROM wallets").all(), wallets);
    assert.deepEqual(db.prepare("SELECT * FROM ledger").all(), ledger);
    assert.deepEqual(db.prepare("SELECT * FROM treasury").all(), treasury);
    assert.equal(
      (db.prepare("PRAGMA foreign_keys").get() as any).foreign_keys,
      1,
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(
      (db.prepare("SELECT referral_id FROM referral_test_child").get() as any)
        .referral_id,
      "r",
    );
    assert.throws(
      () =>
        db
          .prepare("UPDATE referrals SET reward_milli=100000 WHERE id='r'")
          .run(),
      /immutable/,
    );
    assert.throws(
      () =>
        db
          .prepare("UPDATE referrals SET reward_milli=100000 WHERE id='e'")
          .run(),
      /immutable/,
    );
    migrateReferralSchema(db);
    assert.deepEqual(
      db.prepare("SELECT * FROM referrals ORDER BY id").all(),
      after,
    );
    assert.equal(
      (
        db
          .prepare("SELECT COUNT(*) n FROM schema_migrations WHERE version=5")
          .get() as any
      ).n,
      1,
    );
  } finally {
    db.close();
  }
});
test("100-Coin referral funding is atomic down to one milli-Coin and remains conditional, not signup earnings", () => {
  const db = openDatabase(":memory:");
  try {
    user(db, "admin", "ADMIN");
    user(db, "inviter");
    user(db, "worker");
    db.prepare("UPDATE wallets SET locked_milli=0,bonus_claimed=1").run();
    registerReferral(db, "worker", referralCode(db, "inviter"));
    assert.equal(
      (db.prepare("SELECT reward_milli FROM referrals").get() as any)
        .reward_milli,
      EARNING_RULES.referralMilli,
    );
    assert.equal(
      (db.prepare("SELECT SUM(earned_milli) n FROM wallets").get() as any).n,
      0,
    );
    const a = recordProviderPairing(db, {
        userId: "worker",
        slot: 1,
        providerJid: "2348000000091@s.whatsapp.net",
        hashKey: "a".repeat(64),
      }),
      jid = "120363000000000091@g.us";
    syncProviderInventory(
      db,
      a.id,
      [
        {
          jid,
          subject: "SYNTHETIC funding boundary",
          memberCount: 1000,
          announce: false,
          userIsAdmin: true,
        },
      ],
      true,
    );
    db.prepare(
      "INSERT INTO broadcast_permissions VALUES(?,?,1,1,1,?,?,?,NULL)",
    ).run(
      a.id,
      jid,
      "b".repeat(64),
      "SYNTHETIC consent",
      new Date(Date.now() + 86400000).toISOString(),
    );
    db.prepare(
      "INSERT INTO wa_slots(id,user_id,slot,phone_hash,phone_label,account_id,status,paid_opt_in,created_at,updated_at) VALUES('SYNTHETIC-slot','worker',1,'SYNTHETIC-hash','TEST',?,'ONLINE',1,?,?)",
    ).run(a.id, date(), date());
    recordVerifiedFunding(db, {
      adminId: "admin",
      amountMilli: 100999,
      source: "OWNER_CAPITAL",
      reference: "SYNTHETIC-100999",
      evidenceNote: "SYNTHETIC isolated funding boundary",
    });
    const c = createHouseCampaign(db, {
      adminId: "admin",
      title: "SYNTHETIC boundary",
      message: "Synthetic only",
      targetUrl: "https://example.com/",
      rewardBudgetMilli: 1000,
    });
    fundHouseCampaign(db, c.id, "admin");
    db.prepare("UPDATE broadcast_settings SET dispatch_enabled=1").run();
    const snapshot = () =>
      JSON.stringify({
        wallets: db.prepare("SELECT * FROM wallets").all(),
        treasury: db.prepare("SELECT * FROM treasury").all(),
        referrals: db.prepare("SELECT * FROM referrals").all(),
        runs: db.prepare("SELECT * FROM broadcast_runs").all(),
        ledger: db.prepare("SELECT * FROM ledger").all(),
        campaign: db.prepare("SELECT * FROM house_campaigns").all(),
      });
    const before = snapshot();
    assert.throws(() =>
      reservePaidRun(db, "admin", c.id, "worker", "ALLSTATUS", [
        { accountId: a.id, groupJid: jid },
      ]),
    );
    assert.equal(snapshot(), before);
    recordVerifiedFunding(db, {
      adminId: "admin",
      amountMilli: 1,
      source: "OWNER_CAPITAL",
      reference: "SYNTHETIC-one-milli",
      evidenceNote: "SYNTHETIC exact one milli-Coin top up",
    });
    reservePaidRun(db, "admin", c.id, "worker", "ALLSTATUS", [
      { accountId: a.id, groupJid: jid },
    ]);
    assert.equal(
      (db.prepare("SELECT * FROM referrals").get() as any).reward_milli,
      100000,
    );
    assert.equal(
      (db.prepare("SELECT * FROM referrals").get() as any).status,
      "RESERVED",
    );
    assert.equal(
      (db.prepare("SELECT SUM(earned_milli) n FROM wallets").get() as any).n,
      0,
    );
    assert.equal(reconcileTreasury(db).ok, true);
    // Model an actually held legacy 5-Coin reservation, keeping backing exact.
    db.exec(
      "DROP TRIGGER referral_locked_amount_immutable;UPDATE referrals SET reward_milli=5000;UPDATE treasury SET available_milli=available_milli+95000,reserved_milli=reserved_milli-95000",
    );
    migrateReferralSchema(db);
    assert.equal(
      (db.prepare("SELECT reward_milli FROM referrals").get() as any)
        .reward_milli,
      5000,
    );
    assert.equal(reconcileTreasury(db).ok, true);
    const placement = db
      .prepare("SELECT id FROM broadcast_placements")
      .get() as any;
    cancelUnsentPlacement(
      db,
      placement.id,
      "SYNTHETIC legacy hold released before send",
    );
    const released = db
      .prepare("SELECT status,reward_milli FROM referrals")
      .get() as any;
    assert.equal(released.status, "PENDING");
    assert.equal(released.reward_milli, 100000);
    assert.equal(
      (db.prepare("SELECT available_milli FROM treasury").get() as any)
        .available_milli,
      100000,
    );
    assert.equal(reconcileTreasury(db).ok, true);
  } finally {
    db.close();
  }
});
test("published daily example is exactly derived from unchanged funded placement rules, not a daily guarantee or upper earning cap", () => {
  assert.equal(DAILY_EARNING_EXAMPLE.groups, 50);
  assert.equal(DAILY_EARNING_EXAMPLE.dailyMilli, 1000000);
  assert.equal(DAILY_EARNING_EXAMPLE.dailyMilli / 1000, 1000);
  assert.equal(EARNING_RULES.maxCampaignsPerDay, 10);
  assert.equal(EARNING_RULES.referralMilli, 100000);
});

test("failed legacy rebuild rolls back the table, pending rate and migration marker, and restores FK enforcement", () => {
  const db = openDatabase(":memory:");
  try {
    user(db, "inviter");
    user(db, "pending");
    db.exec(
      `PRAGMA foreign_keys=OFF;DROP TRIGGER referral_locked_amount_immutable;DROP TABLE referrals;CREATE TABLE referrals(id TEXT PRIMARY KEY,referrer_id TEXT NOT NULL REFERENCES users(id),referred_id TEXT NOT NULL UNIQUE REFERENCES users(id),reward_milli INTEGER NOT NULL DEFAULT 5000 CHECK(reward_milli=5000),status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','RESERVED','EARNED','DISQUALIFIED')),reserved_job_id TEXT,created_at TEXT NOT NULL,earned_at TEXT,CHECK(referrer_id<>referred_id));INSERT INTO referrals VALUES('p','inviter','pending',5000,'PENDING',NULL,'SYNTHETIC',NULL);CREATE TABLE corrupt_child(referral_id TEXT REFERENCES referrals(id));INSERT INTO corrupt_child VALUES('SYNTHETIC-missing-parent');DELETE FROM schema_migrations WHERE version=5;PRAGMA foreign_keys=ON;`,
    );
    const original = (
      db
        .prepare("SELECT sql FROM sqlite_master WHERE name='referrals'")
        .get() as any
    ).sql;
    assert.throws(
      () => migrateReferralSchema(db),
      /foreign-key validation failed/,
    );
    assert.equal(
      (
        db
          .prepare("SELECT sql FROM sqlite_master WHERE name='referrals'")
          .get() as any
      ).sql,
      original,
    );
    assert.equal(
      (db.prepare("SELECT reward_milli FROM referrals").get() as any)
        .reward_milli,
      5000,
    );
    assert.equal(
      (db.prepare("PRAGMA foreign_keys").get() as any).foreign_keys,
      1,
    );
    assert.equal(
      (
        db
          .prepare("SELECT COUNT(*) n FROM schema_migrations WHERE version=5")
          .get() as any
      ).n,
      0,
    );
    assert.equal(
      (
        db
          .prepare(
            "SELECT COUNT(*) n FROM sqlite_master WHERE name='referrals_v5'",
          )
          .get() as any
      ).n,
      0,
    );
  } finally {
    db.close();
  }
});
