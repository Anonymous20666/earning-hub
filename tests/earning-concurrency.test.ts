import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { openDatabase } from "../backend/database";
import {
  recordVerifiedFunding,
  createHouseCampaign,
  fundHouseCampaign,
  markSending,
  reconcileTreasury,
} from "../backend/earning";
import {
  recordProviderPairing,
  syncProviderInventory,
  recordVerifiedGroupPermission,
} from "../backend/inventory";
function setup() {
  const dir = mkdtempSync(path.join(tmpdir(), "pappy-race-")),
    file = path.join(dir, "synthetic.sqlite"),
    db = openDatabase(file),
    now = new Date().toISOString();
  for (const [id, role] of [
    ["admin", "ADMIN"],
    ["worker", "EARNER"],
  ])
    db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?)").run(
      id,
      id + "@example.test",
      id,
      "synthetic",
      role,
      0,
      now,
    );
  db.prepare("INSERT INTO wallets(user_id) VALUES('worker')").run();
  db.prepare("UPDATE broadcast_settings SET dispatch_enabled=1").run();
  recordVerifiedFunding(db, {
    adminId: "admin",
    amountMilli: 1000000,
    source: "OWNER_CAPITAL",
    reference: "synthetic-race-reference",
    evidenceNote:
      "SYNTHETIC cleared funds for isolated concurrency tests only.",
  });
  for (const slot of [1, 2] as const) {
    const a = recordProviderPairing(db, {
      userId: "worker",
      slot,
      providerJid: `234800000001${slot}@s.whatsapp.net`,
      hashKey: "synthetic-concurrency-fixture-key-32-plus",
    });
    syncProviderInventory(
      db,
      a.id,
      [
        {
          jid: "120363000000000021@g.us",
          subject: "SYNTHETIC shared group",
          memberCount: 256,
          announce: false,
          userIsAdmin: false,
        },
      ],
      true,
    );
  }
  recordVerifiedGroupPermission(db, {
    groupJid: "120363000000000021@g.us",
    approverHash: "b".repeat(64),
    consentReference: "SYNTHETIC approval only",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  const c = createHouseCampaign(db, {
    adminId: "admin",
    title: "Synthetic race campaign",
    message: "Synthetic content; never externally sent.",
    targetUrl: "https://example.test",
    rewardBudgetMilli: 10000,
  });
  fundHouseCampaign(db, c.id, "admin");
  db.close();
  return { dir, file, c: c.id };
}
function run(file: string, mode: string, id: string, at: number) {
  return new Promise<any>((resolve, reject) => {
    const p = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        "tests/fixtures/earning-race.ts",
        file,
        mode,
        id,
        String(at),
      ],
      { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "",
      stderr = "";
    p.stdout.on("data", (b) => (stdout += b));
    p.stderr.on("data", (b) => (stderr += b));
    p.once("error", reject);
    p.once("exit", (code) => {
      if (code) reject(Error(stderr || stdout));
      else {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          reject(Error(stdout + stderr));
        }
      }
    });
  });
}
test("independent concurrent processes cannot reserve or credit the same shared group twice", async () => {
  const f = setup();
  try {
    const start = Date.now() + 600;
    const results = await Promise.all([
      run(f.file, "reserve", f.c, start),
      run(f.file, "reserve", f.c, start),
    ]);
    assert.equal(results.filter((r) => r.ok && r.result.job).length, 1);
    let db = openDatabase(f.file);
    assert.equal(
      (db.prepare("SELECT COUNT(*) n FROM delivery_jobs").get() as any).n,
      1,
    );
    const j = db.prepare("SELECT * FROM delivery_jobs").get() as any;
    markSending(db, j.id, "synthetic-concurrent-message");
    db.close();
    const receipts = await Promise.all([
      run(f.file, "settle", j.id, Date.now() + 600),
      run(f.file, "settle", j.id, Date.now() + 600),
    ]);
    assert.equal(
      receipts.filter((r) => r.ok && !r.result.idempotent).length,
      1,
    );
    assert.equal(receipts.filter((r) => r.ok && r.result.idempotent).length, 1);
    db = openDatabase(f.file);
    assert.equal(
      (
        db
          .prepare("SELECT earned_milli FROM wallets WHERE user_id='worker'")
          .get() as any
      ).earned_milli,
      256,
    );
    assert.equal(reconcileTreasury(db).ok, true);
    db.close();
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});
test("concurrent campaign funding cannot overspend the available treasury cash", async () => {
  const f = setup();
  try {
    let db = openDatabase(f.file);
    const a = createHouseCampaign(db, {
      adminId: "admin",
      title: "Synthetic race A",
      message: "Synthetic content only.",
      targetUrl: "https://example.test",
      rewardBudgetMilli: 600000,
    });
    const b = createHouseCampaign(db, {
      adminId: "admin",
      title: "Synthetic race B",
      message: "Synthetic content only.",
      targetUrl: "https://example.test",
      rewardBudgetMilli: 600000,
    });
    db.close();
    const at = Date.now() + 600;
    const results = await Promise.all([
      run(f.file, "fund", a.id, at),
      run(f.file, "fund", b.id, at),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(results.filter((r) => !r.ok).length, 1);
    db = openDatabase(f.file);
    assert.equal(
      (db.prepare("SELECT available_milli FROM treasury").get() as any)
        .available_milli,
      390000,
    );
    assert.equal(reconcileTreasury(db).ok, true);
    db.close();
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});
