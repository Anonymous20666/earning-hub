import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDatabase } from "../backend/database";
import { reconcileTreasury } from "../backend/earning";
test("schema v1 upgrade preserves existing account/password/bonus/ledger and does not seed money or administrators", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pappy-migration-")),
    file = path.join(dir, "synthetic.sqlite");
  try {
    let old = new DatabaseSync(file);
    old.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
 INSERT INTO schema_migrations VALUES(1,'2026-10-15T00:00:00.000Z');
 CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL,email_verified INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
 CREATE TABLE wallets(user_id TEXT PRIMARY KEY REFERENCES users(id),locked_milli INTEGER NOT NULL DEFAULT 200000,earned_milli INTEGER NOT NULL DEFAULT 0,withdrawn_milli INTEGER NOT NULL DEFAULT 0,bonus_claimed INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,amount_milli INTEGER NOT NULL,idempotency_key TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);
 INSERT INTO users VALUES('preserved','preserved@example.test','Preserved synthetic account','unchanged-scrypt-fixture','EARNER',0,'2026-10-15T00:00:00.000Z');
 INSERT INTO wallets(user_id) VALUES('preserved');
 INSERT INTO ledger VALUES('original-ledger','preserved','LOCKED_REGISTRATION_BONUS',200000,'registration:preserved','2026-10-15T00:00:00.000Z');`);
    old.close();
    for (let run = 0; run < 2; run++) {
      const db = openDatabase(file);
      assert.equal(
        (db.prepare("SELECT COUNT(*) n FROM users").get() as any).n,
        1,
      );
      assert.equal(
        (db.prepare("SELECT password_hash FROM users").get() as any)
          .password_hash,
        "unchanged-scrypt-fixture",
      );
      assert.equal(
        (
          db
            .prepare("SELECT COUNT(*) n FROM users WHERE role='ADMIN'")
            .get() as any
        ).n,
        0,
      );
      assert.deepEqual(
        { ...db.prepare("SELECT * FROM wallets").get() },
        {
          user_id: "preserved",
          locked_milli: 200000,
          earned_milli: 0,
          withdrawn_milli: 0,
          bonus_claimed: 0,
          bonus_backed_milli: 0,
        },
      );
      assert.equal(
        (db.prepare("SELECT COUNT(*) n FROM ledger").get() as any).n,
        1,
      );
      assert.equal(
        (db.prepare("SELECT COUNT(*) n FROM schema_migrations").get() as any).n,
        8,
      );
      assert.equal(reconcileTreasury(db).ok, true);
      assert.equal(reconcileTreasury(db).treasury.cash_milli, 0);
      assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
      // Earlier web-release statements still work with the additive schema.
      db.prepare("UPDATE users SET name=? WHERE id=?").run(
        "Preserved synthetic account",
        "preserved",
      );
      db.prepare("SELECT * FROM wallets WHERE user_id=?").get("preserved");
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
