# Earning-first product story — v0.7.0

15 October 2026. Founder direction: the platform's main purpose is earning through connected WhatsApp groups; free personal broadcasting is a secondary benefit, not the lead story.

## Experience

1. Hero: **Connect your WhatsApp. Get ready to earn.** Primary action connects an existing worker or starts worker registration. Pairing alone does not pay; paid jobs/withdrawals are not open yet, stated beside the action.
2. Exact public reward examples, derived from shared earning rules: 100 members → 0.100 Coins; 742 → 0.742; 1,000+ → 1.000 per confirmed funded status OR chat post. Both confirmed in the 742-member example = 1.484 Coins. Group permission, 100-member minimum, deduplication, one qualifying group being enough and ten-distinct-campaign daily capacity are explained. No reward depends on clicks or joins.
3. Getting started: pair own number → check group permission/eligibility → earn from confirmed qualifying funded work when jobs open. Advertiser planning journey remains functional.
4. Conditional 1,000-Coin daily illustration retained with its original arithmetic/availability limits; not a promise or new earning ceiling.
5. 100-Coin qualifying referral, locked 200-Coin welcome bonus and future cashout conditions explained separately. Public whole-Coin bonus/threshold labels are simpler; stored amounts are unchanged.
6. Free personal posts introduced **after** the earning explanation. Working Text/link/media composer remains separate, free and non-earning. Business campaign planning remains available.
7. Signup, worker overview and QuickStart now reinforce the same earning-first purpose. A connected/approved worker's next earning action explores actual reward rates; a separate free-post action remains available. Already-signed-in non-worker visitors are sent to their own workspace/campaigns, not worker-only routes.

The founder confirmed that v0.6.2 motion worked in their Android Chrome. This release preserves its motion preference/animation engine and only updates the illustration's product wording. No Play/Pause or design narration restored.

## Verification

- Lint/build PASS.
- Unit/integration: **170 tests, 169 passed, 1 Redis check skipped, 0 failed**. New tests render public rates from the shared rules, check availability/qualification wording and verify honest role-aware CTA destinations.
- Final full browser run: **40 passed**, including Chrome Android motion, desktop/mobile earning hierarchy and routes, 360/390/768/1024/1440px overflow checks, exact rewards, business journey, advertiser role-aware links, auth, wallet, composer, consent and automated axe checks.
- An earlier regression run exposed a pre-existing intermittent review-focus race: the async handler's animation frame could run before React committed the review heading. Focus now runs from a post-commit effect tied to the draft ID. No posting/funding logic changed. The original assertion remains; six additional repeated desktop/mobile composer tests and the final full suite passed.
- Screenshots are captured at CSS-pixel resolution; mobile emulated DPR/touch/browser configuration is unchanged. This avoids excessive high-DPR full-page evidence bitmaps without weakening functional assertions.
- Actual public domain: **35 read-only production checks passed**, including exact public reward examples/order, earning-first hero, Android motion preference/persistence and unchanged closed financial gates. Zero accounts created, WhatsApp requests, messages or joins.
- **Deployed and healthy: v0.7.0**. 23 business/identity fingerprints unchanged, zero foreign-key errors, existing encrypted authentication/credential entries, groups, ONLINE slot and encryption configuration/permissions preserved. Treasury and paid settings unchanged. Evidence: `docs/testing/earning-first-preservation.json`.
- Verified pre-release backup: `/app/data/backups/pappy-2026-10-15T07-14-27-644Z.sqlite`. Prior container: `pappy-earning-hub-rollback-20261015T071416Z`.
- No claim of full manual WCAG conformance or physical-device coverage beyond the founder's reported motion confirmation.

## Boundaries

No reward/pricing, referral trigger, funding, balance, migration, consent, paid/payout gate or actual messaging rule changed. Internal 1 Coin = NGN 1 backing remains; public copy stays Coins-first. No invented jobs, earnings, testimonials or global payout methods. Source-only GitHub backup remains pending its previously requested deploy-key write grant; local commits/bundles are not represented as remote pushes. Private data/authentication never belong in source backups.
