# Coins-first experience and click-open navigation — v0.6.0

Date: 15 October 2026. Domain: https://pappy-earnig-hub.duckdns.org

## Founder-authorised changes

- The workspace menu starts closed on desktop and mobile. A visible menu button opens the same drawer at every width. Closed navigation is hidden and inert; the open drawer traps keyboard focus, locks background scrolling, closes by Escape/outside click/navigation and restores opener focus. Initial focus also works with reduced motion; a transition-end fallback handles the entrance animation.
- Landing decoration starts automatically when suitable, pauses out of view/in a hidden tab and settles after a short entrance. Reduced-motion and data-saving preferences are respected. No Play/Pause controls, 3D footer labels or design-permission wording remain.
- Public worker/advertiser experiences lead with Coins. Internal integer accounting, operator NGN records and the existing 1 Coin = NGN 1 backing are unchanged. This is international presentation, **not** a promise of worldwide cashout. Before any future cashout opens, supported locations, payout currency, conversion quotes and fees must be disclosed.
- Referral reward is now **100 Coins**, once, after the referred worker's first qualifying confirmed positive funded placement. Signup is not a credit. Existing qualification, anti-fraud, funding and one-time/idempotency protections remain.
- A disclosed **1,000-Coin daily illustration** uses 50 unique eligible groups with 1,000+ members × 10 distinct funded campaigns × 2 separately confirmed post types. It is not a guarantee, current available job count or new earning ceiling. The calculator offers the same example and status/chat/both selection. Paid jobs and withdrawals remain unavailable.

## Financial migration and preservation

Schema migration 5 transactionally rebuilds the legacy referral table because its old CHECK allowed only 5,000 milliCoins. It preserves IDs, foreign-key targets, timestamps, relationships and all existing rows. Both historic 5,000 and current 100,000 amounts remain valid. Only **PENDING** legacy rates become 100,000. **RESERVED** and **EARNED** amounts remain unchanged; a trigger prevents changing locked amounts.

A legacy reservation released without delivery first returns its actual old hold, then becomes a current-rate pending referral. Both legacy and current paid reservation paths refresh pending rates before affordability checks. No signup credit, unfunded payable or retroactive settled-rate increase is introduced. The test isolating the 100-Coin one-milli funding boundary explicitly waives synthetic welcome bonuses; production still requires normal bonus backing.

Foreign keys are disabled only around the table rebuild, checked before commit and restored afterward. A dedicated failed-FK test verifies rollback of table structure, amount changes and migration marker. Historical settled ledger/held backing, child foreign keys, idempotency, immutable booked amounts and released legacy holds are tested. WAL startup now configures SQLite's busy timeout **before** journal mode: a full-suite subprocess race exposed the old reverse-order lock failure, fixed rather than hidden with a rerun.

## Verification

- TypeScript lint: PASS.
- Production build: PASS.
- Unit/integration suite: **167 tests: 166 passed, 1 Redis integration skipped, 0 failed**.
- Five additional repetitions of the independent-process financial race suite: **10 passed**.
- Desktop/mobile browser suite: **32 passed**. Includes automated WCAG A/AA checks, drawer focus/Tab/Escape/inert/reduced-motion behavior, no horizontal overflow, closed initial desktop menu, public Coins copy, 100-Coin pending referral, unchanged synthetic zero-earned balance, consistent 1,000-Coin calculator, composer/auth/admin/advertiser regressions.
- Browser tests use isolated QA data and contract doubles where stated; they are not evidence of actual WhatsApp rendering or delivery. No real messages or joins are issued by the tests.
- Public production read-only checks: **28 passed**, **0 accounts created**, **0 WhatsApp requests**.
- Local Git-only backup tests: **7 passed** (dedicated branch, no main overwrite, dirty-tree rejection, subsequent commit hook, local commit retained offline, sensitive-history filename rejection, high-confidence credential-pattern rejection).

## GitHub source preservation

Existing origin discovered on the authorised VPS: `https://github.com/Anonymous20666/earning-hub.git`. Read access works. HTTPS push dry-run failed because write credentials were unavailable. The earlier reference-repository token was not retained or reused.

A fresh repository-specific Ed25519 deploy key was generated under root's protected SSH directory. Only its public half was shown to the founder. The founder must add it in this repository's **Settings → Deploy keys**, with **Allow write access**. The private key is not in the source tree or deliverables. Official GitHub SSH host keys are obtained over verified HTTPS from GitHub's `/meta` endpoint; no unverified keyscan or disabled host checking is used.

`deploy/push-source-backup.sh` pushes committed source to **backup/earning-hub**, never force-pushes, refuses `main`/`master`, checks reachable Git history for sensitive filenames and high-confidence credential patterns and refuses a dirty source tree. An optional per-repository `.githooks/post-commit` hook retries source backup after future commits, retaining local commits and clearly warning if remote authentication fails. The hook requires explicit local installation (`git config --local core.hooksPath .githooks`); cloning alone does not execute it.

GitHub is a **source backup only**. SQLite, account data, WhatsApp authentication, encryption keys and environment secrets are excluded. Existing protected on-server database backups do not replace encrypted off-server disaster recovery; that remains an operational gap, not a claim of permanent safety.

## Release outcome

**DEPLOYED and healthy: v0.6.0** at the exact domain above.

- Verified pre-migration SQLite backup: `/app/data/backups/pappy-2026-10-15T06-01-57-482Z.sqlite`.
- Prior container retained: `pappy-earning-hub-rollback-20261015T060145Z`.
- New image: `sha256:a9adb5e17c6b0e4da6681b00baaa8f3631a8bccaa7f3a47c18ddef51fbf57b98`.
- Schema 5 installed; zero foreign-key errors. 22 normalised business/identity fingerprints unchanged; raw referral rows also unchanged (production had no referrals requiring a rate update). Wallets, ledger, funding, campaigns, delivery/broadcast records and permissions unchanged. Cash remains zero; paid dispatch settings unchanged/off.
- Existing slot ONLINE, both existing small groups preserved, all 901 encrypted authentication entries and the credentials entry preserved. Encryption configuration content and root-only 0600 permissions unchanged.
- `docs/testing/international-preservation-check.json` and `international-domain-readonly.json` record verification. No production test account, message or join was created.
- When transferring source archives as root, use `tar --no-same-owner`; do not import workspace ownership into the production working tree. Source ownership was restored without changing persistent database/auth ownership or using a global Git safe-directory exception.

GitHub push status is still pending the repository-specific write grant; local source history and a downloadable source bundle are retained. Do not describe a backup branch as pushed until a remote ref comparison succeeds.
