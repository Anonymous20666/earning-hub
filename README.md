# Pappy Earning Hub

A **pre-launch** worker / advertiser marketplace with a real, server-backed account and planning foundation. Messaging, earning and payments are deliberately **not enabled**.

## What works

- Server-side email/password registration and login; salted scrypt password derivation.
- HttpOnly, Secure cookies; hashed revocable sessions; role checks and CSRF protection.
- Persisted worker wallet and one-time locked bonus ledger entry (not earned cash).
- Advertiser campaign draft creation, editing, estimation and deletion.
- Profile updates, support tickets, staff replies and a restricted admin view.
- Responsive public website, registration, login and role-specific workspaces.
- Database backup command and integrity checking.

## Funding-first earning update (v0.2.0)

- Exact member-based earning calculator; one group suffices; no 100-group earning cap.
- Two-number inventory model, unique/duplicate/permission counts and ownership-checked exclusion. **Pairing itself is not configured.**
- Real referral links and ₦5 pending attribution at signup; no credit before a funded verified qualifying delivery.
- Restricted treasury and house-campaign budgets; verified-cash bookkeeping, separate bonus/referral backing, strict reservations, idempotent internal settlement and reconciliation.
- Real BullMQ/Redis dispatch framework tested with an isolated Redis and synthetic provider. **No production provider adapter, Redis worker service or real dispatch is enabled.**
- Additive schema version 2; existing accounts/data preserved. No real cash, paid earnings or public admin is seeded.

Read [the funding-stage implementation and operator guide](docs/FUNDING-STAGE.md) before recording funds or attempting any messaging. The complete paid marketplace is not finished: provider/consent integration, PostgreSQL migration, commercial checkout decisions and actual payments/payouts remain gated.

## Requirements and package manager

Node **22.16+**; npm; the committed `package-lock.json`. Use `npm ci`, not an unpinned install. SQLite uses Node's built-in `node:sqlite`, which emits an experimental warning on Node 22. No PostgreSQL or Redis is required for the deployed pre-launch web app. The inactive BullMQ worker requires a separate private Redis and an approved provider adapter; the release does not start either. The old Bun lock and prototype code are retained in `legacy/` and are not runtime inputs.

```bash
npm ci
# For local HTTP development only:
COOKIE_SECURE=false npm run dev
# Browse http://127.0.0.1:3107
npm run lint
npm test
npm run build
NODE_ENV=production COOKIE_SECURE=false npm start
```

Never set `COOKIE_SECURE=false` on a public deployment. The development server includes Vite and requires development dependencies; production serves the built assets.

## Tests

```bash
npm run lint
npm test
npx playwright install --with-deps chromium
# Start the QA server in a separate terminal, bound to loopback only:
NODE_ENV=production HOST=127.0.0.1 PORT=3108 COOKIE_SECURE=false DATABASE_PATH=./data/qa.sqlite npm start
# Run one project per fresh QA-server process, so real auth rate limits do not interfere:
npx playwright test --project=desktop
# Restart only the QA server before the next command:
npx playwright test --project=mobile
```

The extended admin browser test explicitly refuses remote targets; it provisions a role only in the isolated `data/qa.sqlite` test database. Never copy that database into the VPS deployment. Unit/API tests use isolated in-memory or temporary databases. Browser screenshots are genuine test captures, not production activity or customer proof.

## VPS deployment

The repository is `/root/earning-hub`. The application runs as the unprivileged `node` user in the `pappy-earning-hub` Docker container. Only `127.0.0.1:3107` is published on the VPS. Existing nginx sites and other services are not changed.

```bash
APP_ORIGIN=https://your-approved-host.example bash deploy/release.sh
docker inspect pappy-earning-hub --format '{{.State.Health.Status}}'
docker logs --tail 50 pappy-earning-hub
docker exec pappy-earning-hub npm run backup
```

The release script builds first, verifies a backup of any existing app database, and retains the previous container under a rollback name before replacing it. Verify health after each deployment. It does not automatically accept a release or automatically revert a failed health check.

Data: `/var/lib/pappy-earning-hub/pappy.sqlite` on the VPS; directory `0700`, database `0600`. Local backups are in `/var/lib/pappy-earning-hub/backups`. Automated scheduling and offsite storage are still outstanding.

**Rollback:** stop and remove only the new `pappy-earning-hub` container; rename the preserved `pappy-earning-hub-rollback-<timestamp>` container back to `pappy-earning-hub`, and start it. Schema version 2 is additive and compatible with the saved earlier web container; retain all new tables and data on container-only rollback. If a future release changes the schema, use a separately reviewed database rollback plan; do not restore over live writes blindly.

The original repository snapshot is also preserved at `/root/earning-hub-backups/original-20261015.tar.gz`. It is an unsafe prototype, not a production fallback for public exposure.

## Permanent HTTPS design review

Canonical URL: **https://pappy-earnig-hub.duckdns.org** (the founder's exact spelling).

A dedicated nginx virtual host redirects HTTP to HTTPS and proxies to the loopback-only container. The Let's Encrypt certificate expires on 13 January 2027. Existing certbot cron renewal and a domain-specific nginx reload hook are configured; renewal dry-run including the hook passed on 15 October 2026.

The canonical origin is enforced for authenticated state changes. `TRUST_PROXY_HOPS=1` is enabled only because this dedicated nginx proxy overwrites `X-Forwarded-For` with the actual client address and the container is not publicly reachable. Do not enable that trust setting behind an unknown proxy or a publicly exposed container.

```bash
APP_ORIGIN=https://pappy-earnig-hub.duckdns.org TRUST_PROXY_HOPS=1 bash deploy/release.sh
```

Actual public HTTPS browser checks passed for registration, sessions, wallet display, saved advertiser drafts, logout/login and desktop/mobile home rendering. Temporary test accounts were removed. No certificate verification bypass was used. The old temporary Arena tunnel is no longer required.

This is a public **design-review/pre-launch** deployment, not permission to enable live messaging or money movement. The founder has authorised the funding-first build, not unfunded paid broadcasting. Live providers and money movement remain disabled.

## Administration

There are **no seeded accounts, default passwords or public admin-registration routes**. Register the founder's real account first; then a server operator can explicitly promote that exact account after founder approval. The browser cannot self-promote. Staff can read recent accounts, view conditional bonus records, reply to support tickets, inspect audit records and use the implemented treasury/house-campaign controls. Financial override buttons from the prototype are not deployed.

## Important limitations

- No SMTP/email verification/password reset delivery, Google OAuth, messaging sockets, Telegram webhook, payment provider, payout service or AI key is configured.
- No real pairing, group scan, campaign dispatch, paid earning, deposit collection or withdrawal occurs. Provider-backed operations fail closed. Internal inventory, budgeting, outbox and verified-receipt settlement logic exist and are tested, but are not a production provider connection.
- Planning estimates preserve the inherited formulas; conversion and profitability assumptions are unverified.
- The internal earning ledger, delivery idempotency and treasury reconciliation are implemented and tested. Real provider evidence ingestion/reconciliation, payout settlement/debits, fraud/KYC controls and operational bank verification remain launch gates.
- SQLite is appropriate for this limited single-instance foundation, not a claim of distributed scale. Review migration to PostgreSQL and queue architecture against measured workload before scaled/distributed financial operations.
- Rate limiting is in process memory. The dedicated nginx proxy overwrites forwarding headers and exactly one trusted proxy hop is enabled. Shared/dynamic client IPs still do not establish physical identity; multi-instance rate limiting requires separate review.
- Final operator details, retention policy, privacy/legal review and commercial terms remain open. No certification or legal compliance claim is made.
- The new app does not use Firebase. `firestore.rules` contains a prepared deny-all replacement, **not deployed** to the legacy Firebase project. Cloud rules cannot be confirmed without owner access.

See `docs/MISSION-01-REPORT.md`, `docs/DECISIONS.md`, and `docs/Product-review.html` for findings, decisions and visual review.
