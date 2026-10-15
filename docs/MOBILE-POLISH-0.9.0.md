# Mobile controls and personal posting — v0.9.0

## Report and root causes

The founder's actual Android screenshots showed Review/Post looking like plain text and a public calculator with inline labels, cramped controls and poorly grouped examples. Functional click tests alone had not detected those presentation failures.

The personal composer used `.btn` / `.btn-outline` but the base stylesheet defined only `.button` / `.button-outline`. The public calculator was outside the `.earning-hub` scope that provided its form styles. Both defects are corrected; the calculator now owns its styling scope regardless of route.

## Changes

- Filled dark-green Review and Post actions with white text, 56px minimum height, generous padding, full width on mobile, visible keyboard focus and disabled/pressed states. Back is an outlined secondary button. Existing `.btn` controls elsewhere now receive the missing base button styles too.
- Calculator fields are individually grouped and vertically stacked, with full-width 16px inputs/selects, comfortable spacing, visible control borders, a distinct example fieldset and outlined example buttons. Desktop uses two result/input columns; smaller screens stack them without overflow. Public and signed-in calculator routes share the same component and styles.
- Removed the personal-only three-runs-per-UTC-day quota, sixty-second run-start gap and 200-group/run ceiling. Workspace metadata now reports `dailyRuns: null`, `minGapSeconds: 0`, `maxGroups: null`. Every eligible unique owned group is planned, without silently truncating at 200.
- No database resets, history deletion, schema migration or dependency changes. Paid campaign limits and all reward/referral/wallet rules are unchanged.

## Safeguards deliberately retained

Explicit owner confirmation and immutable ten-minute reviews; owner/account checks; two-number shared-group deduplication; selected-number binding; ignore lists; native membership, locks and removal restrictions; idempotent submission; and no automatic replay of uncertain sends. Existing safe dispatch pacing and technical HTTP/concurrency abuse protection remain. Removing application posting quotas does not bypass WhatsApp's limits or promise unlimited throughput/delivery.

Paid work remains funding-first and OFF, as do payments and payouts. Personal posts never earn Coins or qualify referrals. The paid ten-distinct-campaign/day rule and 100-member = 0.100-Coin funded-leg formula are untouched.

## Verification method

New browser regressions check computed button backgrounds, solid borders and real bounding-box heights, not just whether a button can be clicked. Calculator checks inspect vertical separation of every field child, full-width control geometry, 16px input fonts, minimum touch targets, clipped text and page overflow at 360, 393, 430, 768 and 1440px. Actual screenshots are inspected as well as automated accessibility results.

Backend regressions prepare and submit all 201 unique owned groups, and queue eight confirmed posts back-to-back without editing timestamps. They check idempotency, missing-confirmation rejection, unchanged wallets, no new ledger credit and disabled paid dispatch. Existing expiry/media checks, ownership/security tests, paid capacity tests and no-retry/native SDK compatibility tests remain.

Authenticated composer screenshots and journeys use clearly synthetic isolated QA data with WhatsApp disabled. Production verification uses only public read-only pages and anonymous rejection checks: no production accounts, pairing, group scans or messages are created. Browser mobile emulation and installed-SDK unit tests are not claims of physical Android/WhatsApp delivery verification.

Source recovery remains separate from live database/key backups. Do not restore an old database over subsequent legitimate user activity. GitHub write permission is pending; retain and independently verify the incremental source bundle chain.

## Executed release results — 15 October 2026

**Live and healthy:** https://pappy-earnig-hub.duckdns.org — v0.9.0 / pre-launch.

- TypeScript lint and production build PASS; lockfile dependencies unchanged.
- Unit/API/security/finance/native SDK: **185 tests, 184 PASS, 1 optional Redis integration SKIP, 0 FAIL**.
- Final full browser regression: **54 PASS, 0 FAIL, 0 SKIP**, desktop/mobile/Android-motion. Includes geometry/appearance checks at all five widths, accessibility scans, confirmation and unchanged financial/no-retry behavior. An earlier run had four admin-fixture failures because QA_DATABASE_PATH pointed at a different isolated database; the final run used the actual isolated server database and passed without weakening assertions or changing production roles.
- Actual production public checks: **39 PASS**, plus **11 mobile-specific PASS** including rendered geometry and accessibility at 360/393/430px. A new currency assertion initially used an ordinary space where the real formatted output contains a nonbreaking space; corrected to a whitespace match while retaining the exact USD 3.75 value, then all 11 passed. Zero production accounts or real WhatsApp actions were created.
- Fresh before/after release preservation PASS: all 23 business/identity/history fingerprints identical; wallets, ledger, treasury, settings, referrals, group counts and migration versions unchanged. WhatsApp auth entries **904 → 904**, credential count unchanged, existing slot 1 ONLINE, root-only key configuration hash/permissions unchanged, foreign-key errors zero. Live read-only treasury reconciliation: all ten checks PASS. No schema migration or history rewrite.
- Reviewed actual calculator/result screenshots and both composer steps. Saved new evidence under `docs/screenshots/mobile-polish-*` and `docs/testing/mobile-polish-*`. Mobile element screenshots can include Chromium's off-viewport fixed skip-link capture artifact; a separate live-DOM check confirmed it remains unfocused at top -70px, bottom -32px, outside the actual viewport. Keyboard skip navigation is retained.

Verified SQLite backup: `/app/data/backups/pappy-2026-10-15T11-36-59-994Z.sqlite`. Preserved v0.8.1 rollback container: `pappy-earning-hub-rollback-20261015T113648Z`. The live data volume and external configuration remain in place. Never overwrite later activity with the old backup.
