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

## Requirements and package manager

Node **22.13+**; npm; the committed `package-lock.json`. Use `npm ci`, not an unpinned install. SQLite uses Node's built-in `node:sqlite`, which emits an experimental warning on Node 22. No PostgreSQL or Redis is required for this pre-launch, single-instance version. The old Bun lock and prototype code are retained in `legacy/` and are not runtime inputs.

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

**Rollback:** stop and remove only the new `pappy-earning-hub` container; rename the preserved `pappy-earning-hub-rollback-<timestamp>` container back to `pappy-earning-hub`, and start it. No schema-breaking migration is introduced by this release. If a future release changes the schema, use a separately reviewed database rollback plan; do not restore over live writes blindly.

The original repository snapshot is also preserved at `/root/earning-hub-backups/original-20261015.tar.gz`. It is an unsafe prototype, not a production fallback for public exposure.

## Temporary review access

Arena's live preview uses a temporary SSH tunnel to the VPS application. The preview hostname is access-gated by Arena; a direct unauthenticated request returns 403 at that gate. Application checks were performed through the SSH tunnel. A permanent public domain / certificate / nginx vhost has not been provisioned. The existing hostnames serve unrelated applications and were not repurposed.

## Administration

There are **no seeded accounts, default passwords or public admin-registration routes**. Register the founder's real account first; then a server operator can explicitly promote that exact account after founder approval. The browser cannot self-promote. Staff can read recent accounts, view conditional bonus liability, reply to support tickets and inspect audit records. Financial override buttons from the prototype are not deployed.

## Important limitations

- No SMTP/email verification/password reset delivery, Google OAuth, messaging sockets, Telegram webhook, payment provider, payout service or AI key is configured.
- No real campaign dispatch, group validation, pairing, earning, deposits or withdrawals occur. These APIs fail closed.
- Planning estimates preserve the inherited formulas; conversion and profitability assumptions are unverified.
- Financial settlement, provider reconciliation, webhook idempotency and fraud controls must be built and tested before live money is enabled.
- SQLite is appropriate for this limited single-instance foundation, not a claim of distributed scale. Review migration to PostgreSQL and queue architecture against measured workload before adding workers or concurrent settlement.
- Rate limiting is in process memory. In this SSH-tunnel review topology, requests share the tunnel source IP. A production reverse proxy requires explicitly reviewed trusted-proxy configuration and abuse controls; do not blindly trust arbitrary forwarded headers.
- Final operator details, retention policy, privacy/legal review and commercial terms remain open. No certification or legal compliance claim is made.
- The new app does not use Firebase. `firestore.rules` contains a prepared deny-all replacement, **not deployed** to the legacy Firebase project. Cloud rules cannot be confirmed without owner access.

See `docs/MISSION-01-REPORT.md`, `docs/DECISIONS.md`, and `docs/Product-review.html` for findings, decisions and visual review.
