# Actual implementation state — v0.2.0 funding-first foundation

The historical prototype architecture is preserved at `legacy/ARCHITECTURE-original.md`. It is not a description of a live earning network.

## Deployed runtime

```text
Browser
  -> https://pappy-earnig-hub.duckdns.org (dedicated nginx TLS vhost)
  -> VPS loopback 127.0.0.1:3107
  -> isolated non-root Docker container
  -> Express API + built React/Vite SPA
  -> Node 22 built-in SQLite, WAL, foreign keys, integer milliCoins
  -> persistent host directory /var/lib/pappy-earning-hub
```

The temporary SSH review tunnel has been stopped. HTTPS and automated certificate renewal/reload have been verified. The app trusts exactly one proxy hop only with nginx overwriting incoming forwarding headers.

### Active browser/API features

- `backend/app.ts`: session authentication, role/ownership/CSRF/origin controls, account/draft/support persistence, worker earning records, referral registration, restricted house-campaign/treasury APIs.
- `backend/database.ts` / `backend/earningSchema.ts`: idempotent additive schema versions 1–2, constraints and immediate transactions.
- `backend/earning.ts`: funding receipts, reservations, internal confirmed-receipt settlement, referral activation and snapshot reconciliation. No browser endpoint can invent paid delivery or edit a wallet.
- `backend/inventory.ts`: internal provider-authenticated number/scanner/verified-permission persistence. These are not a connected WhatsApp service.
- `shared/earningRules.ts`: new standard exact rewards, tier/inventory rules and decimal-string parsing. `shared/rules.ts` retains withdrawal rules and legacy nonbinding advertiser estimates; legacy VIP estimates are not an active reward mode.
- `backend/treasury-cli.ts`: protected operator recording of independently checked cleared funds and reconciliation. It neither receives money nor validates bank settlement automatically.
- `backend/backup.ts`: consistent SQLite backup using `VACUUM INTO` and integrity checks.
- `src/components/EarningHub.tsx`: earning calculator, real empty inventory/two slots, pending referral links/history and admin treasury/house-campaign controls.
- `src/api.ts`: in-memory CSRF client, same-origin session cookies. No browser password or bearer-token storage.

### Implemented but deliberately inactive dispatch framework

```text
Verified/allocated campaign funds
  -> atomic SQLite reservation + outbox
  -> BullMQ / private Redis queue
  -> provider-only fresh metadata + permission/funding revalidation
  -> stable provider message ID + SENDING state before transport
  -> real provider acceptance (NOT earning credit)
  -> authenticated confirmed-delivery receipt
  -> idempotent SQLite wallet/referral settlement
```

`backend/dispatch.ts` implements the queue/worker framework. `backend/broadcast-worker.ts` is a separately enabled coordinator that refuses to start without an installed, ready provider adapter. **No production provider adapter is bundled; no production Redis/worker is started by the release script.** Tests use a dedicated local Redis and a labelled synthetic provider. No real WhatsApp/Baileys socket, pairing code, credentials or group broadcast is present.

SQLite is the source of financial truth; Redis loss cannot manufacture earned balances. An outbox publish replay is deduplicated, and jobs known to have begun sending are not blindly sent again. `UNKNOWN` results retain funds for provider reconciliation. This is not an assertion of exactly-once network delivery or distributed production readiness.

## Financial invariants

- 1 Coin = ₦1; amounts are integer thousandths. Standard group reward is `min(members,1000)` milliCoins for a unique qualifying successful group with at least 100 members.
- One qualifying group suffices; two number slots/owner; the campaign/group key is globally unique across candidate numbers/owners. Different campaigns may use the same authorised group.
- Current posting permission and verified unexpired group consent are separate requirements. No automatic joining/leaving or anti-ban evasion.
- `cash = available + reserved + payable + bonus_backing`, with nonnegative integer buckets. Campaign rewards, conditional bonuses and referrals cannot borrow existing earned obligations.
- Full conditional welcome-bonus backing is required before the first funded delivery reservation; separately held backing is disclosed and not silently forfeited/released on a failed job.
- Receipts/events are append-only. Funding references and ledger settlement keys are unique. Reconciliation checks wallets against earned ledger records, campaign allocations against jobs, and cash against funding receipts.
- Referral ₦5 is pending at registration, becomes earned once after the invited paired worker's first verified qualifying delivery, and is pre-backed before sending.
- First withdrawal needs 300 earned + one-time 200 locked bonus and at least 500 total; later minimum 500 earned. **No actual withdrawal or payout execution exists.** Future payout debits must extend reconciliation before activation. No P2P.

## Security, data and operations

Sessions use random 256-bit tokens with only hashes stored; passwords use salted scrypt (`N=32768,r=8,p=3`). Sessions expire after seven days; logout revokes them. Authenticated mutations require same-origin/custom JSON headers and session-specific CSRF. No public admin provisioning or seeded credentials. The production account is preserved rather than promoted or replaced.

The new schema keeps masked number labels and keyed provider-identifier hashes for future pairing; it does not persist member lists. A future provider must encrypt/isolate session credentials, retain the persistent HMAC key securely, authenticate delivery receipts and define retention/revocation. Shared/dynamic IPs do not prove one physical person; fingerprinting and VPN detection are not implemented.

The active database remains SQLite. `prisma/schema.prisma` is an explicitly historical reference, not a deployed PostgreSQL schema/migration. PostgreSQL migration and capacity review remain before scaled/distributed financial operation. Auth limits are currently per-process; financial correctness tests with separate processes do not certify scale or abuse resistance.

This is a tested **pre-launch funding/earning foundation**, not an operational paid broadcast marketplace, supported WhatsApp integration, bank-connected ledger, complete payout service, legal review or security certification. See `docs/FUNDING-STAGE.md` for exact boundaries, operator procedures, verification and rollback.
