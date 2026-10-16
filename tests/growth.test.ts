import test from "node:test";
import assert from "node:assert/strict";
import {
  fixture,
  input,
  draft,
  verified,
  accepted,
  inventory,
  running,
  iso,
} from "./growth-fixtures";
import {
  validateGrowthInput,
  requestRegion,
  GROWTH_PRODUCTS,
} from "../shared/growthRules";
import * as g from "../backend/growth";
import { reconcileTreasury } from "../backend/earning";

test("four products enforce integer ranges, HTTPS links, terms and Telegram restrictions", () => {
  for (const [product, r] of Object.entries(GROWTH_PRODUCTS)) {
    const base = input({
      product: product as any,
      destination:
        product === "WA_GROUP"
          ? input().destination
          : product === "WA_CHANNEL"
            ? "https://whatsapp.com/channel/SyntheticChannel123"
            : "https://t.me/SyntheticChannel",
      contactPhone: "+2348000000000",
      quantity: r.min,
    });
    for (const quantity of [r.min, r.min + 1, r.max])
      assert.equal(
        validateGrowthInput({ ...base, quantity }).quantity,
        quantity,
      );
    for (const quantity of [r.min - 1, r.max + 1, r.min + 0.5, NaN, "200"])
      assert.throws(() => validateGrowthInput({ ...base, quantity }));
  }
  for (const destination of [
    "http://chat.whatsapp.com/SyntheticInvite123",
    "https://chat.whatsapp.com.evil.test/SyntheticInvite123",
    "https://user@chat.whatsapp.com/SyntheticInvite123",
    "https://chat.whatsapp.com/SyntheticInvite123#hidden",
    "https://127.0.0.1/a",
  ])
    assert.throws(() => validateGrowthInput(input({ destination })));
  assert.throws(
    () =>
      validateGrowthInput(
        input({
          product: "TG_GROUP",
          destination: "https://t.me/SyntheticGroup",
          countries: ["NG"],
        }),
      ),
    /Telegram/,
  );
  assert.equal(
    validateGrowthInput(input({ termsVersion: 0 })).acknowledged,
    false,
  );
  assert.equal(requestRegion("+2348000000000"), "NG");
  assert.equal(requestRegion("233800000000@s.whatsapp.net"), "GH");
  for (const value of ["+12125551234", "123456789@lid", "not-a-number"])
    assert.equal(requestRegion(value), undefined);
});
test("save is idempotent, body-bound, owner-bound and optimistic revision protected", () => {
  const db = fixture();
  try {
    const b = input(),
      o = g.saveGrowth(db, "buyer", b, "key-123456");
    assert.equal(g.saveGrowth(db, "buyer", b, "key-123456").id, o.id);
    assert.throws(
      () =>
        g.saveGrowth(
          db,
          "buyer",
          { ...b, title: "Changed title" },
          "key-123456",
        ),
      /different/,
    );
    assert.throws(
      () =>
        g.saveGrowth(db, "other", { ...b, revision: 1 }, "key-update", o.id),
      /not found/,
    );
    const edited = g.saveGrowth(
      db,
      "buyer",
      { ...b, title: "New saved title", revision: 1 },
      "key-update",
      o.id,
    );
    assert.equal(edited.revision, 2);
    assert.throws(
      () =>
        g.saveGrowth(db, "buyer", { ...b, revision: 1 }, "key-update", o.id),
      /changed/,
    );
    assert.throws(
      () => g.saveGrowth(db, "worker", b, "key-worker"),
      /Advertiser/,
    );
    assert.equal(
      (db.prepare("SELECT COUNT(*) n FROM growth_orders").get() as any).n,
      1,
    );
    assert.equal(reconcileTreasury(db).ok, true);
  } finally {
    db.close();
  }
});
test("submission requires current terms; submitted details cannot be edited; events append only", () => {
  const db = fixture();
  try {
    const o = draft(db, { acknowledged: false });
    assert.throws(() => g.submitGrowth(db, "buyer", o.id, 1), /accept/);
    const r = g.saveGrowth(
      db,
      "buyer",
      { ...input(), revision: 1 },
      "key-update",
      o.id,
    );
    g.submitGrowth(db, "buyer", o.id, r.revision);
    assert.equal(
      g.submitGrowth(db, "buyer", o.id, r.revision).status,
      "REVIEW",
    );
    assert.throws(
      () =>
        g.saveGrowth(
          db,
          "buyer",
          { ...input(), revision: 2 },
          "key-update",
          o.id,
        ),
      /locked/,
    );
    assert.throws(
      () => db.exec("UPDATE growth_events SET message='tampered'"),
      /append-only/,
    );
    assert.throws(() => db.exec("DELETE FROM growth_events"), /append-only/);
  } finally {
    db.close();
  }
});
test("manual verification retains staff-only evidence without presenting provider certification", () => {
  const db = fixture();
  try {
    const o = verified(db);
    assert.equal(o.status, "VERIFIED");
    assert.equal(o.accessEvidence!.length, 1);
    assert.match(o.accessEvidence![0].note, /SYNTHETIC/);
    assert.equal("accessEvidence" in g.growthDetail(db, o.id, "buyer"), false);
    assert.throws(
      () => g.setGrowthPrice(db, "buyer", "WA_GROUP", {}),
      /Administrator/,
    );
    assert.throws(
      () => db.exec("UPDATE growth_access_evidence SET note='forged'"),
      /append-only/,
    );
  } finally {
    db.close();
  }
});
test("verification expiry blocks progression and leaves service contacts busy until removal", () => {
  const db = fixture();
  try {
    let o = draft(db);
    g.submitGrowth(db, "buyer", o.id, 1);
    const ids = ["One", "Two"].map(
      (label, i) =>
        g.addGrowthAdmin(db, "admin", {
          label,
          phone: "+23480000000" + i,
          platform: "WA",
        }).id,
    );
    o = g.assignGrowthAdmins(db, "admin", o.id, ids);
    assert.throws(
      () =>
        g.recordGrowthVerification(db, "admin", o.id, {
          code: "WRONG",
          permissionsChecked: true,
          note: "SYNTHETIC evidence note",
        }),
      /matching/,
    );
    g.maintenanceGrowth(db, true, Date.now() + 11 * 60000);
    o = g.growthDetail(db, o.id, "admin", true);
    assert.equal(o.status, "REVIEW");
    assert.ok(o.assignments.every((a: any) => a.state === "LEAVE_REQUIRED"));
    assert.throws(
      () => g.assignGrowthAdmins(db, "admin", o.id, ids),
      /assignment/,
    );
    for (const a of o.assignments) g.confirmGrowthLeave(db, "admin", a.id);
    assert.throws(
      () => g.assignGrowthAdmins(db, "admin", o.id, ids),
      /resting/,
    );
  } finally {
    db.close();
  }
});
test("inventory is fresh, permissioned, opted-in, voluntary, shared-group deduplicated and fair across workers", () => {
  const db = fixture();
  try {
    const a = inventory(db, "worker", 1, [
      "120363000000000001@g.us",
      "120363000000000002@g.us",
      "120363000000000003@g.us",
    ]);
    inventory(db, "worker", 2);
    inventory(db, "worker2", 1, ["120363000000000004@g.us"]);
    let inv = g.growthInventory(db, "WA_GROUP", []);
    assert.equal(inv.distinctGroups, 4);
    assert.equal(inv.groups[0].ownerId, "worker");
    assert.equal(inv.groups[1].ownerId, "worker2");
    g.setGrowthWorkerShift(db, "worker", 0);
    assert.equal(g.growthInventory(db, "WA_GROUP", []).distinctGroups, 1);
    g.setGrowthWorkerShift(db, "worker", 60);
    db.prepare("UPDATE group_inventory SET synced_at=? WHERE account_id=?").run(
      iso(-16 * 60000),
      a,
    );
    assert.equal(g.growthInventory(db, "WA_GROUP", []).distinctGroups, 2);
    db.prepare("UPDATE wa_slots SET paid_opt_in=0").run();
    assert.equal(g.growthInventory(db, "WA_GROUP", []).distinctGroups, 0);
    assert.equal(
      g.growthInventory(db, "TG_GROUP", []).availability,
      "UNAVAILABLE",
    );
  } finally {
    db.close();
  }
});
test("country inventory is unavailable until explicit policy and permitted matching sample, never silently broadened", () => {
  const db = fixture();
  try {
    const accountId = inventory(db);
    assert.equal(g.growthInventory(db, "WA_CHANNEL", ["NG"]).distinctGroups, 0);
    g.setGrowthAudiencePolicy(db, "admin", {
      minSample: 25,
      minMatchBps: 8000,
      maxAgeHours: 24,
      revision: 1,
    });
    assert.throws(
      () =>
        g.setGrowthAudiencePolicy(db, "admin", {
          minSample: 25,
          minMatchBps: 8000,
          maxAgeHours: 24,
          revision: 1,
        }),
      /changed/,
    );
    const sample = {
      accountId,
      groupJid: "120363000000000001@g.us",
      country: "NG",
      sampleTotal: 25,
      matching: 20,
      source: "DECLARED_AUDIENCE",
      evidenceNote: "SYNTHETIC permitted aggregate sample only.",
    };
    g.recordGrowthAudience(db, "admin", sample);
    assert.equal(g.growthInventory(db, "WA_CHANNEL", ["NG"]).distinctGroups, 0);
    g.recordGrowthAudience(db, "admin", {
      ...sample,
      source: "PERMITTED_PREFIX_SAMPLE",
    });
    assert.equal(g.growthInventory(db, "WA_CHANNEL", ["NG"]).distinctGroups, 1);
    assert.equal(g.growthInventory(db, "WA_CHANNEL", ["GH"]).distinctGroups, 0);
    db.prepare("UPDATE growth_audiences SET observed_at=?").run(
      iso(-25 * 3600000),
    );
    assert.equal(g.growthInventory(db, "WA_CHANNEL", ["NG"]).distinctGroups, 0);
  } finally {
    db.close();
  }
});
test("unset prices, insufficient worker reserve and margin fail closed; accepted quotes stay immutable", () => {
  const db = fixture();
  try {
    const o = verified(db);
    inventory(db);
    const body = { plannedGroups: 1, workerBudgetMilli: 1000, feeKobo: 0 };
    assert.throws(() => g.createGrowthQuote(db, "admin", o.id, body), /price/);
    g.setGrowthPrice(db, "admin", "WA_GROUP", {
      unitKobo: 1,
      baseKobo: 0,
      urgentBps: 10000,
      revision: 1,
    });
    assert.throws(() => g.createGrowthQuote(db, "admin", o.id, body), /margin/);
    g.setGrowthPrice(db, "admin", "WA_GROUP", {
      unitKobo: 100,
      baseKobo: 0,
      urgentBps: 12500,
      revision: 2,
    });
    assert.throws(
      () =>
        g.createGrowthQuote(db, "admin", o.id, {
          ...body,
          workerBudgetMilli: 999,
        }),
      /full/,
    );
    const q = g.createGrowthQuote(db, "admin", o.id, body);
    assert.equal(q.quote!.amountKobo, 20000);
    g.acceptGrowthQuote(db, "buyer", o.id, q.quote!.id);
    g.setGrowthPrice(db, "admin", "WA_GROUP", {
      unitKobo: 999,
      baseKobo: 0,
      urgentBps: 12500,
      revision: 3,
    });
    assert.equal(g.growthDetail(db, o.id, "buyer").quote!.amountKobo, 20000);
    assert.throws(
      () => db.exec("UPDATE growth_quotes SET amount_kobo=1"),
      /immutable/,
    );
    assert.equal(reconcileTreasury(db).treasury.cash_milli, 0);
    assert.equal(g.growthReadiness().liveDispatch, false);
  } finally {
    db.close();
  }
});
test("baseline pending, re-requests, approval and out-of-order events never double count or erase legitimate credit", () => {
  const db = fixture();
  try {
    const o = draft(db);
    const hash = g.participantDigest(
      "SYNTHETIC persistent long identity key",
      "one",
    );
    g.recordGrowthRequest(db, o.id, {
      participantHash: hash,
      status: "PENDING",
      baseline: true,
      observedAt: iso(-300000),
    });
    db.prepare(
      "UPDATE growth_orders SET status='RUNNING',started_at=?,deadline_at=? WHERE id=?",
    ).run(iso(-120000), iso(3600000), o.id);
    assert.equal(
      g.recordGrowthRequest(db, o.id, {
        participantHash: hash,
        status: "APPROVED",
        observedAt: iso(-30000),
      }).counted,
      false,
    );
    const h = g.participantDigest(
      "SYNTHETIC persistent long identity key",
      "two",
    );
    assert.equal(
      g.recordGrowthRequest(db, o.id, {
        participantHash: h,
        status: "PENDING",
        observedAt: iso(-20000),
      }).counted,
      true,
    );
    for (const status of ["APPROVED", "CANCELLED", "PENDING"] as const)
      assert.equal(
        g.recordGrowthRequest(db, o.id, {
          participantHash: h,
          status,
          observedAt: iso(-10000),
        }).counted,
        false,
      );
    assert.equal(g.growthDetail(db, o.id, "buyer").delivered, 1);
    assert.throws(
      () =>
        g.recordGrowthRequest(db, o.id, {
          participantHash: "f".repeat(64),
          status: "PENDING",
          baseline: true,
          observedAt: iso(),
        }),
      /closed/,
    );
  } finally {
    db.close();
  }
});
test("unknown phone is not guessed; later trusted region metadata can credit once, non-matches suggest rejection", () => {
  const db = fixture();
  try {
    const id = running(db, { countries: ["NG"] });
    const h = "a".repeat(64);
    assert.equal(
      g.recordGrowthRequest(db, id, {
        participantHash: h,
        status: "PENDING",
        observedAt: iso(-30000),
      }).counted,
      false,
    );
    assert.equal(
      g.recordGrowthRequest(db, id, {
        participantHash: h,
        status: "PENDING",
        phone: "+2348000000000",
        observedAt: iso(-20000),
      }).counted,
      true,
    );
    assert.equal(
      g.recordGrowthRequest(db, id, {
        participantHash: h,
        status: "APPROVED",
        phone: "+2348000000000",
        observedAt: iso(-10000),
      }).counted,
      false,
    );
    const bad = g.recordGrowthRequest(db, id, {
      participantHash: "b".repeat(64),
      status: "PENDING",
      phone: "+233800000000",
      observedAt: iso(-15000),
    });
    assert.equal(bad.rejectSuggested, true);
    assert.equal(
      g.recordGrowthRequest(db, id, {
        participantHash: "c".repeat(64),
        status: "PENDING",
        phone: "+12125551234",
        observedAt: iso(-15000),
      }).counted,
      false,
    );
    assert.equal(g.growthDetail(db, id, "buyer").delivered, 1);
  } finally {
    db.close();
  }
});
test("timestamp offsets normalize to UTC; channel growth uses latest minus baseline rather than positive-change sums", () => {
  const db = fixture();
  try {
    const id = running(db, {
      product: "WA_CHANNEL",
      quantity: 500,
      destination: "https://whatsapp.com/channel/SyntheticChannel",
      contactPhone: "+2348000000000",
    });
    const t = Date.now() - 60000;
    const offset = new Date(t + 3600000).toISOString().replace("Z", "+01:00");
    assert.equal(
      g.recordGrowthCount(db, id, {
        providerEvent: "one",
        count: 1100,
        observedAt: offset,
      }).delivered,
      100,
    );
    assert.equal(
      g.recordGrowthCount(db, id, {
        providerEvent: "two",
        count: 1050,
        observedAt: new Date(t + 1000).toISOString(),
      }).delivered,
      50,
    );
    assert.equal(
      g.recordGrowthCount(db, id, {
        providerEvent: "old",
        count: 1400,
        observedAt: new Date(t - 1000).toISOString(),
      }).ignored,
      true,
    );
    assert.equal(
      g.recordGrowthCount(db, id, {
        providerEvent: "two",
        count: 1400,
        observedAt: new Date(t + 2000).toISOString(),
      }).ignored,
      true,
    );
    assert.equal(g.growthDetail(db, id, "buyer").delivered, 50);
    db.prepare("UPDATE growth_orders SET baseline_count=NULL WHERE id=?").run(
      id,
    );
    assert.throws(
      () =>
        g.recordGrowthCount(db, id, {
          providerEvent: "no-baseline",
          count: 1400,
          observedAt: iso(),
        }),
      /baseline/,
    );
  } finally {
    db.close();
  }
});
test("target fulfillment stops unstarted batches, retains legitimate requests, and requires service access removal", () => {
  const db = fixture();
  try {
    const o = verified(db);
    db.prepare(
      "UPDATE growth_orders SET status='RUNNING',started_at=?,deadline_at=? WHERE id=?",
    ).run(iso(-120000), iso(3600000), o.id);
    for (let i = 0; i < 200; i++)
      g.recordGrowthRequest(db, o.id, {
        participantHash: i.toString(16).padStart(64, "0"),
        status: "PENDING",
        observedAt: iso(-1000),
      });
    let d = g.growthDetail(db, o.id, "buyer");
    assert.equal(d.delivered, 200);
    assert.equal(d.status, "COMPLETING");
    assert.ok(d.assignments.every((a: any) => a.state === "LEAVE_REQUIRED"));
    for (const a of d.assignments) g.confirmGrowthLeave(db, "admin", a.id);
    d = g.growthDetail(db, o.id, "buyer");
    assert.equal(d.status, "COMPLETED");
    assert.equal(d.delivered, 200);
    assert.equal(reconcileTreasury(db).treasury.cash_milli, 0);
  } finally {
    db.close();
  }
});
test("deadline pauses; only buyer consent resumes; decline never spends, resets target, or invents a refund", () => {
  const db = fixture();
  try {
    const id = running(db);
    g.maintenanceGrowth(db, true, Date.now() + 2 * 3600000);
    assert.equal(g.growthDetail(db, id, "buyer").status, "EXTENSION_REQUIRED");
    const offer = g.proposeGrowthExtension(db, "admin", id, {
      expectedAt: iso(4 * 3600000),
      note: "SYNTHETIC offer of more time, same price.",
    });
    assert.throws(
      () => g.decideGrowthExtension(db, "other", id, offer.id, true),
      /not found/,
    );
    g.decideGrowthExtension(db, "buyer", id, offer.id, false);
    assert.equal(g.growthDetail(db, id, "buyer").status, "EXTENSION_REQUIRED");
    const second = g.proposeGrowthExtension(db, "admin", id, {
      expectedAt: iso(5 * 3600000),
      note: "SYNTHETIC optional additional time only.",
    });
    const before = db.prepare("SELECT COUNT(*) n FROM ledger").get();
    g.decideGrowthExtension(db, "buyer", id, second.id, true);
    assert.equal(g.growthDetail(db, id, "buyer").status, "RUNNING");
    assert.equal(g.growthDetail(db, id, "buyer").input.quantity, 200);
    assert.deepEqual(db.prepare("SELECT COUNT(*) n FROM ledger").get(), before);
    assert.throws(
      () => g.decideGrowthExtension(db, "buyer", id, second.id, true),
      /available/,
    );
  } finally {
    db.close();
  }
});
test("voluntary shifts validate role and expire without modifying legacy paid opt-in", () => {
  const db = fixture();
  try {
    inventory(db);
    g.setGrowthWorkerShift(db, "worker", 0);
    assert.equal(g.growthWorkerShift(db, "worker").available, false);
    assert.equal(
      (db.prepare("SELECT paid_opt_in FROM wa_slots").get() as any).paid_opt_in,
      1,
    );
    assert.throws(() => g.setGrowthWorkerShift(db, "buyer", 60), /Worker/);
    assert.throws(() => g.setGrowthWorkerShift(db, "worker", 59), /Choose/);
    g.setGrowthWorkerShift(db, "worker", 30);
    assert.equal(g.growthWorkerShift(db, "worker").available, true);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});

test("unresolvable +1 regions are unavailable for group qualification; declared evidence cannot masquerade as a permitted prefix sample", () => {
  const db = fixture();
  try {
    const accountId = inventory(db);
    g.setGrowthAudiencePolicy(db, "admin", {
      minSample: 25,
      minMatchBps: 8000,
      maxAgeHours: 24,
      revision: 1,
    });
    assert.equal(
      g.growthInventory(db, "WA_GROUP", ["US"]).availability,
      "UNAVAILABLE",
    );
    assert.throws(
      () =>
        g.recordGrowthAudience(db, "admin", {
          accountId,
          groupJid: "120363000000000001@g.us",
          country: "US",
          sampleTotal: 100,
          matching: 90,
          source: "PERMITTED_PREFIX_SAMPLE",
          evidenceNote: "SYNTHETIC evidence cannot resolve a shared prefix.",
        }),
      /unambiguously/,
    );
    assert.throws(() => g.growthWorkspace(db, "buyer", true), /Administrator/);
  } finally {
    db.close();
  }
});

test("primary and backup cannot be duplicate registrations of the same service phone", () => {
  const db = fixture();
  try {
    const contact = {
      label: "SYNTHETIC contact",
      phone: "+2348000000011",
      platform: "WA",
    };
    g.addGrowthAdmin(db, "admin", contact);
    assert.throws(
      () =>
        g.addGrowthAdmin(db, "admin", {
          ...contact,
          label: "Duplicate disguised label",
        }),
      /already registered/,
    );
    assert.throws(
      () =>
        db
          .prepare(
            "INSERT INTO growth_service_admins(id,label,phone,platform,enabled,created_at) VALUES(?,?,?,?,1,?)",
          )
          .run("duplicate", "Other", contact.phone, "WA", iso()),
      /UNIQUE/,
    );
  } finally {
    db.close();
  }
});

test("growth planning keeps the exact 100-member earning minimum and has no 100-group owner ceiling", () => {
  const db = fixture();
  try {
    const jids = Array.from(
      { length: 107 },
      (_, i) => `${120363000000100000n + BigInt(i)}@g.us`,
    );
    inventory(
      db,
      "worker",
      1,
      jids,
      jids.map((_, i) => (i === 0 ? 99 : i === 1 ? 100 : 1000)),
    );
    const inv = g.growthInventory(db, "WA_GROUP", []);
    assert.equal(inv.distinctGroups, 106);
    assert.equal(
      inv.groups.find((v: any) => v.members === 100)?.workerMilli,
      100,
    );
    assert.ok(
      inv.groups.every((v: any) => v.members >= 100 && v.workerMilli <= 1000),
    );
    db.prepare("UPDATE group_inventory SET announce=1,user_is_admin=0").run();
    assert.equal(g.growthInventory(db, "WA_GROUP", []).distinctGroups, 0);
  } finally {
    db.close();
  }
});

test("readiness never enables live capabilities and agrees with sandbox credential-prefix/length checks", () => {
  const keys = [
    "SQUAD_SANDBOX_SECRET",
    "KORA_SANDBOX_SECRET",
    "TELEGRAM_BOT_TOKEN",
  ];
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  try {
    process.env.SQUAD_SANDBOX_SECRET = "live_sk_SYNTHETIC";
    process.env.KORA_SANDBOX_SECRET = "sk_test_12345678";
    process.env.TELEGRAM_BOT_TOKEN =
      "SYNTHETIC-config-presence-is-not-an-adapter";
    let ready = g.growthReadiness();
    assert.equal(ready.providers.SQUAD.configured, false);
    assert.equal(ready.providers.KORA.configured, false);
    assert.equal(ready.telegramConfigured, false);
    process.env.SQUAD_SANDBOX_SECRET = "sandbox_sk_" + "x".repeat(12);
    process.env.KORA_SANDBOX_SECRET = "sk_test_" + "x".repeat(12);
    ready = g.growthReadiness();
    assert.equal(ready.providers.SQUAD.configured, true);
    assert.equal(ready.providers.KORA.configured, true);
    assert.equal(ready.livePayments, false);
    assert.equal(ready.liveDispatch, false);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
