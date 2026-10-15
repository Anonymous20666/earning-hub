import test from "node:test";
import assert from "node:assert/strict";
import {
  coinEquivalent,
  FX_SNAPSHOT,
  displayEquivalent,
} from "../shared/currency";
import { EARNING_RULES, placementRewardMilli } from "../shared/earningRules";
test("display FX remains dated, sourced, USD-first and never changes the Coin backing or rates", () => {
  assert.equal(EARNING_RULES.coinToNgn, 1);
  assert.equal(placementRewardMilli(100), 100);
  assert.equal(coinEquivalent(1000, "NGN"), 1000);
  assert.ok(
    Math.abs(coinEquivalent(1000, "USD") - 1000 / FX_SNAPSHOT.rates.NGN) <
      1e-12,
  );
  assert.ok(coinEquivalent(5000, "USD") > 3 && coinEquivalent(5000, "USD") < 5);
  assert.ok(FX_SNAPSHOT.updatedAt.includes("15 Oct 2026"));
  assert.ok(FX_SNAPSHOT.source.startsWith("https://"));
  assert.match(displayEquivalent(1, "USD", true), /0\.000/);
  assert.throws(() => coinEquivalent(NaN, "USD"), /Invalid/);
  assert.throws(() => coinEquivalent(-1, "NGN"), /Invalid/);
});
