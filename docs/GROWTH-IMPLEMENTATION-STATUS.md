# Advertiser growth platform — local implementation status

**15 October 2026 · UNRELEASED · Production unchanged**

This is a working, tested **planning and review foundation**, not a completed live commercial growth engine. The existing website remains v0.11.0. No production migration, payment, payout, broadcast, account change, or deployment was performed for this work. No new dependencies were added.

## Latest local implementation — destination URL remix engine

The destination URL—not an advertiser-written caption—is still the promotion. The supplied screenshot has now been inspected and a compositional **destination-name typography / native URL-preview remix engine** implemented, with a protected gallery in saved growth orders. It uses 12 Unicode text styles, seven native font IDs accepted by the installed SDK, 24 layouts, 24 ornament pairs, 24 dividers and 12 backgrounds. Native fonts/colours apply to status posts; ordinary group chat keeps Unicode text and the original real link preview. No flattened generated card replaces the native preview.

**Current evidence:** lint/build PASS; **266 unit/API/SDK tests: 265 passed, one optional Redis integration skipped**; **72 full desktop/mobile/Android-motion browser regressions passed**, followed by two focused final gallery rechecks. Synthetic 10,000 Latin + 1,000 non-Latin allocations passed uniqueness/storage checks, without provider sends. See `docs/GROWTH-REMIX-ENGINE.md` for finite limits, exact measurements and reproduction. These are not physical WhatsApp font tests or funded dispatcher evidence. The older sections/evidence below are historical.

## Available locally

### Advertiser workspace
- New **Grow a community** navigation and overview entry, alongside—not replacing—existing Campaigns.
- Four-step planner for WhatsApp groups/channels and Telegram groups/channels. Self-service and managed-review paths.
- Group targets: **200–2,000 integer new qualifying requests**. Channel targets: **500–100,000 integer net new followers/subscribers**. A large target is a review request, not instant capacity or checkout approval.
- Saved drafts, revision-protected editing, explicit counting/targeting acknowledgment, submission, fixed-quote review/acceptance, cancellation before work, access instructions, activity records, and private JSON reports.
- Deadline-extension decisions: explicit buyer acceptance or decline. Decline leaves work paused for support; no automatic extra spend, target reset, forfeiture or invented refund rule.
- Optional sandbox checkout/verification interface appears on accepted orders, with explicit sandbox consent and configuration checks. It cannot fund or start real work.

### Admin operations
- New **Growth operations** desk with unset-by-default prices, revision protection and immutable quotes.
- Dedicated primary/backup service contacts; duplicate registration of the same platform/phone is prohibited. Assignments cannot share an active service contact.
- Ten-minute access window, matching code, staff permissions attestation, **private retained evidence**, expiration handling, outstanding access-removal tasks and recorded leave confirmation.
- These are **manual attestations**, not certified provider verification or automatic removal. No ownership transfer is requested.
- Aggregate country-audience evidence form. No participant phone list is requested or included in advertiser reports.
- Audience sample size/match/freshness policy starts **unset**. An admin must explicitly choose it. Earlier suggested 20/70%/7-day defaults were not silently adopted as founder policy. Technical input bounds are disclosed in the form/API.

### Worker planning availability
- Optional 30-minute, one-hour, two-hour or four-hour availability, with explicit Off.
- Does not change existing paid-broadcast opt-in, personal posting or wallet rules. It does not promise work or earnings.
- Planning inventory requires current voluntary availability **and** existing paid opt-in, online account/slot, fresh scan, 100+ members, permission, current membership, no applicable removal/announcement lock and room under the existing daily paid-campaign limit.
- Shared groups are deduplicated across accounts; candidate groups are round-robin ordered across owners. This is **planning order**, not an implemented funded dispatch scheduler.
- No 100-group owner ceiling was introduced.

### Counting logic — internal, not connected to a live observer
- Baseline pending requests and repeat participants are excluded. Credited legitimate requests remain credited after approval/cancellation/re-request.
- Conservative supported phone-prefix classification; unknown/LID-only and ambiguous +1 identities are not guessed. Later trusted, in-window metadata can qualify a previously unknown requester once.
- US/Canada group-request filters remain unavailable where supported prefixes cannot resolve them. A declared audience cannot be passed off as a permitted prefix sample.
- Group counting is **window-based**, not source-proven. Buyers see the warning not to share/promote any invite link during the campaign; qualifying requests from other invitations count too.
- Channel growth is **latest exact count minus baseline**, floored at zero—not a sum of positive changes. Baseline/window checks, UTC normalization, duplicate-event and out-of-order handling are covered by tests.
- Channel countries describe advertising-group audiences, not verified follower nationality/location or a guaranteed country split. Telegram starts without country targeting.
- Target fulfillment stops unstarted batch records and marks service access for removal. Deadline maintenance pauses work; extensions require consent.
- **Tests manufacture RUNNING states only inside isolated synthetic databases. The application has no authorized live start path.**

### Sandbox pay-in adapters
- Squad primary, Kora backup; only provider-specific sandbox key prefixes are accepted. No live key path exists.
- Integer kobo storage, exact decimal conversion for Kora, owner-bound references, amount/currency/reference checks, bounded request concurrency/time/response size, fixed provider hosts and checkout-host validation.
- Configuration is checked before creating an intent. An uncertain attempt blocks switching providers until authoritative reconciliation; successful sandbox verification is idempotent and does not mutate treasury/worker balances.
- Kora webhook verifies the documented data-only HMAC and independently queries the provider. **Squad webhook returns 503** because its signature algorithm has not been certified from the retrieved official contract.
- Provider tests use explicit synthetic fetch fixtures. **No merchant-key sandbox transaction or provider acceptance test has been run.**

## Not implemented or not certified — launch blockers

1. **Real provider-backed access, counting and removal adapters:** bind dedicated service identities to the runtime; establish complete timestamped baselines; ingest trustworthy WhatsApp/Telegram events; reject nonmatches through supported operations; cancel invitations/leave promptly and verify removal. Telegram runtime/inventory integration is absent.
2. **Live funding and campaign reserves:** connect independently verified merchant pay-ins to existing reconciled treasury backing, buyer commercial terms and campaign-specific reserves. Sandbox VERIFIED is not cash.
3. **Funded wave engine:** wave → observe/reconcile → remaining target → next funded wave, with cross-wave dedupe, current permission/membership/availability rechecks, durable delivery proof, fair actual scheduling, full bonus/referral backing and no unfunded work. Batch tables and planning are foundations, not this dispatcher.
4. **Payout adapters:** no Squad/Kora live payout implementation is connected. Uncertain payout reconciliation and approved currency/merchant contracts still require implementation and controlled validation.
5. **Commercial operating approval:** founder-set prices, permitted audience-evidence policy, real inventory/capacity, merchant approval, review procedures, retention/privacy policy and provider-controlled test evidence. Define and test observation continuity across pause/resume before real extensions are offered.
6. **Controlled launch/release:** final integration tests, environment/funding checks, preserved session/data backups, migration/recovery verification, versioning and guarded deployment. No live-enable setting or admin button bypasses these missing integrations.

These are not merely missing credentials: significant integration work remains. Do not advertise automatic group fulfillment, channel delivery, 100k availability, country verification, payouts, anti-ban protection or instant launch from this build.

## Initial foundation verification (before the URL-only correction)

- TypeScript lint: **PASS**.
- Production frontend build: **PASS**.
- Full unit/API/security/accounting/native suite: **247 tests; 246 passed, 1 optional Redis skipped, 0 failed**. Includes 29 new growth tests.
- Full desktop/mobile browser regression: **64 passed**. Covers the existing earning-first site, wallet/referrals, legacy campaigns, pairing/composer interfaces, media/preview contracts, calculator, menus and the new growth journeys.
- Final focused recheck: **12 passed** (8 growth journeys plus 4 Android motion checks), followed by **2 additional desktop/mobile extension-decision tests passed**. Evidence: `docs/testing/growth-final-browser-results.txt` and `growth-extension-browser-results.txt`. These overlap the regression suite; they are not 78 distinct browser cases.
- New growth states passed automated WCAG A/AA checks and horizontal-overflow checks at the tested desktop/mobile sizes. Screenshots were generated and representative desktop/mobile screens visually inspected. Automated checks are not a full accessibility certification or a physical-device guarantee.
- Existing `package.json`, `package-lock.json`, `backend/earning.ts`, `backend/whatsapp.ts`, `backend/personalDispatch.ts` and `shared/earningRules.ts` were byte-compared against production baseline commit `2d205b774942817ad005589707bb332f586b5efa`: **unchanged**.

No 1,000-user throughput claim, real delivery proof or provider reliability SLA is inferred from these tests.

## Files and reproducibility

Core: `shared/growthRules.ts`, `backend/growthSchema.ts`, `backend/growth.ts`, `backend/growthPayments.ts`, `backend/growthRoutes.ts`.

Interface: `src/components/GrowthCampaigns.tsx`, `GrowthAudienceSettings.tsx`, `GrowthAvailability.tsx`, `GrowthSandboxCheckout.tsx`, `src/growth.css`; additive wiring in `Workspace.tsx`, `backend/app.ts` and `backend/database.ts`.

Tests: `tests/growth*.test.ts`, `tests/growth-fixtures.ts`, `tests/browser/growth.spec.ts`; the migration test now expects schema version 10. The browser referral test passes the isolated QA access header to its additional browser context.

Run `npm run lint`, `npm run build`, `npm test` using Node 22.16+ and the existing lockfile. Migrations 9 and 10 are additive and local only; they create no money, users or pre-priced services. Migration 10 adds immutable creative snapshots and placements, not a dispatcher. Existing schema-upgrade preservation tests pass.

Browser QA uses `scripts/growth-qa-server.ts` and `playwright.growth.config.ts` with a separate absolute `GROWTH_QA_FOLDER`, randomly generated private `access-token`, and separate SQLite database. It does not load WhatsApp or real payment credentials. The gate prevents public access to test accounts. Do not aim QA at production data. QA servers were stopped after verification; their isolated credential/database folders were removed. To rerun, create a new private QA folder/token/database.

## Representative screenshots

- `docs/screenshots/growth-mobile-service.png`
- `docs/screenshots/growth-desktop-review.png`
- `docs/screenshots/growth-mobile-admin-policy.png`
- `docs/screenshots/growth-mobile-worker-shift.png`

**Deployment/GitHub status:** not deployed and not pushed. Existing production remains untouched. This document and source are a local implementation handoff, not a commercial-launch certificate.
