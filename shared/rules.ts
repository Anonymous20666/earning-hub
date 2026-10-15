// Preserved business rules. Integers are thousandths of one Coin (1 Coin = NGN 1).
export const RULES = Object.freeze({
  bonusMilli: 200_000,
  firstEarnedMilli: 300_000,
  minimumCashoutMilli: 500_000,
  minimumMargin: 0.75,
});
export const toMilli = (coins: number): number => {
  if (
    !Number.isFinite(coins) ||
    coins < 0 ||
    !Number.isSafeInteger(Math.round(coins * 1000))
  )
    throw new Error("Invalid coin amount");
  return Math.round(coins * 1000);
};
export function groupPayoutMilli(
  members: number,
  status: string,
  mode: string,
) {
  if (!Number.isSafeInteger(members) || members < 100 || status !== "OPEN")
    return 0;
  if (!["ALLSTATUS_1X", "ALLCHAT_2X_VIP"].includes(mode))
    throw new Error("Invalid broadcast mode");
  return Math.min(members, 1000) * (mode === "ALLCHAT_2X_VIP" ? 2 : 1);
}
export function withdrawalEligibility(
  earnedMilli: number,
  lockedMilli: number,
  bonusClaimed: boolean,
) {
  if (
    ![earnedMilli, lockedMilli].every((x) => Number.isSafeInteger(x) && x >= 0)
  )
    throw new Error("Invalid wallet");
  const earnedThreshold = bonusClaimed
    ? RULES.minimumCashoutMilli
    : RULES.firstEarnedMilli;
  const availableMilli = earnedMilli + (bonusClaimed ? 0 : lockedMilli);
  const neededMilli = Math.max(
    0,
    earnedThreshold - earnedMilli,
    RULES.minimumCashoutMilli - availableMilli,
  );
  return { canWithdraw: neededMilli === 0, availableMilli, neededMilli };
}
export function validateWithdrawal(
  earnedMilli: number,
  lockedMilli: number,
  bonusClaimed: boolean,
  amountMilli: number,
) {
  const eligible = withdrawalEligibility(
    earnedMilli,
    lockedMilli,
    bonusClaimed,
  );
  if (
    !Number.isSafeInteger(amountMilli) ||
    amountMilli < RULES.minimumCashoutMilli ||
    !eligible.canWithdraw ||
    amountMilli > eligible.availableMilli
  )
    throw new Error("Withdrawal exceeds available balance or is locked");
  const bonusUsed = bonusClaimed ? 0 : Math.min(lockedMilli, amountMilli);
  return {
    earnedMilli: earnedMilli - (amountMilli - bonusUsed),
    lockedMilli: 0,
    bonusClaimed: true,
  };
}
export type DraftInput = {
  title: string;
  targetUrl: string;
  caption: string;
  pathway: "DIRECT_SESSION" | "SMART_VERIFIED";
  platform: "WA_GROUP" | "WA_CHANNEL" | "TG_GROUP" | "TG_CHANNEL";
  mode: "ALLSTATUS_1X" | "ALLCHAT_2X_VIP";
  tier: "BRONZE" | "SILVER" | "GOLD";
  sessionCount: number;
  volume: number;
  countryFilter: "RANDOM" | "SPECIFIC_COUNTRIES";
  countries: string[];
};
export function validateDraft(body: any): DraftInput {
  if (!body || typeof body !== "object")
    throw new Error("Campaign details are required");
  const text = (key: string, min: number, max: number) => {
    const value = body[key];
    if (
      typeof value !== "string" ||
      value.trim().length < min ||
      value.trim().length > max
    )
      throw new Error(`${key} must be ${min}–${max} characters`);
    return value.trim();
  };
  const choice = (key: string, values: string[]) => {
    if (!values.includes(body[key])) throw new Error(`Invalid ${key}`);
    return body[key];
  };
  const title = text("title", 3, 120),
    targetUrl = text("targetUrl", 10, 1000),
    caption = text("caption", 5, 2000);
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    throw new Error("Enter a valid destination URL");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Use a public HTTPS destination without credentials");
  const platform = choice("platform", [
    "WA_GROUP",
    "WA_CHANNEL",
    "TG_GROUP",
    "TG_CHANNEL",
  ]);
  const allowedHost = platform.startsWith("WA")
    ? ["chat.whatsapp.com", "whatsapp.com", "www.whatsapp.com"]
    : ["t.me", "telegram.me"];
  if (!allowedHost.includes(url.hostname) || url.pathname === "/" || url.port)
    throw new Error(
      "Use a WhatsApp or Telegram destination matching the selected platform",
    );
  const pathway = choice("pathway", ["DIRECT_SESSION", "SMART_VERIFIED"]);
  const mode = choice("mode", ["ALLSTATUS_1X", "ALLCHAT_2X_VIP"]);
  const tier = choice("tier", ["BRONZE", "SILVER", "GOLD"]);
  const countryFilter = choice("countryFilter", [
    "RANDOM",
    "SPECIFIC_COUNTRIES",
  ]);
  for (const [key, min, max] of [
    ["sessionCount", 1, 100],
    ["volume", 50, 2000],
  ] as const) {
    if (!Number.isSafeInteger(body[key]) || body[key] < min || body[key] > max)
      throw new Error(`${key} must be an integer between ${min} and ${max}`);
  }
  const countries = Array.isArray(body.countries)
    ? [...new Set(body.countries)]
    : [];
  if (
    countries.length > 4 ||
    countries.some((x) => !["+234", "+233", "+254", "+1"].includes(String(x)))
  )
    throw new Error("Invalid country selection");
  if (countryFilter === "SPECIFIC_COUNTRIES" && countries.length === 0)
    throw new Error("Select at least one country");
  return {
    title,
    targetUrl,
    caption,
    platform,
    pathway,
    mode,
    tier,
    countryFilter,
    sessionCount: body.sessionCount,
    volume: body.volume,
    countries,
  } as DraftInput;
}
// Existing calculator retained as an ESTIMATE, not a settlement price or profit guarantee.
// Conversion rates are unverified assumptions inherited from the original implementation.
export function estimateQuote(draft: DraftInput) {
  const multiplier = draft.mode === "ALLCHAT_2X_VIP" ? 2 : 1;
  let workerCoins: number;
  if (draft.pathway === "DIRECT_SESSION")
    workerCoins =
      draft.sessionCount *
      { BRONZE: 25, SILVER: 99, GOLD: 100 }[draft.tier] *
      multiplier;
  else {
    let conversion =
      draft.countryFilter === "SPECIFIC_COUNTRIES" ? 0.009 : 0.018;
    if (draft.platform.endsWith("CHANNEL")) conversion = 0.012;
    workerCoins = Math.ceil(
      (draft.volume / conversion / 500) * 0.5 * multiplier,
    );
    if (draft.countryFilter === "SPECIFIC_COUNTRIES")
      workerCoins = Math.round(workerCoins * 1.45 * 1000) / 1000;
  }
  const floorNgn =
    Math.ceil((workerCoins / (1 - RULES.minimumMargin)) * 100) / 100;
  const estimatedNgn = Math.ceil(floorNgn * 1.05);
  return {
    workerCoins,
    floorNgn,
    estimatedNgn,
    maxWorkerCoins: Math.round(workerCoins * 1.05 * 1000) / 1000,
    estimateOnly: true,
    notice:
      "Planning estimate only. Conversion assumptions, gateway fees, taxes, bonus funding and actual delivery costs are not verified. No charge or delivery promise.",
  };
}
