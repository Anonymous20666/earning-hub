# Actual implementation state — Mission 01

The original architecture document overstated live capabilities. It is preserved, unmodified, at `legacy/ARCHITECTURE-original.md` as historical context, not a description of production readiness.

## Runtime

```
Browser / HTTPS review gateway
        |
Temporary SSH tunnel (review only)
        |
VPS 127.0.0.1:3107 -> isolated non-root Docker container
        |
Express API + built React/Vite SPA
        |
Node built-in SQLite, WAL, foreign keys, integer thousandths of Coins
        |
Persistent host directory /var/lib/pappy-earning-hub
```

- `backend/app.ts`: authentication, authorisation, CSRF/origin validation, role-gated APIs, account/draft/support persistence, administrative read/reply endpoints.
- `backend/database.ts`: idempotent schema version 1, constraints, transaction helper.
- `backend/backup.ts`: SQLite-consistent backup via `VACUUM INTO`, followed by integrity validation.
- `shared/rules.ts`: documented monetary thresholds, group rewards, input validation and inherited planning-estimate formulas.
- `src/api.ts`: HTTP client; CSRF value held only in memory, no browser-stored passwords or bearer session tokens.
- `src/components/`: public site, authentication and role-specific workspaces.
- `src/services/walletLedger.ts`: corrected pure legacy-compatible calculations; not a settlement or payment service.
- `legacy/`: original prototype, excluded from compilation, bundles and container.
- `prisma/schema.prisma`: retained design reference, not wired to this runtime and not migrated.

## Data and authority

The server is authoritative for identity, role, account ownership, bonus creation and stored records. User-supplied campaign status, owner IDs and financial amounts are ignored. All SQL values are bound parameters. New worker creation and the locked-bonus ledger entry occur in one database transaction with an idempotency key. Balances are integer thousandths, not floating-point ledger entries. There is no wallet-edit API and no live settlement API.

Sessions use 256-bit random tokens; only token hashes are stored. Passwords use unique random salts and scrypt (`N=32768`, `r=8`, `p=3`). Authenticated mutations require a session-specific CSRF header. State changes require a JSON custom header and checked origin; CORS is not enabled. Tokens expire after seven days and are revoked on logout.

## Scope boundaries

Messaging and payment operations return an explicit unavailable response. No third-party account credentials are present and no simulated result is substituted. The dashboard reports actual server records, with zero deliveries and zero earned Coins until a real verified delivery pipeline exists. Administrator controls are limited to operations actually implemented; there is no money-moving or verification-override UI.

This is a functional **pre-launch foundation**, not an operational earning network, a complete financial ledger, a distributed deployment or a production-security certification. See the mission report for release gates.
