import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { openDatabase } from "../backend/database";
import { createApp } from "../backend/app";
import {
  recordProviderPairing,
  syncProviderInventory,
} from "../backend/inventory";
const db = openDatabase(":memory:");
let server: Server, url: string;
before(async () => {
  server = createApp(db, { secureCookies: false, rateMax: 1000 }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise<void>((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${(server.address() as any).port}/api`;
});
after(() => {
  server.close();
  db.close();
});
async function req(
  path: string,
  auth?: any,
  body?: any,
  method = body ? "POST" : "GET",
) {
  const r = await fetch(url + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "PappyWeb",
      ...(auth ? { Cookie: auth.cookie, "X-CSRF-Token": auth.csrf } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: r.status,
    body: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
async function signup(id: string, role = "EARNER", referralCode?: unknown) {
  const r = await req("/auth/register", undefined, {
    email: id + "@example.test",
    password: "Isolated-long-password-2026!",
    name: "Isolated worker",
    role,
    referralCode,
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { cookie: r.cookie, csrf: r.body.csrf, user: r.body.user };
}
let inviter: any, invitee: any, other: any, advertiser: any, admin: any;
test("new earnings and treasury APIs reject anonymous access", async () => {
  assert.equal((await req("/earnings")).status, 401);
  assert.equal((await req("/admin/treasury")).status, 401);
});
test("worker referral link is real; signup registers one pending 100-Coin reward without earning cash", async () => {
  inviter = await signup("earning-inviter");
  const before = await req("/earnings", inviter);
  assert.match(before.body.referrals.code, /^[a-f0-9]{20}$/);
  assert.equal(before.body.referrals.total, 0);
  invitee = await signup(
    "earning-invitee",
    "EARNER",
    before.body.referrals.code,
  );
  const after = await req("/earnings", inviter);
  assert.equal(after.body.referrals.total, 1);
  assert.equal(after.body.referrals.pending_milli, 100000);
  assert.equal(after.body.referrals.earned_milli, 0);
  assert.equal((await req("/workspace", inviter)).body.wallet.earned_milli, 0);
  assert.equal((await req("/workspace", invitee)).body.wallet.earned_milli, 0);
  assert.equal((await req("/earnings", invitee)).body.referrals.total, 0);
  assert.equal(after.body.referrals.referrals[0].referred_id, undefined);
});
test("bad referral code is rejected atomically, not silently attached to someone else", async () => {
  const count = (db.prepare("SELECT COUNT(*) n FROM users").get() as any).n;
  for (const referralCode of ["not-a-code", "a".repeat(20), false, 0, null]) {
    const r = await req("/auth/register", undefined, {
      email: "invalid-ref@example.test",
      password: "Isolated-long-password-2026!",
      name: "Test worker",
      role: "EARNER",
      referralCode,
    });
    assert.equal(r.status, 400);
  }
  assert.equal(
    (db.prepare("SELECT COUNT(*) n FROM users").get() as any).n,
    count,
  );
});
test("real empty inventory has two available slots and no synthetic groups or deliveries", async () => {
  const r = await req("/earnings", invitee);
  assert.equal(r.body.accounts.length, 0);
  assert.equal(r.body.groups.length, 0);
  assert.equal(r.body.summary.uniqueQualified, 0);
  assert.equal(r.body.deliveries.length, 0);
  assert.equal(r.body.providerConfigured, false);
  assert.equal(r.body.dispatchEnabled, false);
});
test("clients cannot self-pair, invent consent, deposit funds or claim delivery credits", async () => {
  for (const path of [
    "/pairing",
    "/earnings/paired",
    "/earnings/consent",
    "/earnings/delivery-confirmed",
    "/admin/funding",
    "/admin/treasury/deposit",
  ]) {
    const r = await req(path, invitee, {
      rewardMilli: 999999,
      verified: true,
      phone: "2348000000001",
      status: "DELIVERED",
    });
    assert.ok([403, 404, 503].includes(r.status), path + " " + r.status);
  }
  assert.equal(
    (db.prepare("SELECT cash_milli FROM treasury").get() as any).cash_milli,
    0,
  );
  assert.equal((await req("/workspace", invitee)).body.wallet.earned_milli, 0);
});
test("worker/advertiser cannot inspect treasury or create/fund house campaigns", async () => {
  advertiser = await signup("earning-advertiser", "ADVERTISER");
  for (const auth of [inviter, invitee, advertiser]) {
    assert.equal((await req("/admin/treasury", auth)).status, 403);
    assert.equal((await req("/admin/house-campaigns", auth, {})).status, 403);
    assert.equal((await req("/admin/dispatch/stop", auth, {})).status, 403);
  }
  assert.equal((await req("/earnings", advertiser)).status, 403);
});
test("group exclusion is server-owned and isolated; no automatic leaving occurs", async () => {
  other = await signup("earning-other");
  const a = recordProviderPairing(db, {
    userId: invitee.user.id,
    slot: 1,
    providerJid: "2348000000011@s.whatsapp.net",
    hashKey: "synthetic-api-fixture-hashing-key-32-plus",
  });
  syncProviderInventory(
    db,
    a.id,
    [
      {
        jid: "120363000000000011@g.us",
        subject: "SYNTHETIC inventory only",
        memberCount: 256,
        announce: false,
        userIsAdmin: false,
      },
    ],
    true,
  );
  const body = {
    accountId: a.id,
    groupJid: "120363000000000011@g.us",
    excluded: true,
  };
  assert.equal(
    (await req("/earnings/groups/exclusion", other, body, "PATCH")).status,
    404,
  );
  assert.equal(
    (await req("/earnings/groups/exclusion", invitee, body, "PATCH")).status,
    200,
  );
  const r = await req("/earnings", invitee);
  assert.equal(r.body.summary.uniqueQualified, 0);
  assert.equal(r.body.groups[0].isMember, true);
  assert.equal(r.body.groups[0].excluded, true);
  assert.equal((await req("/earnings", other)).body.groups.length, 0);
});
test("server-provisioned isolated admin can plan but cannot reserve nonexistent cash; no new admin is created by API", async () => {
  admin = await signup("earning-admin", "ADVERTISER");
  db.prepare("UPDATE users SET role='ADMIN' WHERE id=?").run(admin.user.id);
  assert.equal(
    (await req("/admin/treasury", admin)).body.treasury.cash_milli,
    0,
  );
  const c = await req("/admin/house-campaigns", admin, {
    title: "Synthetic house draft",
    message: "Synthetic campaign text only.",
    targetUrl: "https://example.test",
    rewardBudget: "30.000",
  });
  assert.equal(c.status, 201);
  const reserve = await req(
    `/admin/house-campaigns/${c.body.id}/fund`,
    admin,
    {},
  );
  assert.equal(reserve.status, 409);
  assert.match(reserve.body.error, /Insufficient verified/);
  assert.equal(
    (await req("/admin/treasury", admin)).body.campaigns[0].status,
    "DRAFT",
  );
  assert.equal((await req("/admin/dispatch/stop", admin, {})).status, 200);
});
test("funding operations require CSRF; invalid numeric budgets never become float balances", async () => {
  const r = await fetch(url + "/admin/house-campaigns", {
    method: "POST",
    headers: {
      Cookie: admin.cookie,
      "Content-Type": "application/json",
      "X-Requested-With": "PappyWeb",
    },
    body: "{}",
  });
  assert.equal(r.status, 403);
  for (const rewardBudget of ["1.0001", 30, "1e5", "-1"])
    assert.equal(
      (
        await req("/admin/house-campaigns", admin, {
          title: "Invalid synthetic budget",
          message: "Synthetic content only.",
          targetUrl: "https://example.test",
          rewardBudget,
        })
      ).status,
      400,
    );
});
