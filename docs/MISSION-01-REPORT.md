# Mission 01 — Implementation and verification report

**Date:** 15 October 2026  
**Product:** Pappy Earning Hub  
**Release status:** Implemented and deployed as an isolated **pre-launch foundation**. **Not approved for live earning, campaign delivery or payments.**

## 1. Original state

The repository was a React/Vite + Express prototype with approximately 9,900 lines of frontend/service code. Its documentation claimed production-like capabilities that the implementation did not support.

Major findings:

- Email passwords were stored as plaintext values under a misleading `passwordHash` name in localStorage; public worker, advertiser and admin demo credentials were seeded.
- Session identity and roles could be edited in the browser. “Role switching” was not server authorisation.
- Pairing codes, group metadata, broadcasts, verification events, joins, earnings history, bots and support alerts were simulated or seeded.
- Payout UI mutated browser state and displayed a dispatched-payment message without a payment provider.
- Withdrawal calculations did not bound the requested amount by the available balance. The first-withdrawal check also mishandled loss of the welcome bonus.
- Firestore rules allowed owners to change their own wallet balances and profile roles; campaign visibility was overbroad. Actual cloud deployment of those rules could not be verified.
- The Prisma schema was not connected to a database or installed Prisma client. There was no financial transaction ledger or real settlement process.
- The chat endpoint lacked authentication and useful request constraints; AI initialisation depended on a missing key and referenced an unverified model name.
- No committed tests or deployable production configuration were present. Package installation initially failed on a Vite/esbuild peer-version conflict.
- UI complexity, tiny text, artificial telemetry, role-switch controls and repeated “state-plane” terminology obscured the actual user value.

**Preserved:** the Pappy identity, worker/advertiser marketplace purpose, React/Vite and Express architecture, documented reward thresholds, original planning formulas, historical source, original lockfile and schema reference. No existing production app database was found or migrated.

## 2. Design improvements

- New forest-green / warm-neutral / soft-lime identity across public pages and workspaces.
- Clear public navigation, two audience journeys, platform rules, FAQ, privacy notice and factual service availability.
- Purpose-built account forms without demo credentials or pretend social-auth controls.
- Consistent role-specific sidebar, balance cards, next-step guidance, tables, empty states, error messages, notifications and native modal dialogs.
- Separate wallet earned balance and locked bonus; clear withdrawal conditions and integration status.
- Actual campaign planning form with saved drafts, estimate breakdown, edit/delete and deletion confirmation.
- Mobile navigation and layouts; horizontally scrollable keyboard-accessible data tables; visible focus states; reduced-motion support.
- Non-functional 3D effects, generated earnings charts, pretend live logs and fake AI availability are not in the runtime bundle.

The new hero diagram is explicitly a **platform concept**, not performance data. Screenshots are authentic captures of an isolated QA database, not testimonials or live customer results.

## 3. Technical improvements

### Implemented

- Persistent SQLite database with WAL, foreign keys, constraints and a schema-version record.
- Server-side registration/login, unique salted scrypt password hashes, random session tokens stored only as hashes on the server, HttpOnly/Secure cookies, expiry and server-side logout revocation.
- Role and record-ownership checks; session-specific CSRF tokens; JSON custom-header and origin validation; request-size limits; auth/API rate limiting; security headers.
- Worker registration, wallet and one-time conditional bonus ledger entry in a single transaction.
- Integer thousandths of Coins for stored balances; no browser-accessible wallet write endpoint.
- Persistent advertiser draft create/read/update/delete, validated platform URLs, server-side quote calculation and role boundaries.
- Persistent profile updates, support tickets, staff replies, restricted admin account view, conditional-bonus liability view and audit trail.
- Explicit unavailable responses for pairing, live launch, payments, withdrawals and AI; no fabricated success or debit.
- Lazy-loaded auth/workspace code, no remote fonts or tracking scripts, actual error boundary and expired-session handling.
- npm lockfile and reproducible Docker build; unused Firebase, Three.js, charting, motion, AI and Tailwind runtime dependencies removed from the active implementation.
- Backup utility with consistent SQLite export and integrity validation.

**Architecture choice:** SQLite supports this limited single-instance pre-launch stage without introducing a second database service or touching existing MariaDB/Redis. This is not a claim that it completes the intended PostgreSQL/worker/settlement architecture. Re-evaluate against actual concurrency before adding real financial execution.

## 4. Business and user experience

- Visitors can distinguish workers from advertisers and understand the marketplace purpose.
- Account creation is separated from unsupported earning/launch promises.
- No invented users, delivery numbers, reviews, conversion claims or “guaranteed margin” marketing.
- Conditional bonus language appears before registration and inside the wallet; estimates are not purchases.
- Advertisers can save genuine work even before integrations are ready.
- Support has an actual stored outcome and staff replies rather than pretend Telegram notifications.
- Public indexing is disabled while the platform is pre-launch.

Customer acquisition performance, retention, willingness to pay and campaign conversion remain unmeasured. No growth forecasts are claimed.

## 5. Financial and security findings

### Addressed or contained

- Browser-controlled balances, roles, plaintext passwords and public admin accounts removed from the runtime.
- Overdraw, NaN/Infinity and invalid-wallet cases rejected in financial calculations.
- The documented OPEN-only group rule is enforced, including when a worker is an admin of a locked group.
- Minimum 500 Coin cashout is preserved if a worker loses the 200 Coin bonus; 300 earned alone does not permit a sub-minimum withdrawal.
- Registration bonus cannot be duplicated by re-registering the same account; its ledger idempotency key is unique.
- No live debit, payout, dispatch or fabricated provider confirmation is possible through the implemented APIs.
- Prepared deny-all Firestore rules replace the vulnerable local rules file. **They have not been deployed to Firebase.**

### Important unresolved findings

1. The seeded prototype campaigns permitted worker budgets above revenue: **₦400 vs 420 Coins**, **₦650 vs 680 Coins**, and **₦280 vs 300 Coins**. At 1 Coin = ₦1, full spend would lose ₦20, ₦30 and ₦20 respectively before other costs. These were sample records, not proven real losses; none were migrated.
2. Smart Verified conversion rates of 0.9%, 1.2% and 1.8% were hardcoded assumptions. The inherited price calculator is now explicitly a planning estimate; no profitability guarantee is made.
3. A 200 Coin conditional bonus across 10,000 eligible workers could create **₦2,000,000** in bonus exposure. This is a scenario, not a forecast or accounting classification. Funding, eligibility and anti-abuse policy need approval before acquisition or payouts.
4. Gateway fees, refunds, bonus funding, taxes, operating cost, delivery attrition and reconciliation are not a completed financial model.
5. The old direct-session formula does not price country filtering. The form warns about that omission; no silent premium was introduced.
6. Email verification, password-reset delivery, MFA, one-person eligibility and sophisticated fraud controls are not implemented. Money remains disabled.
7. Final operator details, retention, privacy contacts, jurisdiction-specific legal/tax requirements and commercial terms need founder decisions and appropriate professional review.

This release is not a penetration-test result or a security certification.

## 6. Testing actually performed

### Passed

- **50 Node unit/API/persistence tests** covering authentication, role escalation, anonymous admin access, cross-account isolation, CSRF/origin guards, request constraints, wallet immutability, bonus uniqueness, withdrawal boundaries/overdraw/non-finite values, group qualification, quote preservation, input validation, draft CRUD, ticket persistence/replies, logout, unavailable-provider responses, rate limits, transaction rollback, restart persistence and backup restore integrity.
- **14 Playwright browser tests:** seven desktop and seven emulated mobile tests, run against the final production build in an isolated loopback-only QA environment. Includes navigation/FAQ, both account journeys, persisted balances, export, support, profile changes, sign-out/sign-in, session loss, campaign estimate/save/edit/delete, admin read/reply UI, modal Escape/focus restoration and route overflow checks.
- **Axe WCAG 2 A/AA and 2.1 AA automated scans:** zero violations in tested landing, registration, overview, campaign-dialog, worker wallet, connections, support, settings, status and admin states at desktop/mobile viewports. This is not proof of complete accessibility compliance or a full screen-reader audit.
- TypeScript strict checks and production Vite build.
- Production dependency advisory audit: zero known advisories reported at test time. Not an OS/container image vulnerability certification.
- VPS image build, non-root/read-only runtime inspection, container health check and real database backup integrity check.
- **20 actual-VPS public-page/viewport checks** across landing, login, rules, privacy and status at 360, 390, 768 and 1440 pixels; no horizontal page overflow or uncaught browser errors in those checks.
- Deployed-instance smoke checks through the SSH tunnel: real worker/advertiser registration, bonus/zero earned balance, support save, persisted draft creation/read/deletion, unavailable payout response, Secure cookie flags, logout revocation, anonymous admin denial, HTML and favicon loading. Temporary smoke-test accounts were removed by exact IDs; no test accounts were left on the VPS.

### Failures found and fixed during QA

- Initial browser startup lacked required OS libraries; installed only the Chromium test prerequisites in the sandbox.
- Corrected login password labelling, low-contrast utility text, modal focus restoration and keyboard access to horizontally scrolling tables.
- Auth rate limits correctly blocked repeated QA registrations; final desktop/mobile runs used fresh isolated QA server processes rather than weakening production limits.

### Unverified / unavailable

- Real WhatsApp/Telegram pairing, consent processing, webhook signatures, delivery, deduplication, refunds, settlement, FX, payments and payouts: providers not configured and production implementations absent.
- Email/Google OAuth and AI: not configured.
- Sustained load, distributed concurrency, external penetration testing, real-device Safari/Firefox behaviour, full manual assistive-technology testing and disaster recovery after host loss.
- Permanent-domain DNS/certificate path and public HTTPS browser workflows. Arena's unauthenticated preview URL returns an access-gate 403; this is distinct from the application's successful tunnel health checks.

Evidence: `docs/testing/` and `docs/screenshots/`.

## 7. Deployment

- **VPS:** 188.93.146.195; source `/root/earning-hub`; branch `mission-01-20261015`.
- **Runtime:** `pappy-earning-hub` Docker container; unprivileged `node` user; read-only root filesystem; persistent database volume; 512 MB / 1 CPU / PID limits; rotated logs; `unless-stopped` restart policy.
- **VPS listener:** loopback `127.0.0.1:3107` only. No new public VPS port or existing nginx hostname was repurposed.
- **Review:** Arena live preview via a temporary SSH tunnel. Hostname: `https://3107-i939v66u4n74fnf36opc1.e2b.app`. Open the live-preview panel in this conversation; the gateway requires Arena access and is not an unrestricted public URL.
- **Backups:** original source tarball `/root/earning-hub-backups/original-20261015.tar.gz`; consistent local database backups `/var/lib/pappy-earning-hub/backups/`.
- **Rollback:** previous container retained by the release script; source retained in Git and the original archive. No destructive database migration performed.

**Deployment is a pre-launch review deployment, not a completed public commercial launch.** The preview depends on the temporary agent tunnel. A permanent domain and HTTPS reverse-proxy configuration remain required.

## 8. Remaining requirements

From the founder / authorised owners:

- Choose the intended permanent domain and provide DNS control; approve its HTTPS hosting configuration.
- Register the real owner account and explicitly approve admin provisioning; no default admin credentials exist.
- Confirm intended supported, policy-compliant messaging providers and provide authorised credentials/access.
- Select payment/payout providers, currencies, operating jurisdictions and business-account credentials through a safe secret-delivery method.
- Approve the unit-economics model, bonus funding, eligibility, refund/payout terms and abuse controls before enabling money.
- Provide an email-delivery configuration for verification and real password-reset flow.
- Finalise operator identity, privacy contact, retention, commercial terms and appropriate legal/accounting review.
- If the legacy Firebase project is owned and used, provide authorised access to inspect actual deployed rules; the local fix alone does not change the cloud.

## 9. Next priorities, ranked

1. **Before any paid campaign or payout:** validate provider feasibility, consent/platform-policy requirements, bonus funding and the complete unit-economics model.
2. Implement genuine provider integrations with signed events, server-side idempotency, authoritative delivery records, settlement transactions and reconciliation; test failure/retry/race cases before enabling money.
3. Configure a permanent HTTPS domain, email verification/reset, owner administration, monitored backups and offsite recovery.
4. Complete legal/privacy/eligibility terms and account deletion/retention workflows.
5. Run a small consent-based pilot; measure activation and real delivery economics before growth spend.

**Bottom line:** this mission replaced a misleading simulation with a coherent, tested and deployed pre-launch product foundation. It does not yet deliver the original platform's real earning, messaging or payment capability, and those blockers are explicit rather than disguised by the redesign.
