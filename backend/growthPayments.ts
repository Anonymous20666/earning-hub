import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { type Database, transaction } from "./database";
import { ownedGrowth } from "./growth";
export type GrowthPaymentProvider = "SQUAD" | "KORA";
export function majorToKobo(value: unknown) {
  const text = String(value);
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(text))
    throw Error("Invalid provider amount");
  const [whole, fraction = ""] = text.split(".");
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(n) || n < 1 || n > 10000000000)
    throw Error("Invalid provider amount");
  return n;
}
export function koraWebhookSignature(
  body: any,
  signature: string,
  secret: string,
) {
  if (
    !secret ||
    !body?.data ||
    !/^\w{64}$/.test(signature) ||
    !/^[a-f0-9]{64}$/i.test(signature)
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(JSON.stringify(body.data))
    .digest("hex");
  return timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex"),
  );
}
export class GrowthPaymentGateway {
  private busy = 0;
  private flights = new Map<string, Promise<any>>();
  constructor(
    private db: Database,
    private options: {
      squadSecret?: string;
      koraSecret?: string;
      origin?: string;
      fetcher?: typeof fetch;
    } = {},
  ) {}
  private secret(provider: GrowthPaymentProvider) {
    const key =
      provider === "SQUAD"
        ? (this.options.squadSecret ?? process.env.SQUAD_SANDBOX_SECRET)
        : (this.options.koraSecret ?? process.env.KORA_SANDBOX_SECRET);
    if (
      !key ||
      key.length < 19 ||
      (provider === "SQUAD"
        ? !key.startsWith("sandbox_sk_")
        : !key.startsWith("sk_test_"))
    )
      throw Error(
        "Sandbox credentials are not configured. Live charging is disabled",
      );
    return key;
  }
  private async request(
    provider: GrowthPaymentProvider,
    path: string,
    body?: any,
  ) {
    if (this.busy >= 4)
      throw Error("Payment verification is busy; try again shortly");
    const key = this.secret(provider),
      base =
        provider === "SQUAD"
          ? "https://sandbox-api-d.squadco.com"
          : "https://api.korapay.com";
    this.busy++;
    try {
      const response = await (this.options.fetcher ?? fetch)(base + path, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw Error("Provider request was not successful");
      const reader = response.body?.getReader();
      if (!reader) throw Error("Empty provider response");
      const chunks: Uint8Array[] = [];
      let length = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 131072) {
          await reader.cancel();
          throw Error("Provider response too large");
        }
        chunks.push(value);
      }
      const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if ((result.status !== true && result.status !== 200) || !result.data)
        throw Error("Provider response was not successful");
      return result.data;
    } finally {
      this.busy--;
    }
  }
  async initiate(user: string, id: string, provider: GrowthPaymentProvider) {
    if (!["SQUAD", "KORA"].includes(provider))
      throw Error("Choose a supported provider");
    this.secret(provider);
    const order = ownedGrowth(this.db, id, user);
    if (order.status !== "ACCEPTED")
      throw Error("Accept a current reviewed quote before sandbox checkout");
    const quote = this.db
      .prepare("SELECT * FROM growth_quotes WHERE id=?")
      .get(order.quote_id) as any;
    if (!quote || quote.expires_at < new Date().toISOString())
      throw Error("Quote expired");
    const previous = this.db
      .prepare(
        "SELECT * FROM growth_payment_intents WHERE order_id=? AND provider=?",
      )
      .get(id, provider) as any;
    if (previous) {
      if (previous.checkout_url && previous.status === "PENDING")
        return {
          reference: previous.reference,
          checkoutUrl: previous.checkout_url,
          mode: "SANDBOX",
        };
      throw Error(
        "This payment needs verification; do not create another attempt",
      );
    }
    const other = this.db
      .prepare(
        "SELECT 1 FROM growth_payment_intents WHERE order_id=? AND status IN('CREATING','PENDING','VERIFIED','UNKNOWN')",
      )
      .get(id);
    if (other)
      throw Error(
        "A payment is pending or uncertain. Reconcile it before switching provider",
      );
    const rawOrigin = this.options.origin ?? process.env.APP_ORIGIN;
    let origin: string;
    try {
      const parsed = new URL(rawOrigin || "");
      if (
        parsed.protocol !== "https:" ||
        parsed.username ||
        parsed.password ||
        parsed.search ||
        parsed.hash ||
        parsed.pathname !== "/"
      )
        throw Error();
      origin = parsed.origin;
    } catch {
      throw Error("A verified HTTPS application origin is required");
    }
    if (this.busy >= 4)
      throw Error("Payment verification is busy; try again shortly");
    const reference = "growth_test_" + randomUUID().replaceAll("-", ""),
      email = this.db
        .prepare("SELECT email,name FROM users WHERE id=?")
        .get(user) as any;
    this.db
      .prepare(
        "INSERT INTO growth_payment_intents(id,order_id,user_id,provider,mode,reference,amount_kobo,currency,status,created_at) VALUES(?,?,?,?,'SANDBOX',?,?,'NGN','CREATING',?)",
      )
      .run(
        randomUUID(),
        id,
        user,
        provider,
        reference,
        quote.amount_kobo,
        new Date().toISOString(),
      );
    try {
      const callback = origin + "/#/app/growth";
      const result = await this.request(
        provider,
        provider === "SQUAD"
          ? "/transaction/initiate"
          : "/merchant/api/v1/charges/initialize",
        provider === "SQUAD"
          ? {
              amount: quote.amount_kobo,
              email: email.email,
              customer_name: email.name,
              currency: "NGN",
              initiate_type: "inline",
              transaction_ref: reference,
              callback_url: callback,
              payment_channels: ["card", "transfer"],
              pass_charge: false,
              metadata: { growth_order: id },
            }
          : {
              amount: quote.amount_kobo / 100,
              currency: "NGN",
              reference,
              redirect_url: callback,
              notification_url: origin + "/api/growth-hooks/kora",
              customer: { email: email.email, name: email.name },
              merchant_bears_cost: true,
              metadata: { order: id },
            },
      );
      const returned =
        provider === "SQUAD" ? result.transaction_ref : result.reference;
      if (returned !== reference) throw Error("Provider reference mismatch");
      const checkout = new URL(result.checkout_url);
      const allowed =
        provider === "SQUAD"
          ? ["sandbox-pay.squadco.com"]
          : ["checkout.korapay.com"];
      if (
        checkout.protocol !== "https:" ||
        !allowed.includes(checkout.hostname) ||
        checkout.username ||
        checkout.password ||
        checkout.port
      )
        throw Error("Unexpected checkout address");
      this.db
        .prepare(
          "UPDATE growth_payment_intents SET status='PENDING',checkout_url=? WHERE reference=? AND status='CREATING'",
        )
        .run(checkout.href, reference);
      return { reference, checkoutUrl: checkout.href, mode: "SANDBOX" };
    } catch {
      this.db
        .prepare(
          "UPDATE growth_payment_intents SET status='UNKNOWN' WHERE reference=? AND status='CREATING'",
        )
        .run(reference);
      throw Error(
        "Sandbox initialization could not be confirmed. No live charge was attempted. Reconcile this reference before retrying or using the backup",
      );
    }
  }
  async verify(user: string, reference: string, internal = false) {
    if (!/^growth_test_[a-f0-9]{32}$/.test(reference))
      throw Error("Payment not found");
    const intent = this.db
      .prepare(
        `SELECT * FROM growth_payment_intents WHERE reference=? ${internal ? "" : "AND user_id=?"}`,
      )
      .get(...(internal ? [reference] : [reference, user])) as any;
    if (!intent) throw Error("Payment not found");
    if (intent.status === "VERIFIED")
      return { status: "VERIFIED", mode: "SANDBOX", fundedLiveCampaign: false };
    const prior = this.flights.get(reference);
    if (prior) return prior;
    const job = (async () => {
      const provider = intent.provider as GrowthPaymentProvider,
        result = await this.request(
          provider,
          provider === "SQUAD"
            ? "/transaction/verify/" + encodeURIComponent(reference)
            : "/merchant/api/v1/charges/" + encodeURIComponent(reference),
        );
      const ref =
          provider === "SQUAD" ? result.transaction_ref : result.reference,
        status = String(
          provider === "SQUAD" ? result.transaction_status : result.status,
        ).toLowerCase();
      const amount =
        provider === "SQUAD"
          ? Number(result.transaction_amount ?? result.amount)
          : majorToKobo(result.amount);
      if (
        ref !== reference ||
        amount !== intent.amount_kobo ||
        !Number.isSafeInteger(amount) ||
        result.currency !== "NGN"
      )
        throw Error("Payment details do not match the order");
      const next =
        status === "success"
          ? "VERIFIED"
          : ["failed", "abandoned"].includes(status)
            ? "FAILED"
            : "PENDING";
      transaction(this.db, () => {
        this.db
          .prepare(
            "UPDATE growth_payment_intents SET status=?,verified_at=? WHERE reference=? AND status<>'VERIFIED'",
          )
          .run(
            next,
            next === "VERIFIED" ? new Date().toISOString() : null,
            reference,
          );
      });
      return { status: next, mode: "SANDBOX", fundedLiveCampaign: false };
    })();
    this.flights.set(reference, job);
    try {
      return await job;
    } finally {
      this.flights.delete(reference);
    }
  }
  async koraWebhook(body: any, signature: string) {
    const secret = this.secret("KORA");
    if (!koraWebhookSignature(body, signature, secret))
      throw Error("Invalid webhook signature");
    if (body.event !== "charge.success" && body.event !== "charge.failed")
      return { ignored: true };
    const ref = body.data?.reference;
    if (typeof ref !== "string" || !/^growth_test_[a-f0-9]{32}$/.test(ref))
      return { ignored: true };
    const intent = this.db
      .prepare(
        "SELECT user_id FROM growth_payment_intents WHERE reference=? AND provider='KORA'",
      )
      .get(ref) as any;
    if (!intent) return { ignored: true };
    return this.verify(intent.user_id, ref, true);
  }
}
