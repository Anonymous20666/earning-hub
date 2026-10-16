import { migrateGrowthCreative } from "./growthCreativeSchema";
import { migrateGrowthSchema } from "./growthSchema";
import { migratePreviewCache } from "./previewEngine";
import { migratePersonalPacing } from "./personalPacing";
import { migrateNativePostingSchema } from "./nativePostingSchema";
import { migrateReferralSchema } from "./referralSchema";
import { migratePersonalSchema } from "./personalSchema";
import { migrateBroadcastSchema } from "./broadcastSchema";
import { migrateEarningSchema } from "./earningSchema";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import path from "node:path";

export function openDatabase(filename: string) {
  if (filename !== ":memory:") {
    mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  }
  const db = new DatabaseSync(filename);
  if (filename !== ":memory:") chmodSync(filename, 0o600);
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL, password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('EARNER','ADVERTISER','ADMIN')),
      email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified IN (0,1)),
      created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS wallets(
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      locked_milli INTEGER NOT NULL DEFAULT 200000 CHECK(locked_milli >= 0),
      earned_milli INTEGER NOT NULL DEFAULT 0 CHECK(earned_milli >= 0),
      withdrawn_milli INTEGER NOT NULL DEFAULT 0 CHECK(withdrawn_milli >= 0),
      bonus_claimed INTEGER NOT NULL DEFAULT 0 CHECK(bonus_claimed IN (0,1)));
    CREATE TABLE IF NOT EXISTS ledger(
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL, amount_milli INTEGER NOT NULL, idempotency_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS campaigns(
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL, payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT')),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tickets(
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      subject TEXT NOT NULL, message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','REPLIED','RESOLVED')),
      reply TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(
      id INTEGER PRIMARY KEY, user_id TEXT, action TEXT NOT NULL, entity_id TEXT, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS campaigns_owner ON campaigns(user_id);
    CREATE INDEX IF NOT EXISTS tickets_owner ON tickets(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    INSERT OR IGNORE INTO schema_migrations VALUES(1, datetime('now'));
  `);
  migrateEarningSchema(db);
  migrateBroadcastSchema(db);
  migratePersonalSchema(db);
  migrateReferralSchema(db);
  migrateNativePostingSchema(db);
  migratePersonalPacing(db);
  migratePreviewCache(db);
  migrateGrowthSchema(db);
  migrateGrowthCreative(db);
  return db;
}
export type Database = ReturnType<typeof openDatabase>;
export function transaction<T>(db: Database, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
