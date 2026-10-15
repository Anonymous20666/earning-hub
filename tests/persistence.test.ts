import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDatabase, transaction } from "../backend/database";

test("database survives restart, rollback is atomic, backup restores", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pappy-db-"));
  try {
    const file = path.join(dir, "database.sqlite");
    let db = openDatabase(file);
    db.prepare(
      "INSERT INTO users(id,email,name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)",
    ).run(
      "u1",
      "persistence@example.test",
      "Persistence",
      "salt:hash",
      "EARNER",
      new Date().toISOString(),
    );
    assert.throws(() =>
      transaction(db, () => {
        db.prepare("INSERT INTO wallets(user_id) VALUES(?)").run("u1");
        throw new Error("Abort operation");
      }),
    );
    assert.equal(
      (db.prepare("SELECT COUNT(*) AS count FROM wallets").get() as any).count,
      0,
    );
    db.prepare("INSERT INTO wallets(user_id) VALUES(?)").run("u1");
    db.close();
    db = openDatabase(file);
    assert.equal(
      (
        db
          .prepare("SELECT locked_milli FROM wallets WHERE user_id=?")
          .get("u1") as any
      ).locked_milli,
      200000,
    );
    const backup = path.join(dir, "backup.sqlite");
    db.prepare("VACUUM INTO ?").run(backup);
    db.close();
    const restored = openDatabase(backup);
    assert.equal(
      Object.values(restored.prepare("PRAGMA integrity_check").get()!)[0],
      "ok",
    );
    assert.equal(
      (restored.prepare("SELECT email FROM users WHERE id=?").get("u1") as any)
        .email,
      "persistence@example.test",
    );
    restored.close();
    assert.equal(statSync(file).mode & 0o777, 0o600);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
