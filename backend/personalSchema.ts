import type { DatabaseSync } from "node:sqlite";
export function migratePersonalSchema(db: DatabaseSync) {
  db.exec(`
CREATE TABLE IF NOT EXISTS personal_ignored_groups(user_id TEXT NOT NULL REFERENCES users(id),group_jid TEXT NOT NULL,subject TEXT NOT NULL,invite_hash TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,group_jid));
CREATE TABLE IF NOT EXISTS personal_drafts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),payload_json TEXT NOT NULL,plan_json TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,consumed_run TEXT REFERENCES broadcast_runs(id));
CREATE TABLE IF NOT EXISTS personal_run_options(run_id TEXT PRIMARY KEY REFERENCES broadcast_runs(id),background_color TEXT NOT NULL,font INTEGER NOT NULL DEFAULT 0,skips_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS broadcast_events(id INTEGER PRIMARY KEY AUTOINCREMENT,run_id TEXT NOT NULL REFERENCES broadcast_runs(id),event_key TEXT NOT NULL,placement_id TEXT REFERENCES broadcast_placements(id),group_jid TEXT,group_name TEXT,kind TEXT NOT NULL,message TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(run_id,event_key));
CREATE INDEX IF NOT EXISTS personal_drafts_owner ON personal_drafts(user_id,created_at);
CREATE INDEX IF NOT EXISTS broadcast_events_cursor ON broadcast_events(run_id,id);
CREATE TRIGGER IF NOT EXISTS personal_run_options_immutable BEFORE UPDATE ON personal_run_options BEGIN SELECT RAISE(ABORT,'Personal run options are immutable');END;
`);
  db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES(4,?)").run(
    new Date().toISOString(),
  );
}
