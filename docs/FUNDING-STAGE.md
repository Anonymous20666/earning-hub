# Funding-first earning stage — v0.2.0

Date: 15 October 2026. Status: pre-launch implementation; real messaging and money movement are OFF.

## What is actually built

### Worker-facing
- An exact member-count earning calculator. The agreed 256 / 290 / 466 / 278 example totals **1.290 Coins**, not 1 Coin per group. Calculations never credit a wallet.
- Two number slots, provider-only account registration/scanner functions, permanent keyed number-owner history, and a real empty inventory until a provider supplies data. No fake pairing codes or invented groups.
- Raw membership, unique qualifying group, duplicate and consent-approved counts. Exclusion is ownership-checked and never makes a number leave a group.
- Bronze 1–25, Silver 26–99, Gold 100+, with full 100-group units and remainders. Tiers do not impose an earning ceiling.
- Real personal referral links and registration attribution. A referral is **₦5 = 5.000 Coins**, pending at signup. Only an internally verified funded delivery can activate it, once. Pending amounts are not earned or withdrawable.
- Updated worker/website/platform-rule text; original account, draft, support and wallet functionality retained.

### Financial and dispatch core
- Idempotent additive SQLite schema version 2. Integer milliCoins throughout; 1 Coin = ₦1, including international users. Aggregate recorded treasury cash is bounded to the supported DECIMAL(12,3)-equivalent range.
- Operator-recorded cleared-funding receipts, unique funding references, append-only receipt/event records, and cash conservation checks. A funding entry **does not collect or independently verify bank money**: an authorised operator must check the actual settlement first.
- Admin-only house-campaign drafts, funding reservations, unused reward-budget release and dispatch stop. There is no browser deposit, direct wallet-credit, consent-override or delivery-confirmation endpoint.
- Separate available cash, reserved campaigns/referrals, earned obligations and conditional-bonus backing. New work cannot borrow money already owed to workers.
- Campaign/group uniqueness, account fairness, current posting permission, current verified group consent, fresh scans, budget stops, owner-level capacity of at most ten distinct campaign participations per UTC day.
- Durable dispatch outbox and a real BullMQ/Redis producer/consumer framework. Queue IDs and database idempotency keys prevent duplicate financial settlement. Redis is not the wallet authority.
- Revalidation before sending; membership changes cancel an unsent job rather than silently changing its agreed reward. Provider acceptance alone does not credit money. Unknown sending outcomes retain funds and must be reconciled, never blindly retried.
- Verified-receipt settlement logic and referral funding/activation tested under replay, failures and concurrent processes. A different in-flight group can activate an already-backed referral if it succeeds first.
- Read-snapshot reconciliation of cash, receipts, reserved jobs, campaigns, bonus backing, earned wallets and earned ledger records. Existing unsupported liabilities trigger a block rather than fabricated funding.

## Important conservative backing choice

The campaign's **worker-reward budget is not its entire business cost**. Before a new worker's first delivery is reserved, the full conditional 200-Coin welcome bonus is separately backed from available cash. A qualifying referral additionally needs 5 Coins, plus the referrer's conditional bonus backing if not already backed.

This does not unlock or pay the welcome bonus early. The first withdrawal rule remains at least 300 earned Coins plus the one-time 200 bonus, minimum 500 total; subsequent minimum 500 earned Coins. No P2P transfer feature exists.

Bonus backing remains visibly reserved even after an unsent job fails. It is not silently recycled into campaign money while a conditional worker obligation remains. A future cancellation/eligibility policy must explicitly address releasing unused conditional backing; no automatic forfeiture is implemented.

## Production boundaries — do not confuse source code with an enabled service

- **No production WhatsApp provider adapter is bundled.** No Baileys dependency, socket, live pairing flow or approved group-broadcast connection is installed. Unofficial automation is not equivalent to WhatsApp platform approval. See `backend/providers/README.md`.
- No production Redis service or broadcast worker is started by this release. BullMQ is installed and its pipeline is tested against a dedicated isolated local Redis with a clearly synthetic provider, not real WhatsApp.
- `npm run worker` refuses to start unless explicitly enabled and supplied with an installed, ready operator-reviewed provider adapter. A setting or API key cannot create the missing adapter. Database dispatch also defaults OFF; the web app can stop it but cannot enable it.
- No payment gateway, actual deposit collection, payout provider, FX conversion or withdrawal execution exists. Existing APIs fail closed without changing balances. The reconciliation model intentionally does not yet include completed payout debits: this must be added and tested with a real payout integration before withdrawals are enabled.
- PostgreSQL/Prisma migration is **not done**. The active runtime remains the preserved SQLite app; `prisma/schema.prisma` is explicitly marked historical and is not a deployable migration. This is not a distributed-scale financial deployment.
- Fixed ₦30/₦80/₦180 session checkout has not been enabled because its reward/cost conflict remains unresolved. Legacy advertiser estimates remain nonbinding and separate from the new standard earning core. Legacy VIP calculations are not an active earning mode.
- No real funds, earnings, admin credentials or investor balances are seeded. Production should retain ₦0 recorded cash and dispatch OFF until cleared funds are actually checked and recorded.
- No automatic group joining/leaving, spam evasion, device fingerprinting, or purported perfect VPN/physical-person detection. Shared or dynamic IPs are not identity proof. Phone-owner history is not a substitute for a reviewed fraud/KYC policy.

## Funding operator commands

No public administrator is created or promoted automatically. Founder approval and exact-account operator provisioning are required. Never use a shared/default admin login.

Use Node **22.16+** and an existing authorised database. For production, execute inside the isolated app container or an equivalently protected operator environment. Do not print private funding evidence, raw credentials or bank statements to public logs.

```bash
DATABASE_PATH=/path/to/existing/pappy.sqlite npm run treasury -- reconcile

# Only AFTER separately checking actual cleared money:
DATABASE_PATH=/path/to/existing/pappy.sqlite npm run treasury -- \
  record-cleared-funding /private/verified-receipt.json --confirm-cleared-funds
```

Receipt JSON fields: `adminId` (an existing approved ADMIN account), `amountMilli` (integer), `source` (`BANK_TRANSFER`, `OWNER_CAPITAL` or `SETTLED_REVENUE`), `reference` (actual unique settlement reference), and `evidenceNote` (a meaningful verification note). There is intentionally no sample live ID, default admin password or auto-funding command.

A promised investment, unsold community, CPA conversion, pending gateway transaction, forecast ad revenue or screenshots of an unverified transfer are not cleared funding. A book entry must not be used to conceal a cash shortage. External bank reconciliation and operator accountability remain necessary.

## Verification

Evidence is saved under `docs/testing/funding-stage-*` and `docs/testing/axe-funding-*`; screenshots under `docs/screenshots/funding-*`.

Tests include exact precision, minimum membership, permission checks, 130 paid groups (no 100-group ceiling), two-number deduplication, separate-process reservation/settlement and funding races, receipt replay/conflict rollback, budget stops, unknown transport outcomes, referral activation/funding transfer, ownership/role/CSRF isolation, immutable money records and reconciliation.

```bash
npm ci
npm run lint
npm run build
npm test  # real-Redis test explicitly skips unless isolated test Redis is supplied
# Dedicated local test Redis only; never point this test at a live Redis:
TEST_REDIS_URL=redis://127.0.0.1:16388 npm test
```

Browser tests exercise actual persisted referral registration, exact illustration-only calculations, real empty inventory, zero-cash funding rejection and the existing worker/advertiser workflows at desktop/mobile widths. Local synthetic QA accounts, group metadata and balances are never copied to production. Automated accessibility checks are samples, not certification.

## Deployment and rollback

The release uses the existing authorised VPS app container, host database volume, dedicated nginx domain and TLS setup. It does not touch unrelated sites, containers, Redis instances or databases. The deployment script builds first, takes a SQLite-consistent integrity-checked backup, preserves the old container, and runs the same restricted non-root container profile.

The migration only adds tables, indexes, triggers and `wallets.bonus_backed_milli`; it preserves existing users, sessions, password hashes, balances and ledger entries. Rollback to the saved v0.1.0 container can use the additive database without restoring over new registrations. Stop the new app, rename it aside, rename/start the recorded rollback container, verify HTTPS/health and keep all evidence. Restore a database backup only under a separately reviewed data-recovery plan; never overwrite intervening real user writes blindly.

Before a real paid pilot: provision the founder-approved operator account; complete legitimate provider/consent/pairing integration and credential protection; test actual recipient delivery evidence and receipt replay; verify actual cash plus bonuses/referrals; resolve checkout economics; complete country/fee-aware payout integration, privacy/retention/terms and fraud controls; review migration/capacity for the intended workload. Up to ten broadcasts is capacity, never guaranteed demand or income.
