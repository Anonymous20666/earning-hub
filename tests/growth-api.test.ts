import test from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../backend/database";
import { createApp } from "../backend/app";
import { input } from "./growth-fixtures";
const db = openDatabase(":memory:");
let previewFetches = 0;
const app = createApp(db, {
  secureCookies: false,
  rateMax: 1000,
  personalPreviewer: async (url) => {
    previewFetches++;
    return {
      "matched-text": url,
      title: "SYNTHETIC API destination",
      description: "SYNTHETIC metadata fixture, no actual provider call.",
    };
  },
});
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const base = "http://127.0.0.1:" + (server.address() as any).port + "/api";
async function req(
  endpoint: string,
  method = "GET",
  body?: any,
  auth?: any,
  headers: any = {},
) {
  const response = await fetch(base + endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "PappyWeb",
      ...(auth ? { Cookie: auth.cookie, "X-CSRF-Token": auth.csrf } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}
async function register(name: string, role = "ADVERTISER") {
  const r = await req("/auth/register", "POST", {
    name,
    email: name + "-growth@example.test",
    password: "SYNTHETIC-only-long-password-2026!",
    role,
  });
  assert.equal(r.status, 201);
  return { ...r.body, cookie: r.headers.get("set-cookie")!.split(";")[0] };
}
let originalLedgerCount = 0;
let buyer: any, other: any, worker: any, admin: any, id: string;
test("growth endpoints reject anonymous callers and worker/admin cross-role access", async () => {
  for (const endpoint of ["/growth", "/admin/growth", "/growth-availability"])
    assert.equal((await req(endpoint)).status, 401);
  buyer = await register("Buyer");
  other = await register("Other");
  worker = await register("Worker", "EARNER");
  admin = await register("Admin");
  db.prepare("UPDATE users SET role='ADMIN' WHERE id=?").run(admin.user.id);
  originalLedgerCount = (
    db.prepare("SELECT COUNT(*) n FROM ledger").get() as any
  ).n;
  assert.equal((await req("/growth", "GET", undefined, worker)).status, 403);
  assert.equal(
    (await req("/admin/growth", "GET", undefined, buyer)).status,
    403,
  );
  assert.equal(
    (await req("/growth-availability", "GET", undefined, buyer)).status,
    403,
  );
  assert.equal(
    (await req("/admin/growth", "GET", undefined, admin)).status,
    200,
  );
});
test("draft APIs enforce CSRF, ownership, idempotency and body-bound replay", async () => {
  const b = input();
  assert.equal(
    (
      await req(
        "/growth",
        "POST",
        b,
        { ...buyer, csrf: "wrong" },
        { "Idempotency-Key": "api-key-synthetic" },
      )
    ).status,
    403,
  );
  const r = await req("/growth", "POST", b, buyer, {
    "Idempotency-Key": "api-key-synthetic",
  });
  assert.equal(r.status, 200);
  id = r.body.id;
  assert.equal(
    (
      await req("/growth", "POST", b, buyer, {
        "Idempotency-Key": "api-key-synthetic",
      })
    ).body.id,
    id,
  );
  assert.equal(
    (
      await req(
        "/growth",
        "POST",
        { ...b, title: "Different details" },
        buyer,
        { "Idempotency-Key": "api-key-synthetic" },
      )
    ).status,
    400,
  );
  for (const method of ["GET", "PUT"])
    assert.equal(
      (
        await req(
          "/growth/" + id,
          method,
          method === "PUT" ? { ...b, revision: 1 } : undefined,
          other,
          { "Idempotency-Key": "api-update-key" },
        )
      ).status,
      400,
    );
  assert.equal(
    (await req("/growth", "GET", undefined, other)).body.orders.length,
    0,
  );
  assert.equal(
    (await req("/growth/" + id + "/submit", "POST", { revision: 1 }, buyer))
      .body.status,
    "REVIEW",
  );
});
test("no advertiser endpoints accept counts, manual paid flags or live launch; report excludes participant identities", async () => {
  assert.equal(
    (await req("/growth/" + id + "/launch", "POST", {}, buyer)).status,
    503,
  );
  for (const action of ["count", "observe", "paid", "verify"])
    assert.equal(
      (
        await req(
          "/growth/" + id + "/" + action,
          "POST",
          { delivered: 2000, paid: true },
          buyer,
        )
      ).status,
      404,
    );
  const report = await req(
    "/growth/" + id + "/report",
    "GET",
    undefined,
    buyer,
  );
  assert.equal(report.status, 200);
  assert.equal(report.body.delivered, 0);
  assert.equal("participantHash" in report.body, false);
  assert.match(report.body.privacy, /not included/);
  assert.equal(
    (
      await req(
        "/growth/" + id + "/sandbox-checkout",
        "POST",
        { provider: "SQUAD" },
        buyer,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await req(
        "/growth-payments/growth_test_" + "0".repeat(32) + "/verify",
        "POST",
        {},
        other,
      )
    ).status,
    400,
  );
});
test("staff configuration and voluntary availability work without changing cash or existing broadcast settings", async () => {
  const price = await req(
    "/admin/growth-prices/WA_GROUP",
    "PUT",
    { unitKobo: 100, baseKobo: 0, urgentBps: 12500, revision: 1 },
    admin,
  );
  assert.equal(price.status, 200);
  assert.equal(
    (
      await req(
        "/admin/growth-prices/WA_GROUP",
        "PUT",
        { unitKobo: 100, baseKobo: 0, urgentBps: 12500, revision: 1 },
        admin,
      )
    ).status,
    400,
  );
  assert.equal(
    (await req("/growth-availability", "PUT", { minutes: 60 }, worker)).body
      .available,
    true,
  );
  assert.equal(
    (await req("/growth-availability", "PUT", { minutes: 0 }, worker)).body
      .available,
    false,
  );
  const readiness = (await req("/growth", "GET", undefined, buyer)).body
    .readiness;
  assert.equal(readiness.livePayments, false);
  assert.equal(readiness.liveDispatch, false);
  assert.equal(
    (db.prepare("SELECT COUNT(*) n FROM growth_payment_intents").get() as any)
      .n,
    0,
  );
  assert.equal(
    (db.prepare("SELECT COUNT(*) n FROM ledger").get() as any).n,
    originalLedgerCount,
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});
test("unauthenticated webhook cannot move money and uncertified Squad webhook fails closed", async () => {
  assert.equal(
    (
      await req(
        "/growth-hooks/kora",
        "POST",
        { event: "charge.success", data: { amount: 999999, currency: "NGN" } },
        undefined,
        { "x-korapay-signature": "a".repeat(64) },
      )
    ).status,
    400,
  );
  assert.equal((await req("/growth-hooks/squad", "POST", {})).status, 503);
  assert.equal(
    (db.prepare("SELECT COUNT(*) n FROM ledger").get() as any).n,
    originalLedgerCount,
  );
});
test("creative gallery is authenticated, CSRF/owner/role protected, input-bounded and cannot allocate groups, fund or send", async () => {
  assert.equal(
    (
      await req(
        "/growth/" + id + "/creative-preview",
        "POST",
        { count: 4 },
        worker,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await req(
        "/growth/" + id + "/creative-preview",
        "POST",
        { count: 4 },
        other,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await req(
        "/growth/" + id + "/creative-preview",
        "POST",
        { count: 7 },
        buyer,
      )
    ).status,
    400,
  );
  assert.equal(previewFetches, 0);
  assert.equal(
    (
      await req(
        "/growth/" + id + "/creative-preview",
        "POST",
        { count: 4 },
        { ...buyer, csrf: "wrong" },
      )
    ).status,
    403,
  );
  const g = await req(
    "/growth/" + id + "/creative-preview",
    "POST",
    {
      count: 4,
      destination: "https://evil.test",
      title: "FORGED",
      groupJid: "120363000000000001@g.us",
      funded: true,
    },
    buyer,
  );
  assert.equal(g.status, 200);
  assert.equal(g.body.examples.length, 4);
  assert.equal(g.body.liveDispatch, false);
  assert.equal(g.body.previewOnly, true);
  assert.equal(g.body.quality, "PARTIAL");
  assert.equal(previewFetches, 1);
  for (const example of g.body.examples) {
    assert.equal(example.destination, input().destination);
    assert.equal(example.destinationName, "SYNTHETIC API destination");
    assert.equal(example.text.includes("FORGED"), false);
  }
  assert.equal(
    (
      db
        .prepare("SELECT COUNT(*) n FROM growth_creative_placements")
        .get() as any
    ).n,
    0,
  );
  assert.equal(
    (db.prepare("SELECT COUNT(*) n FROM ledger").get() as any).n,
    originalLedgerCount,
  );
  assert.equal(
    (db.prepare("SELECT COUNT(*) n FROM growth_payment_intents").get() as any)
      .n,
    0,
  );
});
test.after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  app.locals.previewEngine?.close();
  db.close();
});
