import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../backend/app";
import { openDatabase } from "../backend/database";
import type { Server } from "node:http";
const db = openDatabase(":memory:");
let server: Server, url: string;
before(async () => {
  const app = createApp(db, { secureCookies: false, rateMax: 1000 });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  url = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(() => {
  server.close();
  db.close();
});
async function req(
  path: string,
  method = "GET",
  body?: any,
  auth?: any,
  extra?: any,
) {
  const response = await fetch(url + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "PappyWeb",
      ...(auth ? { Cookie: auth.cookie, "X-CSRF-Token": auth.csrf } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json();
  return { status: response.status, body: json, headers: response.headers };
}
let worker: any, advertiser: any, other: any, draftId: string, ticketId: string;
const password = "A-long-unique-password-2026!";
async function register(email: string, role = "EARNER") {
  const r = await req("/auth/register", "POST", {
    name: "Test Account",
    email,
    password,
    role,
  });
  assert.equal(r.status, 201);
  return { ...r.body, cookie: r.headers.get("set-cookie")!.split(";")[0] };
}
test("health checks real database", async () =>
  assert.equal((await req("/health")).status, 200));
test("anonymous workspace and admin access denied", async () => {
  assert.equal((await req("/workspace")).status, 401);
  assert.equal((await req("/admin/overview")).status, 401);
});
test("cross-origin auth blocked", async () =>
  assert.equal(
    (
      await req("/auth/register", "POST", {}, null, {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  ));
test("custom header is required on state changes", async () => {
  const r = await fetch(url + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(r.status, 403);
});
test("admin cannot self-register", async () =>
  assert.equal(
    (
      await req("/auth/register", "POST", {
        name: "Admin",
        email: "admin@test.example",
        password,
        role: "ADMIN",
      })
    ).status,
    400,
  ));
test("registration creates a conditional bonus once, not earned cash", async () => {
  worker = await register("worker@test.example");
  const r = await req("/workspace", "GET", undefined, worker);
  assert.equal(r.body.wallet.locked_milli, 200000);
  assert.equal(r.body.wallet.earned_milli, 0);
  assert.equal(r.body.ledger.length, 1);
  assert.equal(worker.user.isEmailVerified, false);
});
test("cookies are HttpOnly and SameSite, no token in body", async () => {
  const r = await req("/auth/login", "POST", {
    email: "worker@test.example",
    password,
  });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("set-cookie")!, /HttpOnly/);
  assert.match(r.headers.get("set-cookie")!, /SameSite=Lax/);
  assert.equal(r.body.token, undefined);
  worker = { ...r.body, cookie: r.headers.get("set-cookie")!.split(";")[0] };
});
test("passwords are salted hashes, session tokens are hashed", () => {
  const row: any = db
    .prepare("SELECT password_hash FROM users WHERE id=?")
    .get(worker.user.id);
  assert.notEqual(row.password_hash, password);
  assert.match(row.password_hash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  const s: any = db
    .prepare("SELECT token_hash FROM sessions WHERE user_id=?")
    .get(worker.user.id);
  assert.notEqual(s.token_hash, worker.cookie.split("=")[1]);
});
test("duplicate registration does not duplicate bonus", async () => {
  const r = await req("/auth/register", "POST", {
    name: "Again",
    email: "WORKER@test.example",
    password,
    role: "EARNER",
  });
  assert.equal(r.status, 409);
  assert.equal(
    (db.prepare("SELECT COUNT(*) AS count FROM ledger").get() as any).count,
    1,
  );
});
test("login has generic error and no seeded admin", async () => {
  const a = await req("/auth/login", "POST", {
    email: "worker@test.example",
    password: "wrong",
  });
  const b = await req("/auth/login", "POST", {
    email: "admin@pappyearninghub.com",
    password: "AdminPass2026!",
  });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.body.error, b.body.error);
});
test("CSRF token required", async () =>
  assert.equal(
    (
      await req("/profile", "PATCH", { name: "Tampered" }, worker, {
        "X-CSRF-Token": "wrong",
      })
    ).status,
    403,
  ));
test("profile updates cannot promote account", async () => {
  const r = await req(
    "/profile",
    "PATCH",
    { name: "New Name", role: "ADMIN" },
    worker,
  );
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, "EARNER");
  assert.equal(
    (await req("/admin/overview", "GET", undefined, worker)).status,
    403,
  );
});
test("browser cannot write wallet", async () => {
  assert.equal(
    (await req("/wallet", "PATCH", { earned_milli: 999999999 }, worker)).status,
    404,
  );
  assert.equal(
    (await req("/workspace", "GET", undefined, worker)).body.wallet
      .earned_milli,
    0,
  );
});
test("worker cannot create advertiser drafts", async () =>
  assert.equal((await req("/campaigns", "POST", {}, worker)).status, 403));
const draft = {
  title: "My launch campaign",
  targetUrl: "https://t.me/mycommunity",
  caption: "Welcome to our new community",
  pathway: "SMART_VERIFIED",
  platform: "TG_GROUP",
  mode: "ALLSTATUS_1X",
  tier: "BRONZE",
  sessionCount: 1,
  volume: 100,
  countryFilter: "RANDOM",
  countries: [],
};
test("advertiser draft is real, persistent and not launched", async () => {
  advertiser = await register("advertiser@test.example", "ADVERTISER");
  other = await register("other@test.example", "ADVERTISER");
  const r = await req(
    "/campaigns",
    "POST",
    { ...draft, status: "RUNNING", user_id: other.user.id },
    advertiser,
  );
  assert.equal(r.status, 201);
  draftId = r.body.id;
  const workspace = (await req("/workspace", "GET", undefined, advertiser))
    .body;
  assert.equal(workspace.campaigns.length, 1);
  assert.equal(workspace.campaigns[0].status, "DRAFT");
  assert.equal(workspace.wallet, null);
  assert.equal(workspace.campaigns[0].user_id, advertiser.user.id);
});
test("quote is explicitly an estimate", async () => {
  const r = await req("/campaigns/quote", "POST", draft, advertiser);
  assert.equal(r.status, 200);
  assert.equal(r.body.estimateOnly, true);
});
test("cross-account draft read, update and delete blocked", async () => {
  assert.equal(
    (await req("/workspace", "GET", undefined, other)).body.campaigns.length,
    0,
  );
  assert.equal(
    (await req("/campaigns/" + draftId, "PUT", draft, other)).status,
    404,
  );
  assert.equal(
    (await req("/campaigns/" + draftId, "DELETE", {}, other)).status,
    404,
  );
});
test("draft validation enforced on server", async () => {
  assert.equal(
    (
      await req(
        "/campaigns",
        "POST",
        { ...draft, volume: Infinity },
        advertiser,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await req(
        "/campaigns",
        "POST",
        { ...draft, targetUrl: "https://evil.example/abc" },
        advertiser,
      )
    ).status,
    400,
  );
});
test("own draft edit persists", async () => {
  assert.equal(
    (
      await req(
        "/campaigns/" + draftId,
        "PUT",
        { ...draft, title: "Edited campaign" },
        advertiser,
      )
    ).status,
    200,
  );
  assert.equal(
    (await req("/workspace", "GET", undefined, advertiser)).body.campaigns[0]
      .title,
    "Edited campaign",
  );
});
test("support ticket persists and is isolated", async () => {
  const r = await req(
    "/support",
    "POST",
    {
      subject: "Account question",
      message: "Please explain the bonus conditions.",
    },
    worker,
  );
  assert.equal(r.status, 201);
  ticketId = r.body.id;
  assert.equal(
    (await req("/workspace", "GET", undefined, worker)).body.tickets.length,
    1,
  );
  assert.equal(
    (await req("/workspace", "GET", undefined, other)).body.tickets.length,
    0,
  );
});
test("server-provisioned admin can reply, worker cannot", async () => {
  assert.equal(
    (
      await req(
        `/admin/tickets/${ticketId}/reply`,
        "POST",
        { reply: "Denied" },
        worker,
      )
    ).status,
    403,
  );
  db.prepare("UPDATE users SET role='ADMIN' WHERE id=?").run(other.user.id);
  const r = await req(
    `/admin/tickets/${ticketId}/reply`,
    "POST",
    { reply: "Your bonus is conditional and remains locked." },
    other,
  );
  assert.equal(r.status, 200);
  const ticket = (await req("/workspace", "GET", undefined, worker)).body
    .tickets[0];
  assert.equal(ticket.status, "REPLIED");
  assert.match(ticket.reply, /conditional/);
});
test("unconfigured operations fail closed and never debit", async () => {
  for (const path of [
    "/withdrawals",
    "/payments",
    "/pairing",
    "/chat",
    `/campaigns/${draftId}/launch`,
  ])
    assert.equal(
      (await req(path, "POST", { amount: 9999 }, worker)).status,
      503,
    );
  assert.equal(
    (await req("/workspace", "GET", undefined, worker)).body.wallet
      .earned_milli,
    0,
  );
});
test("reset never falsely claims email was sent", async () =>
  assert.equal(
    (
      await req("/auth/password-reset", "POST", {
        email: "worker@test.example",
      })
    ).status,
    503,
  ));
test("own draft deletion works", async () => {
  assert.equal(
    (await req("/campaigns/" + draftId, "DELETE", {}, advertiser)).status,
    200,
  );
  assert.equal(
    (await req("/workspace", "GET", undefined, advertiser)).body.campaigns
      .length,
    0,
  );
});
test("logout revokes session on server", async () => {
  assert.equal((await req("/auth/logout", "POST", {}, worker)).status, 200);
  assert.equal((await req("/workspace", "GET", undefined, worker)).status, 401);
});
test("API has security headers and unknown routes are JSON 404", async () => {
  const r = await req("/not-real");
  assert.equal(r.status, 404);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.match(r.headers.get("content-security-policy")!, /object-src 'none'/);
});
test("auth rate limit is enforced", async () => {
  const limited = createApp(db, { secureCookies: false, rateMax: 1 });
  const srv = limited.listen(0, "127.0.0.1");
  await new Promise<void>((r) => srv.once("listening", r));
  const base = `http://127.0.0.1:${(srv.address() as any).port}`;
  try {
    const opts = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "PappyWeb",
      },
      body: "{}",
    };
    await fetch(base + "/api/auth/login", opts);
    assert.equal((await fetch(base + "/api/auth/login", opts)).status, 429);
  } finally {
    srv.close();
  }
});
