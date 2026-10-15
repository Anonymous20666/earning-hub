import type { DatabaseSync } from "node:sqlite";
/** Version 5: 100-Coin policy. Locked reservations and settled history retain their original amounts. */
export function migrateReferralSchema(db: DatabaseSync) {
  const original =
    (
      db
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type='table' AND name='referrals'",
        )
        .get() as any
    )?.sql || "";
  const needsRebuild = original
    .replace(/\s+/g, "")
    .toLowerCase()
    .includes("check(reward_milli=5000)");
  if (needsRebuild) db.exec("PRAGMA foreign_keys=OFF");
  let inTransaction = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    inTransaction = true;
    if (needsRebuild) {
      db.exec(`CREATE TABLE referrals_v5(
 id TEXT PRIMARY KEY,referrer_id TEXT NOT NULL REFERENCES users(id),referred_id TEXT NOT NULL UNIQUE REFERENCES users(id),
 reward_milli INTEGER NOT NULL DEFAULT 100000 CHECK(typeof(reward_milli)='integer' AND reward_milli IN(5000,100000)),
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','RESERVED','EARNED','DISQUALIFIED')),
 reserved_job_id TEXT,created_at TEXT NOT NULL,earned_at TEXT,CHECK(referrer_id<>referred_id));
 INSERT INTO referrals_v5 SELECT id,referrer_id,referred_id,reward_milli,status,reserved_job_id,created_at,earned_at FROM referrals;
 DROP TABLE referrals;ALTER TABLE referrals_v5 RENAME TO referrals;`);
    }
    db.exec(`UPDATE referrals SET reward_milli=100000 WHERE status='PENDING' AND reward_milli=5000;
 CREATE TRIGGER IF NOT EXISTS referral_locked_amount_immutable BEFORE UPDATE OF reward_milli ON referrals WHEN OLD.status IN('RESERVED','EARNED') AND NEW.reward_milli<>OLD.reward_milli BEGIN SELECT RAISE(ABORT,'Reserved and earned referral amounts are immutable');END;`);
    if (db.prepare("PRAGMA foreign_key_check").all().length)
      throw Error("Referral migration foreign-key validation failed");
    db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES(5,?)").run(
      new Date().toISOString(),
    );
    db.exec("COMMIT");
    inTransaction = false;
  } catch (e) {
    if (inTransaction) db.exec("ROLLBACK");
    throw e;
  } finally {
    if (needsRebuild) db.exec("PRAGMA foreign_keys=ON");
  }
}
