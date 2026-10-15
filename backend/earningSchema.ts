import type { DatabaseSync } from "node:sqlite";
export function migrateEarningSchema(db: DatabaseSync) {
  db.exec(`
 CREATE TABLE IF NOT EXISTS broadcast_settings(
   id INTEGER PRIMARY KEY CHECK(id=1), daily_limit INTEGER NOT NULL DEFAULT 10 CHECK(daily_limit BETWEEN 1 AND 10),
   dispatch_enabled INTEGER NOT NULL DEFAULT 0 CHECK(dispatch_enabled IN (0,1)));
 INSERT OR IGNORE INTO broadcast_settings(id) VALUES(1);
 CREATE TABLE IF NOT EXISTS treasury(
   id INTEGER PRIMARY KEY CHECK(id=1), cash_milli INTEGER NOT NULL DEFAULT 0,
   available_milli INTEGER NOT NULL DEFAULT 0, reserved_milli INTEGER NOT NULL DEFAULT 0,
   payable_milli INTEGER NOT NULL DEFAULT 0, bonus_backing_milli INTEGER NOT NULL DEFAULT 0,
   CHECK(typeof(cash_milli)='integer' AND typeof(available_milli)='integer' AND typeof(reserved_milli)='integer' AND typeof(payable_milli)='integer' AND typeof(bonus_backing_milli)='integer'),
   CHECK(cash_milli<=999999999999 AND cash_milli>=0 AND available_milli>=0 AND reserved_milli>=0 AND payable_milli>=0 AND bonus_backing_milli>=0),
   CHECK(cash_milli=available_milli+reserved_milli+payable_milli+bonus_backing_milli));
 INSERT OR IGNORE INTO treasury(id) VALUES(1);
 CREATE TABLE IF NOT EXISTS funding_receipts(
   id TEXT PRIMARY KEY, source_reference TEXT NOT NULL UNIQUE, amount_milli INTEGER NOT NULL CHECK(typeof(amount_milli)='integer' AND amount_milli>0),
   source TEXT NOT NULL CHECK(source IN ('BANK_TRANSFER','OWNER_CAPITAL','SETTLED_REVENUE')),
   evidence_note TEXT NOT NULL, recorded_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
 CREATE TRIGGER IF NOT EXISTS funding_receipts_immutable_update BEFORE UPDATE ON funding_receipts BEGIN SELECT RAISE(ABORT,'Funding receipts are append-only'); END;
 CREATE TRIGGER IF NOT EXISTS funding_receipts_immutable_delete BEFORE DELETE ON funding_receipts BEGIN SELECT RAISE(ABORT,'Funding receipts are append-only'); END;
 CREATE TABLE IF NOT EXISTS money_events(
   id TEXT PRIMARY KEY, kind TEXT NOT NULL, reference TEXT NOT NULL UNIQUE, amount_milli INTEGER NOT NULL,
   actor_id TEXT, detail TEXT NOT NULL, created_at TEXT NOT NULL);
 CREATE TRIGGER IF NOT EXISTS money_events_immutable_update BEFORE UPDATE ON money_events BEGIN SELECT RAISE(ABORT,'Money events are append-only'); END;
 CREATE TRIGGER IF NOT EXISTS money_events_immutable_delete BEFORE DELETE ON money_events BEGIN SELECT RAISE(ABORT,'Money events are append-only'); END;
 CREATE TABLE IF NOT EXISTS referral_codes(user_id TEXT PRIMARY KEY REFERENCES users(id), code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS referrals(
   id TEXT PRIMARY KEY, referrer_id TEXT NOT NULL REFERENCES users(id), referred_id TEXT NOT NULL UNIQUE REFERENCES users(id),
   reward_milli INTEGER NOT NULL DEFAULT 5000 CHECK(reward_milli=5000),
   status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','RESERVED','EARNED','DISQUALIFIED')),
   reserved_job_id TEXT, created_at TEXT NOT NULL, earned_at TEXT,
   CHECK(referrer_id<>referred_id));
 CREATE TABLE IF NOT EXISTS paired_numbers_history(jid_hash TEXT PRIMARY KEY, original_user_id TEXT NOT NULL REFERENCES users(id), first_paired_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS paired_accounts(
   id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), slot INTEGER NOT NULL CHECK(slot IN(1,2)),
   jid_hash TEXT NOT NULL UNIQUE REFERENCES paired_numbers_history(jid_hash), phone_label TEXT NOT NULL,
   status TEXT NOT NULL CHECK(status IN('ONLINE','OFFLINE','DISCONNECTED')),
   last_broadcast_at TEXT, last_selected_at TEXT, connected_at TEXT NOT NULL, scanner_at TEXT,
   UNIQUE(user_id,slot));
 CREATE TABLE IF NOT EXISTS group_inventory(
   account_id TEXT NOT NULL REFERENCES paired_accounts(id), group_jid TEXT NOT NULL, subject TEXT NOT NULL,
   member_count INTEGER NOT NULL CHECK(typeof(member_count)='integer' AND member_count>=0),
   announce INTEGER NOT NULL CHECK(announce IN(0,1)), user_is_admin INTEGER NOT NULL CHECK(user_is_admin IN(0,1)),
   is_member INTEGER NOT NULL DEFAULT 1 CHECK(is_member IN(0,1)), excluded INTEGER NOT NULL DEFAULT 0 CHECK(excluded IN(0,1)),
   synced_at TEXT NOT NULL, PRIMARY KEY(account_id,group_jid));
 CREATE TABLE IF NOT EXISTS group_permissions(
   group_jid TEXT PRIMARY KEY, consent_reference TEXT NOT NULL, approved_by_hash TEXT NOT NULL,
   approved_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT);
 CREATE TABLE IF NOT EXISTS house_campaigns(
   id TEXT PRIMARY KEY, title TEXT NOT NULL, message TEXT NOT NULL, target_url TEXT NOT NULL,
   status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','FUNDED','RUNNING','PAUSED','COMPLETED','CANCELLED')),
   reward_budget_milli INTEGER NOT NULL CHECK(typeof(reward_budget_milli)='integer' AND reward_budget_milli>0),
   remaining_milli INTEGER NOT NULL DEFAULT 0 CHECK(typeof(remaining_milli)='integer' AND remaining_milli>=0),
   paid_milli INTEGER NOT NULL DEFAULT 0, allocated_milli INTEGER NOT NULL DEFAULT 0,
   created_by TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
   CHECK(paid_milli>=0 AND allocated_milli>=0 AND paid_milli+allocated_milli+remaining_milli<=reward_budget_milli));
 CREATE TABLE IF NOT EXISTS delivery_jobs(
   id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES house_campaigns(id), group_jid TEXT NOT NULL,
   account_id TEXT NOT NULL REFERENCES paired_accounts(id), user_id TEXT NOT NULL REFERENCES users(id),
   reward_milli INTEGER NOT NULL CHECK(typeof(reward_milli)='integer' AND reward_milli BETWEEN 100 AND 1000),
   member_snapshot INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN('RESERVED','SENDING','DELIVERED','FAILED','UNKNOWN')),
   provider_message_id TEXT UNIQUE, provider_receipt_id TEXT UNIQUE, referral_id TEXT REFERENCES referrals(id),
   reserved_at TEXT NOT NULL, sent_at TEXT, settled_at TEXT, failure_reason TEXT,
   UNIQUE(campaign_id,group_jid));
 CREATE TABLE IF NOT EXISTS campaign_participation(
   campaign_id TEXT NOT NULL REFERENCES house_campaigns(id), user_id TEXT NOT NULL REFERENCES users(id),
   day_utc TEXT NOT NULL, PRIMARY KEY(campaign_id,user_id));
 CREATE INDEX IF NOT EXISTS participation_day_user ON campaign_participation(user_id,day_utc);
 CREATE TABLE IF NOT EXISTS dispatch_outbox(
   job_id TEXT PRIMARY KEY REFERENCES delivery_jobs(id), created_at TEXT NOT NULL, enqueued_at TEXT);
 `);
  const accountColumns = (
    db.prepare("PRAGMA table_info(paired_accounts)").all() as any[]
  ).map((x) => x.name);
  if (!accountColumns.includes("last_selected_at"))
    db.exec("ALTER TABLE paired_accounts ADD COLUMN last_selected_at TEXT");
  const columns = (db.prepare("PRAGMA table_info(wallets)").all() as any[]).map(
    (x) => x.name,
  );
  if (!columns.includes("bonus_backed_milli"))
    db.exec(
      "ALTER TABLE wallets ADD COLUMN bonus_backed_milli INTEGER NOT NULL DEFAULT 0 CHECK(bonus_backed_milli>=0)",
    );
  // Existing earned funds, if any, are disclosed as a reconciliation requirement, not silently fabricated cash.
  db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES(2,?)").run(
    new Date().toISOString(),
  );
}
