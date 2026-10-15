// Dated display-only FX snapshot. Never used for ledger entries or payouts.
import { EARNING_RULES } from "./earningRules";
export const FX_SNAPSHOT = {
  source: "https://open.er-api.com/v6/latest/USD",
  provider: "ExchangeRate-API",
  updatedAt: "Thu, 15 Oct 2026 00:02:31 +0000",
  rates: {
    USD: 1,
    NGN: 1331.826337,
    EUR: 0.894425,
    GBP: 0.756165,
    GHS: 11.686603,
    KES: 129.725167,
    ZAR: 16.579734,
    CAD: 1.422795,
    AUD: 1.433021,
    INR: 95.252751,
    AED: 3.6725,
    JPY: 158.305497,
  },
} as const;
export type DisplayCurrency = keyof typeof FX_SNAPSHOT.rates;
export function coinEquivalent(
  coins: number,
  currency: DisplayCurrency,
): number {
  if (!Number.isFinite(coins) || coins < 0) throw Error("Invalid Coin amount");
  return (
    ((coins * EARNING_RULES.coinToNgn) / FX_SNAPSHOT.rates.NGN) *
    FX_SNAPSHOT.rates[currency]
  );
}
export function displayEquivalent(
  coins: number,
  currency: DisplayCurrency,
  precise = false,
): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: precise ? 6 : 2,
    maximumFractionDigits: precise ? 6 : 2,
  }).format(coinEquivalent(coins, currency));
}
