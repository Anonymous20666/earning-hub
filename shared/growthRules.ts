export const GROWTH_TERMS_VERSION = 1;
export const GROWTH_PRODUCTS = {
  WA_GROUP: {
    name: "WhatsApp group",
    unit: "new qualifying requests",
    min: 200,
    max: 2000,
    channel: false,
    country: true,
  },
  WA_CHANNEL: {
    name: "WhatsApp channel",
    unit: "net new followers",
    min: 500,
    max: 100000,
    channel: true,
    country: true,
  },
  TG_GROUP: {
    name: "Telegram group",
    unit: "new qualifying requests",
    min: 200,
    max: 2000,
    channel: false,
    country: false,
  },
  TG_CHANNEL: {
    name: "Telegram channel",
    unit: "net new subscribers",
    min: 500,
    max: 100000,
    channel: true,
    country: false,
  },
} as const;
export type GrowthProduct = keyof typeof GROWTH_PRODUCTS;
export const GROWTH_COUNTRIES = [
  ["NG", "Nigeria", "234"],
  ["GH", "Ghana", "233"],
  ["KE", "Kenya", "254"],
  ["ZA", "South Africa", "27"],
  ["GB", "United Kingdom", "44"],
  ["US", "United States", null],
  ["CA", "Canada", null],
  ["AE", "United Arab Emirates", "971"],
  ["IN", "India", "91"],
  ["DE", "Germany", "49"],
  ["FR", "France", "33"],
  ["UG", "Uganda", "256"],
  ["TZ", "Tanzania", "255"],
  ["EG", "Egypt", "20"],
  ["PK", "Pakistan", "92"],
] as const;
export type GrowthInput = {
  title: string;
  product: GrowthProduct;
  destination: string;
  quantity: number;
  countries: string[];
  lane: "NORMAL" | "URGENT";
  service: "SELF_SERVICE" | "MANAGED";
  expectedAt: string;
  contactPhone: string;
  termsVersion: number;
  acknowledged: boolean;
};
export function normalizeGrowthDestination(product: GrowthProduct, value: string): string {
  if (!Object.hasOwn(GROWTH_PRODUCTS, product)) throw Error("Choose a supported service");
  if(typeof value!=="string" || value.trim().length<10 || value.length>1000) throw Error("Enter a valid destination link");
  const destination=value.trim();
  let url: URL;
  try {
    url = new URL(destination);
  } catch {
    throw Error("Enter a valid destination link");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash
  )
    throw Error(
      "Use an HTTPS destination without credentials, port or fragment",
    );
  const path = url.pathname;
  if (
    product === "WA_GROUP" &&
    !(
      url.hostname === "chat.whatsapp.com" &&
      /^\/[A-Za-z0-9_-]{8,64}\/?$/.test(path)
    )
  )
    throw Error("Use a WhatsApp group invitation link");
  if (
    product === "WA_CHANNEL" &&
    !(
      ["whatsapp.com", "www.whatsapp.com"].includes(url.hostname) &&
      /^\/channel\/[A-Za-z0-9_-]{8,64}\/?$/.test(path)
    )
  )
    throw Error("Use a WhatsApp channel link");
  if (
    product.startsWith("TG") &&
    !(
      ["t.me", "telegram.me"].includes(url.hostname) &&
      /^\/(?:\+[A-Za-z0-9_-]{8,100}|joinchat\/[A-Za-z0-9_-]{8,100}|[A-Za-z][A-Za-z0-9_]{4,31})\/?$/.test(
        path,
      )
    )
  )
    throw Error("Use a Telegram invitation or public destination link");
  return url.href;
}

export function validateGrowthInput(body: any, now = Date.now()): GrowthInput {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw Error("Campaign details are required");
  const product = body.product as GrowthProduct;
  if (!Object.hasOwn(GROWTH_PRODUCTS, product))
    throw Error("Choose a supported service");
  const rule = GROWTH_PRODUCTS[product];
  const text = (key: string, min: number, max: number) => {
    const value = body[key];
    if (
      typeof value !== "string" ||
      value.trim().length < min ||
      value.trim().length > max ||
      /[\u0000-\u0008\u000e-\u001f]/.test(value)
    )
      throw Error(`${key} must be ${min}–${max} characters`);
    return value.trim();
  };
  const title = text("title", 3, 120),
    destination = text("destination", 10, 1000);
  const url = normalizeGrowthDestination(product,destination);
  if (
    !Number.isSafeInteger(body.quantity) ||
    body.quantity < rule.min ||
    body.quantity > rule.max
  )
    throw Error(
      `Choose ${rule.min.toLocaleString("en")}–${rule.max.toLocaleString("en")} ${rule.unit}`,
    );
  if (
    !Array.isArray(body.countries) ||
    body.countries.length > 8 ||
    body.countries.some((c: any) => !GROWTH_COUNTRIES.some((x) => x[0] === c))
  )
    throw Error("Choose supported countries");
  const countries = [...new Set<string>(body.countries)].sort();
  if (!rule.country && countries.length)
    throw Error("Country targeting is not offered for Telegram");
  if (
    !["NORMAL", "URGENT"].includes(body.lane) ||
    !["SELF_SERVICE", "MANAGED"].includes(body.service)
  )
    throw Error("Choose a valid lane and service");
  const when = Date.parse(body.expectedAt);
  if (
    !Number.isFinite(when) ||
    when < now + 30 * 60000 ||
    when > now + 90 * 86400000
  )
    throw Error(
      "Choose an expected deadline between 30 minutes and 90 days from now",
    );
  const contactPhone =
    typeof body.contactPhone === "string" ? body.contactPhone.trim() : "";
  if (contactPhone && !/^\+[1-9]\d{6,14}$/.test(contactPhone))
    throw Error("Use an international contact number, for example +234…");
  if (product === "WA_CHANNEL" && !contactPhone)
    throw Error("A contact number is needed for the channel admin invitation");
  return {
    title,
    product,
    destination: url,
    quantity: body.quantity,
    countries,
    lane: body.lane,
    service: body.service,
    expectedAt: new Date(when).toISOString(),
    contactPhone,
    termsVersion: GROWTH_TERMS_VERSION,
    acknowledged:
      body.acknowledged === true && body.termsVersion === GROWTH_TERMS_VERSION,
  };
}
export function growthTerms(product: GrowthProduct) {
  return GROWTH_PRODUCTS[product].channel
    ? "The target is net growth from the recorded starting count, not identifiable unique arrivals. Country selections target advertising-group audiences, not verified follower nationality. Do not run other promotions during the measurement window; their growth cannot be separated. Existing followers may leave. No exact deadline or retention guarantee is implied."
    : "Existing pending requests and duplicate requesters are excluded. All new qualifying requests in the campaign window count, including requests from other invitations. Do not share or promote invitation links while the campaign runs. Approval does not erase a credited request. Country filtering uses supported phone-number regions, not nationality or location; non-matching requests may be rejected.";
}
export function requestRegion(phone: string): string | undefined {
  const normalized = phone.replace(/@s\.whatsapp\.net$/, "").replace(/^\+/, "");
  if (!/^[1-9]\d{6,14}$/.test(normalized)) return;
  // +1 is deliberately not mapped to a single country. LID-only identities are never guessed.
  return [...GROWTH_COUNTRIES]
    .filter((x) => x[2])
    .sort((a, b) => b[2]!.length - a[2]!.length)
    .find((x) => normalized.startsWith(x[2]!))?.[0];
}
export const growthMoney = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    kobo / 100,
  );
