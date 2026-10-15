# Release handoff — funding-first earning foundation v0.2.0

**Released:** 15 October 2026  
**Permanent URL:** https://pappy-earnig-hub.duckdns.org  
**State:** healthy, pre-launch; recorded cash ₦0; dispatch OFF; actual messaging, deposit collection and payouts OFF.

## Available to review

Sign in to the existing worker account and open:

1. **Earning calculator** — exact per-group calculation; the agreed four counts give 1.290 Coins. Hypothetical results never enter the wallet.
2. **Connections** — two account slots; real empty inventory; membership, unique, duplicate and permission counts. Pairing is explicitly unavailable until a legitimate provider integration is completed.
3. **Referrals** — a real unique share link, optional code on worker signup, ₦5 pending referral attribution and status history. Signup alone does not create earned money.

The admin-only funding/house-campaign interface and internal cash-backed reservation/settlement machinery are implemented and tested. No administrator was created or promoted in production; owner-approved provisioning is still required. Full details and funding procedures: [FUNDING-STAGE.md](FUNDING-STAGE.md).

## Verification actually completed

| Check | Result |
|---|---|
| Clean `npm ci`, TypeScript, production build | Passed |
| Unit/API/financial/migration/concurrency/queue tests | **92 passed, 0 failed, 0 skipped**, including real isolated Redis/BullMQ processing |
| Desktop browser suite | **9 passed** |
| Mobile browser suite | **9 passed** |
| Actual public HTTPS browser checks | **20 passed** |
| Sampled automated accessibility checks | Zero violations in saved samples; not certification |
| Production npm dependency audit | Zero known reported vulnerabilities; not an OS/security certification |
| Production SQLite integrity / foreign keys | `ok` / no violations |
| Treasury reconciliation | All 9 checks passed, all cash buckets zero |
| Original account, password/profile fields, wallet balances, ledger, auth sessions, drafts | Byte-for-byte query-result comparisons match the pre-release backup |
| Temporary public test cleanup | Three exact guarded test accounts removed; original 1 user / 1 wallet / 1 ledger row retained |
| Production admins / paired accounts / referrals / campaign drafts | 0 / 0 / 0 / 0 after cleanup |

Tests explicitly cover 130 qualifying groups, exact scattered counts, two-number deduplication, concurrent shared-group settlement, concurrent treasury funding, changed/revoked group eligibility, uncertain transport outcomes, receipt conflicts and replay, referral first-success races and funding transfers, budget backing, CSRF/role/ownership denial and schema-v1 preservation.

Screenshots are genuine browser captures. Local QA screenshots use synthetic test accounts. Public-domain screenshots use a temporary deployment-verification account subsequently removed; the calculator is clearly labelled illustration-only. None is evidence of paid customer activity or a live WhatsApp integration.

## Release and rollback evidence

- Previous source commit: `b399f7f`; branch `mission-01-20261015`. No repository push performed.
- New image: `sha256:f057b6df1e71333fc4ac7418b798b98517daa11ed5f1ae3323fc5667aa9dff64`.
- New container: `cd6f4c6a5f7ffcbe7e00c887dd64305e14853d1cb22f82436c58ec31022b2fb6` (`pappy-earning-hub`).
- Integrity-checked pre-migration backup: `/var/lib/pappy-earning-hub/backups/pappy-2026-10-15T03-15-12-525Z.sqlite`.
- Preserved previous container: `pappy-earning-hub-rollback-20261015T031504Z`.
- Additive schema v2 preserves v1 data and earlier web statements. Roll back the container first if required; do not overwrite new user writes by blindly restoring a database backup.
- Dedicated nginx/TLS, proxy settings, resource restrictions and unrelated VPS services unchanged. No new production Redis service or worker started.

Evidence: `docs/testing/funding-stage-unit-results.txt`, `funding-stage-browser-{desktop,mobile}.txt`, `funding-stage-domain-browser.json`, `funding-stage-production-verification.txt`, `funding-stage-production-cleanup.json`, `funding-stage-preservation.json`, `funding-stage-deployment.txt`, `funding-stage-audit.json`, and `axe-funding-*.json`.

## Not completed or enabled

This is the first earning-stage build, **not a finished paid broadcast marketplace**. The production WhatsApp adapter/pairing and verified consent/evidence ingestion, encrypted provider credential lifecycle, actual bank/payout/FX integration and payout debits, PostgreSQL migration/capacity work, fraud/KYC/retention/legal review, and the unresolved fixed-price checkout decision remain open.

BullMQ/ioredis are installed, and a durable queue/worker framework is tested. Its provider contract is not itself a WhatsApp integration. No Baileys socket, real pairing code, supported group delivery or real earnings are claimed. Keep all paid dispatch and payouts off until those gates and actual cleared funding—including separate bonuses/referrals—are satisfied. Expected advertising revenue is never cash already received.
