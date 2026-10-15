// Intentional deployed-instance smoke test. Temporary IDs are recorded for exact cleanup.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
const base = process.env.SMOKE_URL || "http://127.0.0.1:3107";
const origin =
  process.env.SMOKE_ORIGIN || "https://3107-i939v66u4n74fnf36opc1.e2b.app";
const accounts = [];
const checks = [];
async function request(path, method = "GET", body, account) {
  const res = await fetch(base + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "PappyWeb",
      Origin: origin,
      ...(account
        ? { Cookie: account.cookie, "X-CSRF-Token": account.csrf }
        : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json(), headers: res.headers };
}
try {
  let r = await request("/health");
  assert.equal(r.status, 200);
  checks.push("Deployed database health responds 200");
  r = await request("/admin/overview");
  assert.equal(r.status, 401);
  checks.push("Anonymous admin API denied");
  for (const role of ["EARNER", "ADVERTISER"]) {
    const password = randomBytes(32).toString("base64url");
    r = await request("/auth/register", "POST", {
      name: "Temporary deployment check",
      email: `deploy-check-${randomBytes(8).toString("hex")}@example.test`,
      password,
      role,
    });
    assert.equal(r.status, 201);
    const account = {
      id: r.body.user.id,
      csrf: r.body.csrf,
      cookie: r.headers.get("set-cookie").split(";")[0],
    };
    accounts.push(account);
    writeFileSync(
      "/home/user/deployed-smoke-cleanup.json",
      JSON.stringify(accounts.map((a) => a.id)),
      { mode: 0o600 },
    );
    assert.match(r.headers.get("set-cookie"), /Secure/);
    assert.match(r.headers.get("set-cookie"), /HttpOnly/);
    const w = await request("/workspace", "GET", undefined, account);
    assert.equal(w.status, 200);
    if (role === "EARNER") {
      assert.equal(w.body.wallet.locked_milli, 200000);
      assert.equal(w.body.wallet.earned_milli, 0);
      assert.equal(
        (await request("/withdrawals", "POST", { amount: 500 }, account))
          .status,
        503,
      );
      assert.equal(
        (
          await request(
            "/support",
            "POST",
            {
              subject: "Temporary deployment test",
              message:
                "Automated deployment verification; record removed after check.",
            },
            account,
          )
        ).status,
        201,
      );
      checks.push(
        "Worker registration, locked bonus, support persistence and payout fail-closed verified",
      );
    } else {
      const draft = {
        title: "Temporary deployment check",
        targetUrl: "https://t.me/temporarycheck",
        caption: "Automated verification only; no delivery.",
        pathway: "SMART_VERIFIED",
        platform: "TG_GROUP",
        mode: "ALLSTATUS_1X",
        tier: "BRONZE",
        sessionCount: 1,
        volume: 100,
        countryFilter: "RANDOM",
        countries: [],
      };
      const created = await request("/campaigns", "POST", draft, account);
      assert.equal(created.status, 201);
      assert.equal(created.body.status, "DRAFT");
      assert.equal(
        (await request("/workspace", "GET", undefined, account)).body.campaigns
          .length,
        1,
      );
      assert.equal(
        (await request(`/campaigns/${created.body.id}`, "DELETE", {}, account))
          .status,
        200,
      );
      checks.push(
        "Advertiser registration and persisted draft create/read/delete verified",
      );
    }
    assert.equal(
      (await request("/auth/logout", "POST", {}, account)).status,
      200,
    );
    assert.equal(
      (await request("/workspace", "GET", undefined, account)).status,
      401,
    );
  }
  checks.push("Server-side logout revocation and Secure cookie flags verified");
  const html = await fetch(base + "/");
  assert.equal(html.status, 200);
  assert.match(await html.text(), /Pappy Earning Hub/);
  const favicon = await fetch(base + "/favicon.svg");
  assert.equal(favicon.status, 200);
  checks.push("Deployed HTML and favicon load");
  writeFileSync(
    "docs/testing/deployed-smoke-results.json",
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        transport:
          "SSH tunnel to VPS container; direct unauthenticated Arena HTTPS request is access-gated",
        checks,
      },
      null,
      2,
    ),
  );
  console.log(checks.join("\n"));
} finally {
  console.log(
    "Temporary account IDs recorded for exact cleanup; no passwords logged.",
  );
}
