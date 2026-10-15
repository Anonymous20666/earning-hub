import React, { useId, useState } from "react";
import {
  displayEquivalent,
  FX_SNAPSHOT,
  type DisplayCurrency,
} from "../../shared/currency";
export function CoinValue({ amount = 1 }: { amount?: number }) {
  const [currency, setCurrency] = useState<DisplayCurrency>("EUR");
  const id = useId();
  return (
    <section
      className="coin-value"
      aria-label="Indicative currency equivalents"
    >
      <span className="eyebrow">
        {amount.toLocaleString("en")} {amount === 1 ? "COIN" : "COINS"} ·
        INDICATIVE VALUE
      </span>
      <div className="coin-value-primary">
        <strong>
          {displayEquivalent(amount, "USD", amount > 0 && amount < 10)}
        </strong>
        <span>US dollars · approximate, not a cashout quote</span>
      </div>
      <p className="coin-value-ngn">
        Then in naira: <strong>{displayEquivalent(amount, "NGN")}</strong>
      </p>
      <div className="coin-value-other">
        <label htmlFor={id}>See another currency</label>
        <select
          id={id}
          value={currency}
          onChange={(e) => setCurrency(e.target.value as DisplayCurrency)}
        >
          {(Object.keys(FX_SNAPSHOT.rates) as DisplayCurrency[])
            .filter((c) => c !== "USD" && c !== "NGN")
            .map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
        </select>
        <output>
          {displayEquivalent(amount, currency, amount > 0 && amount < 10)}
        </output>
      </div>
      <p className="field-help">
        Coins are reward units, not US dollars. The existing backing is 1 Coin =
        ₦1; it has not changed. Currency displays use a dated FX snapshot from{" "}
        <a
          href="https://www.exchangerate-api.com"
          target="_blank"
          rel="noreferrer"
        >
          ExchangeRate-API
        </a>
        , {FX_SNAPSHOT.updatedAt}. Not live rates. Exchange rates, eventual
        provider fees and payout availability can differ. Cashout is not open.
      </p>
    </section>
  );
}
