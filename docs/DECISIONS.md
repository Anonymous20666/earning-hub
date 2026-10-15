# Decision and risk register

Date: 15 October 2026. Scope: Mission 01.

| Decision | Reason | Boundary / remaining work |
|---|---|---|
| Preserve Pappy brand, community marketplace and two account journeys | Existing product identity and purpose | Founder to confirm positioning after real customer research |
| Replace simulation-driven runtime, preserve original source in `legacy/` | Local passwords, editable roles, fake pairing and payout success cannot be safely polished into a production claim | Old demo interactions intentionally unavailable, not equivalent live integrations |
| React/Vite retained; Express retained | Avoid unnecessary framework migration | Hash-based navigation keeps direct workspace links and browser history simple |
| SQLite in single container with integer thousandths | No application database existed or was configured; simplest persistent foundation without touching existing MariaDB/Redis | No existing production database migrated; PostgreSQL/settlement design to review before real financial operations |
| Server session cookies rather than local-storage bearer identities | Central revocation and authorisation | Email verification, password-reset delivery, 2FA and session-management UI pending |
| Original reward rules preserved; withdrawal overdraw rejected | Correctness and stated minimum cashout must hold | Locked admin-group payout loophole closed to match original documented OPEN-only rule |
| Planning formulas preserved as estimates only | Do not silently change financial rules | Conversion rates, overhead, fees, country targeting in direct sessions, refund and bonus funding need approval |
| Messaging/payout endpoints fail closed | No provider credentials or verified implementation | Official supported integrations, consent and abuse safeguards required |
| No public demo/admin accounts | Protect administration and private data | Founder to register their own real account before explicitly authorised admin provisioning |
| Non-root Docker with persistent host data, read-only root filesystem and restart policy | Isolate from existing server services | No existing nginx host replaced; domain and permanent HTTPS still needed |
| Temporary Arena-access-gated review tunnel | Safe immediate review without opening a new public VPS port | Tunnel depends on the agent workspace; not a permanent hosting URL |
| Deny-all Firestore rules prepared, not deployed | Legacy rules permit client wallet edits and role changes | Owner must provide authorised Firebase access to review/revoke actual cloud rules |
| Public indexing disabled during pre-launch | Avoid marketing an unfinished financial/messaging product | Remove noindex only after launch gates and operator policies are approved |

## Priority risks

1. **Launch blocker:** real messaging dispatch/verification and payment/settlement are absent; never enable money based on UI counters.
2. **Financial:** 200 Coins per worker is a conditional obligation. 10,000 registrations imply up to 2,000,000 Coins / NGN 2,000,000 of bonus exposure before eligibility, abuse and funding conditions. This is a scenario, not a forecast or assertion of accounting treatment.
3. **Financial:** original seeded campaigns allow worker budgets above campaign revenue (400 NGN vs 420 Coins; 650 NGN vs 680 Coins; 280 NGN vs 300 Coins), implying potential losses before fees if fully spent. Those are prototype records, not customer transactions; none were migrated.
4. **Commercial:** Smart Verified conversion rates (0.9%, 1.2%, 1.8%) were hardcoded assumptions, not measured performance. Reach and campaign prices must not be guaranteed from them.
5. **Abuse:** registration is real but email verification and identity/one-person eligibility are not implemented; payout remains blocked. Do not scale acquisition around bonuses before funding and anti-abuse decisions.
6. **Operations:** backups are local and manually invoked, not scheduled/offsite. A host failure can still lose both database and local backups.
7. **Privacy/legal:** operator identity, contact, retention, jurisdiction-specific obligations, commercial terms and complaint procedures require confirmation and professional review.
8. **Infrastructure:** temporary preview rate limits share the tunnel source; production trusted-proxy and broader observability configuration remain pending.
9. **Runtime:** Node 22 marks built-in SQLite experimental. Current tests pass; evaluate a supported LTS/runtime upgrade and load testing before launch.

## Research used

Design principle, not copied branding: visual hierarchy, quieter navigation and reducing unnecessary separators in Linear's 2026 refresh [1](https://linear.app/now/behind-the-latest-design-refresh). Dashboard context and audience-specific density informed the overview structure [3](https://linear.app/now/dashboards-best-practices).

Node's official cryptography documentation describes scrypt as a memory/computation-expensive password derivation function [1](https://nodejs.org/api/crypto.html). Actual chosen parameters are visible in the implementation and tests, not a certification claim.

## Follow-up: founder-authorised HTTPS review domain

On 15 October 2026 the founder supplied `pappy-earnig-hub.duckdns.org` and requested a certificate. DNS resolves to the authorised VPS. A dedicated nginx vhost, Let's Encrypt certificate, HTTPS redirect, certificate reload hook and canonical application origin are now configured. The renewal dry-run and real public HTTPS browser sign-in/workflow checks passed. This supersedes the temporary-preview and missing-domain decisions above. It does not change the pre-launch business scope or approve messaging/payment implementation; those designs are still to be agreed.
