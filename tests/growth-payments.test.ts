import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { fixture, accepted } from "./growth-fixtures";
import {
  GrowthPaymentGateway,
  majorToKobo,
  koraWebhookSignature,
} from "../backend/growthPayments";
import { reconcileTreasury } from "../backend/earning";
const squadSecret = "sandbox_sk_SYNTHETIC_NOT_A_REAL_KEY",
  koraSecret = "sk_test_SYNTHETIC_NOT_A_REAL_KEY";
const options = { squadSecret, koraSecret, origin: "https://example.test" };
function response(data: any) {
  return new Response(JSON.stringify({ status: true, data }), {
    headers: { "Content-Type": "application/json" },
  });
}
test("decimal major amounts convert exactly to integer kobo, not binary float multiplication", () => {
  for (const [v, n] of [
    ["0.01", 1],
    ["1.29", 129],
    ["100.1", 10010],
    ["100000000.00", 10000000000],
  ] as const)
    assert.equal(majorToKobo(v), n);
  for (const value of [
    "0",
    "-1",
    "1.001",
    "1e5",
    NaN,
    Infinity,
    "99999999999",
    null,
    {},
    " 1",
  ])
    assert.throws(() => majorToKobo(value));
});
test("configuration errors create no intent and cannot use production keys or insecure origins", async () => {
  const db = fixture();
  try {
    const o = accepted(db);
    let calls = 0;
    for (const patch of [
      { origin: "http://example.test" },
      { origin: "https://user:password@example.test" },
      { origin: "https://example.test/path" },
      { origin: "https://example.test?secret=1" },
      { squadSecret: "live_sk_NEVER_ACCEPT_REAL_KEYS" },
    ]) {
      const gateway = new GrowthPaymentGateway(db, {
        ...options,
        ...patch,
        fetcher: async () => {
          calls++;
          throw Error("Must not call a provider");
        },
      });
      await assert.rejects(gateway.initiate("buyer", o.id, "SQUAD"));
    }
    assert.equal(calls, 0);
    assert.equal(
      (db.prepare("SELECT COUNT(*) n FROM growth_payment_intents").get() as any)
        .n,
      0,
    );
  } finally {
    db.close();
  }
});
test("concurrent Squad initialization shares one intent; retries reuse checkout; verified sandbox never credits treasury", async () => {
  const db = fixture();
  try {
    const o = accepted(db);
    let starts = 0,
      checks = 0;
    const fetcher = async (url: any, init: any) => {
      assert.match(String(url), /^https:\/\/sandbox-api-d\.squadco\.com\//);
      assert.equal(init.redirect, "error");
      assert.equal(init.headers.Authorization, "Bearer " + squadSecret);
      if (init.method === "POST") {
        starts++;
        const body = JSON.parse(init.body);
        assert.equal(body.amount, 20000);
        return response({
          transaction_ref: body.transaction_ref,
          checkout_url: "https://sandbox-pay.squadco.com/test",
        });
      }
      checks++;
      await new Promise((r) => setTimeout(r, 5));
      return response({
        transaction_ref: String(url).split("/").at(-1),
        transaction_amount: 20000,
        transaction_status: "Success",
        currency: "NGN",
      });
    };
    const gateway = new GrowthPaymentGateway(db, {
      ...options,
      fetcher: fetcher as any,
    });
    const results = await Promise.allSettled([
      gateway.initiate("buyer", o.id, "SQUAD"),
      gateway.initiate("buyer", o.id, "SQUAD"),
    ]);
    assert.equal(starts, 1);
    const success = results.find(
      (r) => r.status === "fulfilled",
    ) as PromiseFulfilledResult<any>;
    const p = success.value;
    assert.equal(
      (await gateway.initiate("buyer", o.id, "SQUAD")).reference,
      p.reference,
    );
    await assert.rejects(gateway.verify("other", p.reference), /not found/);
    const verified = await Promise.all([
      gateway.verify("buyer", p.reference),
      gateway.verify("buyer", p.reference),
    ]);
    assert.equal(checks, 1);
    assert.equal(verified[0].status, "VERIFIED");
    assert.equal(verified[0].fundedLiveCampaign, false);
    assert.equal(
      (await gateway.verify("buyer", p.reference)).status,
      "VERIFIED",
    );
    assert.equal(checks, 1);
    assert.equal(reconcileTreasury(db).treasury.cash_milli, 0);
    assert.equal(
      (
        db
          .prepare("SELECT status FROM growth_orders WHERE id=?")
          .get(o.id) as any
      ).status,
      "ACCEPTED",
    );
  } finally {
    db.close();
  }
});
test("uncertain initialization locks backup; reference, currency, and amount mismatches cannot mark paid", async () => {
  const db = fixture();
  try {
    const o = accepted(db);
    let calls = 0;
    const broken = new GrowthPaymentGateway(db, {
      ...options,
      fetcher: async () => {
        calls++;
        throw Error("SYNTHETIC timeout");
      },
    });
    await assert.rejects(broken.initiate("buyer", o.id, "SQUAD"), /Reconcile/);
    const intent = db
      .prepare("SELECT * FROM growth_payment_intents")
      .get() as any;
    assert.equal(intent.status, "UNKNOWN");
    await assert.rejects(broken.initiate("buyer", o.id, "KORA"), /uncertain/);
    assert.equal(calls, 1);
    for (const mismatch of [
      { transaction_ref: "wrong" },
      { currency: "USD" },
      { transaction_amount: 19999 },
    ]) {
      const gateway = new GrowthPaymentGateway(db, {
        ...options,
        fetcher: async () =>
          response({
            transaction_ref: intent.reference,
            transaction_amount: 20000,
            transaction_status: "Success",
            currency: "NGN",
            ...mismatch,
          }),
      });
      await assert.rejects(gateway.verify("buyer", intent.reference), /match/);
      assert.equal(
        (db.prepare("SELECT status FROM growth_payment_intents").get() as any)
          .status,
        "UNKNOWN",
      );
    }
    assert.equal(reconcileTreasury(db).treasury.cash_milli, 0);
  } finally {
    db.close();
  }
});
test("authoritative failure permits Kora backup, authenticated webhook re-queries server and is idempotent", async () => {
  const db = fixture();
  try {
    const o = accepted(db);
    const squad = new GrowthPaymentGateway(db, {
      ...options,
      fetcher: async (url, init) =>
        init?.method === "POST"
          ? response({
              transaction_ref: JSON.parse(init.body as string).transaction_ref,
              checkout_url: "https://sandbox-pay.squadco.com/test",
            })
          : response({
              transaction_ref: String(url).split("/").at(-1),
              transaction_amount: 20000,
              transaction_status: "Failed",
              currency: "NGN",
            }),
    });
    const first = await squad.initiate("buyer", o.id, "SQUAD");
    assert.equal(
      (await squad.verify("buyer", first.reference)).status,
      "FAILED",
    );
    let checks = 0;
    const kora = new GrowthPaymentGateway(db, {
      ...options,
      fetcher: async (url, init) => {
        assert.match(
          String(url),
          /^https:\/\/api\.korapay\.com\/merchant\/api\/v1\/charges\//,
        );
        if (init?.method === "POST") {
          const body = JSON.parse(init.body as string);
          assert.equal(body.amount, 200);
          assert.equal(body.merchant_bears_cost, true);
          return response({
            reference: body.reference,
            checkout_url: "https://checkout.korapay.com/synthetic/pay",
          });
        }
        checks++;
        return response({
          reference: String(url).split("/").at(-1),
          amount: "200.00",
          currency: "NGN",
          status: "success",
        });
      },
    });
    const second = await kora.initiate("buyer", o.id, "KORA");
    const body = {
      event: "charge.success",
      data: {
        reference: second.reference,
        amount: 200,
        currency: "NGN",
        status: "success",
      },
    };
    const signature = createHmac("sha256", koraSecret)
      .update(JSON.stringify(body.data))
      .digest("hex");
    assert.equal(koraWebhookSignature(body, signature, koraSecret), true);
    assert.equal(
      koraWebhookSignature(
        { ...body, data: { ...body.data, amount: 1 } },
        signature,
        koraSecret,
      ),
      false,
    );
    assert.equal(koraWebhookSignature(body, "invalid", koraSecret), false);
    await assert.rejects(kora.koraWebhook(body, "0".repeat(64)), /signature/);
    assert.equal(checks, 0);
    await kora.koraWebhook(body, signature);
    await kora.koraWebhook(body, signature);
    assert.equal(checks, 1);
    assert.equal(reconcileTreasury(db).treasury.cash_milli, 0);
  } finally {
    db.close();
  }
});
test("provider redirect and oversized response fail closed without a checkout or ledger mutation", async () => {
  for (const bad of ["redirect", "large"]) {
    const db = fixture();
    try {
      const o = accepted(db);
      const gateway = new GrowthPaymentGateway(db, {
        ...options,
        fetcher: async (_url, init) =>
          bad === "large"
            ? new Response("x".repeat(131073))
            : response({
                transaction_ref: JSON.parse(init?.body as string)
                  .transaction_ref,
                checkout_url: "https://evil.test/checkout",
              }),
      });
      await assert.rejects(
        gateway.initiate("buyer", o.id, "SQUAD"),
        /could not be confirmed/,
      );
      const intent = db
        .prepare("SELECT * FROM growth_payment_intents")
        .get() as any;
      assert.equal(intent.status, "UNKNOWN");
      assert.equal(intent.checkout_url, null);
      assert.equal(reconcileTreasury(db).treasury.cash_milli, 0);
    } finally {
      db.close();
    }
  }
});
