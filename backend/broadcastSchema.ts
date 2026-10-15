import type { DatabaseSync } from "node:sqlite";
export function migrateBroadcastSchema(db: DatabaseSync) {
  db.exec(`
CREATE TABLE IF NOT EXISTS wa_slots(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),slot INTEGER NOT NULL CHECK(slot IN(1,2)),
 phone_hash TEXT NOT NULL,phone_label TEXT NOT NULL,account_id TEXT REFERENCES paired_accounts(id),
 status TEXT NOT NULL CHECK(status IN('PAIRING','ONLINE','OFFLINE','LOGGED_OUT','EXPIRED','ERROR')),
 attempt_expires_at TEXT,paid_opt_in INTEGER NOT NULL DEFAULT 0 CHECK(paid_opt_in IN(0,1)),last_error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(user_id,slot));
CREATE UNIQUE INDEX IF NOT EXISTS wa_active_phone ON wa_slots(phone_hash) WHERE status IN('ONLINE','PAIRING','OFFLINE');
CREATE TABLE IF NOT EXISTS wa_vault(slot_id TEXT NOT NULL REFERENCES wa_slots(id),entry_key TEXT NOT NULL,ciphertext TEXT NOT NULL,PRIMARY KEY(slot_id,entry_key));
CREATE TABLE IF NOT EXISTS broadcast_removals(user_id TEXT NOT NULL REFERENCES users(id),group_jid TEXT NOT NULL,source_account_id TEXT NOT NULL REFERENCES paired_accounts(id),removed_at TEXT NOT NULL,cleared_at TEXT,PRIMARY KEY(user_id,group_jid));
CREATE TABLE IF NOT EXISTS broadcast_permissions(
 account_id TEXT NOT NULL REFERENCES paired_accounts(id),group_jid TEXT NOT NULL,status_allowed INTEGER NOT NULL DEFAULT 0,chat_allowed INTEGER NOT NULL DEFAULT 0,mentions_allowed INTEGER NOT NULL DEFAULT 0,
 approved_by_hash TEXT NOT NULL,evidence_reference TEXT NOT NULL,expires_at TEXT NOT NULL,revoked_at TEXT,PRIMARY KEY(account_id,group_jid));
CREATE TABLE IF NOT EXISTS group_approval_requests(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),account_id TEXT NOT NULL REFERENCES paired_accounts(id),group_jid TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE,status_allowed INTEGER NOT NULL,chat_allowed INTEGER NOT NULL,mentions_allowed INTEGER NOT NULL,expires_at TEXT NOT NULL,approved_at TEXT);
CREATE TABLE IF NOT EXISTS broadcast_assets(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),mime TEXT NOT NULL,bytes INTEGER NOT NULL,sha256 TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS broadcast_runs(
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),purpose TEXT NOT NULL CHECK(purpose IN('PERSONAL','PAID_CAMPAIGN')),
 mode TEXT NOT NULL CHECK(mode IN('ALLSTATUS','ALLCHAT','DOUBLE')),campaign_id TEXT REFERENCES house_campaigns(id),
 caption TEXT NOT NULL,target_url TEXT NOT NULL,asset_id TEXT REFERENCES broadcast_assets(id),preview_json TEXT NOT NULL DEFAULT 'null',
 status TEXT NOT NULL CHECK(status IN('QUEUED','RUNNING','FINISHED','CANCELLED')),created_at TEXT NOT NULL,
 CHECK((purpose='PERSONAL' AND campaign_id IS NULL) OR (purpose='PAID_CAMPAIGN' AND campaign_id IS NOT NULL)));
CREATE TRIGGER IF NOT EXISTS broadcast_purpose_immutable BEFORE UPDATE OF purpose,campaign_id,user_id,mode,caption,target_url,asset_id,preview_json ON broadcast_runs BEGIN SELECT RAISE(ABORT,'Broadcast instructions are immutable');END;
CREATE TABLE IF NOT EXISTS broadcast_targets(
 id TEXT PRIMARY KEY,run_id TEXT NOT NULL REFERENCES broadcast_runs(id),account_id TEXT NOT NULL REFERENCES paired_accounts(id),group_jid TEXT NOT NULL,
 member_snapshot INTEGER NOT NULL,base_reward_milli INTEGER NOT NULL DEFAULT 0,
 UNIQUE(run_id,group_jid));
CREATE TABLE IF NOT EXISTS paid_group_claims(campaign_id TEXT NOT NULL REFERENCES house_campaigns(id),group_jid TEXT NOT NULL,target_id TEXT NOT NULL UNIQUE REFERENCES broadcast_targets(id),PRIMARY KEY(campaign_id,group_jid));
CREATE TABLE IF NOT EXISTS broadcast_placements(
 id TEXT PRIMARY KEY,target_id TEXT NOT NULL REFERENCES broadcast_targets(id),surface TEXT NOT NULL CHECK(surface IN('GROUP_STATUS','GROUP_CHAT')),
 status TEXT NOT NULL CHECK(status IN('RESERVED','SENDING','ACCEPTED','CONFIRMED','FAILED','UNKNOWN','CANCELLED')),
 reward_milli INTEGER NOT NULL DEFAULT 0 CHECK(typeof(reward_milli)='integer' AND reward_milli BETWEEN 0 AND 1000),
 provider_message_id TEXT UNIQUE,receipt_id TEXT UNIQUE,created_at TEXT NOT NULL,sent_at TEXT,confirmed_at TEXT,failure_reason TEXT,UNIQUE(target_id,surface));
CREATE TABLE IF NOT EXISTS broadcast_request_keys(user_id TEXT NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,payload_hash TEXT NOT NULL,run_id TEXT NOT NULL REFERENCES broadcast_runs(id),PRIMARY KEY(user_id,request_key));
CREATE TRIGGER IF NOT EXISTS personal_no_paid_placements BEFORE INSERT ON broadcast_placements WHEN NEW.reward_milli<>0 AND EXISTS(SELECT 1 FROM broadcast_targets t JOIN broadcast_runs r ON r.id=t.run_id WHERE t.id=NEW.target_id AND r.purpose='PERSONAL') BEGIN SELECT RAISE(ABORT,'Personal broadcasts never earn money');END;
CREATE TRIGGER IF NOT EXISTS broadcast_target_immutable BEFORE UPDATE OF run_id,account_id,group_jid,member_snapshot,base_reward_milli ON broadcast_targets BEGIN SELECT RAISE(ABORT,'Broadcast target and reward instructions are immutable');END;
CREATE TRIGGER IF NOT EXISTS broadcast_placement_immutable BEFORE UPDATE OF target_id,surface,reward_milli ON broadcast_placements BEGIN SELECT RAISE(ABORT,'Placement surface and reward instructions are immutable');END;
CREATE INDEX IF NOT EXISTS broadcast_runs_owner_time ON broadcast_runs(user_id,created_at);
CREATE INDEX IF NOT EXISTS broadcast_placements_state ON broadcast_placements(status,created_at);
`);
  db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES(3,?)").run(
    new Date().toISOString(),
  );
}
