import test from "node:test";
import assert from "node:assert/strict";
import {
  groupPayoutMilli,
  withdrawalEligibility,
  validateWithdrawal,
  toMilli,
  estimateQuote,
  validateDraft,
  DraftInput,
} from "../shared/rules";
import { WalletLedgerService } from "../src/services/walletLedger";
const draft: DraftInput = {
  title: "Community campaign",
  targetUrl: "https://chat.whatsapp.com/example",
  caption: "Join our community",
  pathway: "DIRECT_SESSION",
  platform: "WA_GROUP",
  mode: "ALLSTATUS_1X",
  tier: "BRONZE",
  sessionCount: 1,
  volume: 100,
  countryFilter: "RANDOM",
  countries: [],
};
for (const [members, status, mode, expected] of [
  [99, "OPEN", "ALLSTATUS_1X", 0],
  [100, "OPEN", "ALLSTATUS_1X", 100],
  [742, "OPEN", "ALLSTATUS_1X", 742],
  [1001, "OPEN", "ALLSTATUS_1X", 1000],
  [742, "OPEN", "ALLCHAT_2X_VIP", 1484],
  [1000, "LOCKED", "ALLCHAT_2X_VIP", 0],
  [1000, "KICKED", "ALLSTATUS_1X", 0],
  [-1, "OPEN", "ALLSTATUS_1X", 0],
  [NaN, "OPEN", "ALLSTATUS_1X", 0],
  [100.5, "OPEN", "ALLSTATUS_1X", 0],
] as const) {
  test(`payout: ${members}/${status}/${mode}`, () =>
    assert.equal(groupPayoutMilli(members, status, mode), expected));
}
test("first threshold boundary", () => {
  assert.equal(withdrawalEligibility(299999, 200000, false).canWithdraw, false);
  assert.equal(withdrawalEligibility(300000, 200000, false).canWithdraw, true);
  assert.equal(withdrawalEligibility(300000, 0, false).canWithdraw, false);
  assert.equal(withdrawalEligibility(500000, 0, false).canWithdraw, true);
});
test("subsequent payout boundary", () => {
  assert.equal(withdrawalEligibility(499999, 0, true).canWithdraw, false);
  assert.equal(withdrawalEligibility(500000, 0, true).canWithdraw, true);
});
test("first payout consumes bonus exactly once", () =>
  assert.deepEqual(validateWithdrawal(350000, 200000, false, 500000), {
    earnedMilli: 50000,
    lockedMilli: 0,
    bonusClaimed: true,
  }));
test("overdraw and non-finite amounts rejected", () => {
  for (const amount of [NaN, Infinity, -1, 499999, 500001, 0.1])
    assert.throws(() => validateWithdrawal(300000, 200000, false, amount));
});
test("invalid balances rejected", () => {
  for (const amount of [-1, NaN, Infinity, 1.5])
    assert.throws(() => withdrawalEligibility(amount, 200000, false));
});
test("integer precision", () => {
  assert.equal(toMilli(0.1) + toMilli(0.2), 300);
  assert.throws(() => toMilli(Infinity));
});
test("legacy wallet API also refuses overdraw", () => {
  const w = {
    ...WalletLedgerService.createInitialWallet("test"),
    earned_balance: 300,
  };
  assert.throws(() => WalletLedgerService.executeWithdrawal(w, 99999));
  assert.throws(() => WalletLedgerService.executeWithdrawal(w, NaN));
});
test("locked group cannot earn even when admin", () =>
  assert.equal(
    WalletLedgerService.calculateGcPayout(
      { memberCount: 1000, status: "LOCKED", isWorkerAdmin: true },
      "ALLSTATUS_1X",
    ).totalCoins,
    0,
  ));
test("existing quote outputs retained as estimates", () => {
  const q = estimateQuote(draft);
  assert.equal(q.workerCoins, 25);
  assert.equal(q.floorNgn, 100);
  assert.equal(q.estimatedNgn, 105);
  assert.equal(q.maxWorkerCoins, 26.25);
  assert.equal(q.estimateOnly, true);
});
test("draft input rejects unsafe destinations", () => {
  for (const targetUrl of [
    "javascript:alert(1)",
    "http://t.me/test",
    "https://evil.example/test",
    "https://t.me@test.invalid/abc",
    "https://chat.whatsapp.com:123/abc",
  ])
    assert.throws(() => validateDraft({ ...draft, targetUrl }));
});
test("draft rejects invalid numbers and empty targeted countries", () => {
  for (const v of [NaN, Infinity, -1, 1.5, 101])
    assert.throws(() => validateDraft({ ...draft, sessionCount: v }));
  assert.throws(() =>
    validateDraft({
      ...draft,
      countryFilter: "SPECIFIC_COUNTRIES",
      countries: [],
    }),
  );
});
test("draft strips untrusted status, owner and pricing", () => {
  const clean = validateDraft({
    ...draft,
    user_id: "other",
    status: "RUNNING",
    costNgn: 0,
  });
  assert.equal((clean as any).user_id, undefined);
  assert.equal((clean as any).status, undefined);
  assert.equal((clean as any).costNgn, undefined);
});
