// Private VPS read-only hashed preservation evidence. Never outputs stored payloads or credentials.
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
const db = new DatabaseSync("/app/data/pappy.sqlite", { readOnly: true });
const hash = (sql) =>
  createHash("sha256")
    .update(JSON.stringify(db.prepare(sql).all()))
    .digest("hex");
db.exec("BEGIN");
const hashes = {};
for (const table of [
  "users",
  "wallets",
  "ledger",
  "treasury",
  "funding_receipts",
  "money_events",
  "referrals",
  "referral_codes",
  "paired_numbers_history",
  "house_campaigns",
  "delivery_jobs",
  "campaign_participation",
  "dispatch_outbox",
  "broadcast_settings",
  "broadcast_runs",
  "broadcast_targets",
  "broadcast_placements",
  "broadcast_request_keys",
  "broadcast_removals",
  "broadcast_permissions",
  "personal_ignored_groups",
  "personal_drafts",
  "personal_run_options",
  "broadcast_events",
  "broadcast_assets",
  "broadcast_native_policy",
])
  hashes[table] = hash(`SELECT * FROM ${table} ORDER BY rowid`);
hashes.slotIdentity = hash(
  "SELECT id,user_id,slot,phone_hash,phone_label,account_id,paid_opt_in,created_at FROM wa_slots ORDER BY id",
);
hashes.accountIdentity = hash(
  "SELECT id,user_id,slot,jid_hash,phone_label FROM paired_accounts ORDER BY id",
);
hashes.referralHistory = hash(
  "SELECT id,referrer_id,referred_id,CASE WHEN status='PENDING' THEN 100000 ELSE reward_milli END reward_milli,status,reserved_job_id,created_at,earned_at FROM referrals ORDER BY rowid",
);
const result = {
  at: new Date().toISOString(),
  hashes,
  slotStates: db
    .prepare("SELECT slot,status FROM wa_slots ORDER BY slot")
    .all(),
  groupCounts: db
    .prepare(
      "SELECT COUNT(*) total,SUM(is_member) current,SUM(is_member AND member_count<100) under100 FROM group_inventory",
    )
    .get(),
  authEntries: db.prepare("SELECT COUNT(*) n FROM wa_vault").get().n,
  credentialEntries: db
    .prepare("SELECT COUNT(*) n FROM wa_vault WHERE entry_key='creds'")
    .get().n,
  activePersonal: db
    .prepare(
      "SELECT COUNT(*) n FROM broadcast_placements p JOIN broadcast_targets t ON t.id=p.target_id JOIN broadcast_runs r ON r.id=t.run_id WHERE r.purpose='PERSONAL' AND p.status IN('RESERVED','SENDING')",
    )
    .get().n,
  treasury: db.prepare("SELECT * FROM treasury").get(),
  settings: db.prepare("SELECT * FROM broadcast_settings").get(),
  referralPolicyCounts: db
    .prepare(
      "SELECT status,reward_milli,COUNT(*) n FROM referrals GROUP BY status,reward_milli",
    )
    .all(),
  foreignKeyErrors: db.prepare("PRAGMA foreign_key_check").all().length,
  migrations: db
    .prepare("SELECT version FROM schema_migrations ORDER BY version")
    .all(),
};
db.exec("COMMIT");
db.close();
console.log(JSON.stringify(result));
