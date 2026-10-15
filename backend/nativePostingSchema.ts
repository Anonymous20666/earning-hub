import type { DatabaseSync } from "node:sqlite";
export function migrateNativePostingSchema(db: DatabaseSync) {
  // A version marker, not a global permission switch. Existing queued runs retain
  // the consent contract under which they were reviewed/reserved.
  db.exec(`CREATE TABLE IF NOT EXISTS broadcast_native_policy(
    run_id TEXT PRIMARY KEY REFERENCES broadcast_runs(id),
    policy_version INTEGER NOT NULL CHECK(policy_version=1),
    account_ids_json TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS native_policy_immutable BEFORE UPDATE ON broadcast_native_policy BEGIN SELECT RAISE(ABORT,'Posting policy is immutable');END;`);
  db.prepare("INSERT OR IGNORE INTO schema_migrations VALUES(6,?)").run(
    new Date().toISOString(),
  );
}
