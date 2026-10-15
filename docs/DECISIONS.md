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


## Founder-authorised funding-first build — 15 October 2026, v0.2.0

The founder agreed to obtain funding before paid broadcasts and authorised implementation. No actual cleared amount or verified deposit was provided. This authorises building, not pretending investment has arrived.

| Decision | Implementation / consequence |
|---|---|
| Preserve the deployed app/account before migrating architecture | Additive SQLite schema v2; no destructive PostgreSQL migration, unrelated service changes or new production Redis service. PostgreSQL remains explicitly pending. |
| Exact worker reward is the current standard | `min(members,1000)` milliCoins for each unique successful qualifying group (100+ members, posting allowed, verified consent). No 100-group ceiling. Legacy VIP remains estimate-only. |
| Two numbers per owner | Slot 1/2 constraints, keyed provider-number ownership history; one campaign/group reservation across all numbers/owners. No fake pairing or device-uniqueness guarantee. |
| Referral is ₦5, not undefined points | 5,000 milliCoins pending at signup; backed and activated once by the invited paired worker's first verified qualifying delivery. |
| Cash first | Only independently checked cleared receipts can be booked by an approved operator. Expected CPA revenue, investments and unsold communities do not increase treasury. |
| Back obligations before new work | Separate reward reservations, earned payables, full conditional welcome-bonus backing and referral backing. Full bonus backing before first paid work is a conservative cash-reservation policy, not an earlier bonus unlock or changed withdrawal threshold. |
| Never infer delivery from HTTP 200 | Server acceptance creates no earnings; authenticated matched delivery receipts settle internally. Uncertain outcomes hold funds; no blind resend. |
| Build real queue machinery without inventing a provider | BullMQ + ioredis installed and real isolated Redis tests executed. Production release runs neither Redis nor the worker; no production messaging adapter is bundled. |
| Keep unresolved checkout off | Fixed ₦30/80/180 pricing versus exact payout conflict has not been approved; no checkout/charging enabled. |
| No unsolicited automation | Current verified group-admin consent is required independently of number pairing. No autojoin, anti-ban evasion, automatic group exit or supposed one-IP physical-identity enforcement. |
| Preserve money and audit under failures | Immediate transactions, unique campaign/group/funding/ledger keys, append-only monetary records, reconciliation, separate-process race tests. Actual payout execution/debits remain unimplemented. |

See `FUNDING-STAGE.md` for operational boundaries, cost backing, verification evidence and remaining launch gates. The earlier mission's no-workflow restriction was superseded by build authorisation; live messaging/payment credentials and unresolved pricing were not approved by that authorisation.

## Coins-first / closed-menu update — 15 October 2026, v0.6.0

The founder explicitly superseded the historic 5-Coin referral rate with **100 Coins**, retaining the same first qualifying positive confirmed funded-work trigger. No signup payment, retroactive earned/reserved rate increase or relaxed funding gate. Schema 5 preserves locked financial history and updates unreserved pending rates only. Public copy is now Coins-first without changing internal 1 Coin = NGN 1 backing or pretending international payouts are available.

A conditional 1,000-Coin daily illustration is derived from existing rules (50 eligible 1,000-member groups × 10 distinct funded campaigns × 2 confirmed post types), not a guarantee or new cap. Desktop and mobile navigation now start closed; design narration/playback controls are removed in favour of an automatic, bounded decorative entrance.

Existing GitHub origin was found at `Anonymous20666/earning-hub`; read access works but HTTPS write access is not configured. A repository-specific public deploy key was supplied for the founder to grant write access. Source-only backup uses a separate `backup/earning-hub` branch, with no force push/default-branch replacement. No database, WhatsApp sessions or secrets belong in GitHub. Off-server encrypted private-data recovery remains unresolved.

See `INTERNATIONAL-AND-MENU-0.6.0.md` for migration safeguards, verification and actual release/push outcome.

## Continuous scene correction — v0.6.1

The founder reported that the 3D scene stopped moving. The v0.6.0 4.5-second cutoff caused this, particularly before the scene entered a small mobile viewport. Removed that cutoff: animation continues while visible and resumes on re-entry, still respecting reduced-motion/data-saving preferences and hidden tabs. No playback buttons restored. See `MOTION-FIX-0.6.1.md`; manual motion-accessibility review remains a stated limitation, not a blanket WCAG claim.

## Chrome Android follow-up — v0.6.2

The founder still reported a static scene and identified Chrome on Android. Reproduced static cases in production Chrome Android emulation when the prior code received data-saving or reduced-motion flags; the founder's actual phone preferences remain unobserved. Removed the network-data-saving block, made movement more noticeable and switched animated individual transforms to combined transform keyframes. Explicit per-browser `/?motion=on` enables and remembers motion even when reduced motion is reported; `system` resets and `off` disables. Normal reduced-motion visitors are not globally overridden. The founder was supplied the opt-in link; physical-device confirmation is pending. See `CHROME-MOTION-0.6.2.md` for precise test outcomes, the bounded QA screenshot correction and unchanged financial/data safeguards.

## Earning-first positioning — v0.7.0

The founder confirmed the Chrome Android motion fix worked, then directed that earning—not free broadcasting—must explain why visitors are here. The homepage now leads with connecting WhatsApp/preparing to earn, exact shared-rule group rewards and the funded/confirmed-work journey, followed by potential, conditional referrals/bonus/cashout rules, then free personal broadcasting as an extra. Pairing alone creates no earnings; paid jobs and cashout remain closed. Worker signup/onboarding and role-aware destinations follow the same story. No economic or messaging rule changed. See `EARNING-FIRST-0.7.0.md` for final verification, the post-commit review-focus race correction and production preservation evidence.


## 15 October 2026 — founder worker revision, v0.8.0 deployed

- Founder explicitly confirmed **keep current rewards**, not a 10× change: 100 members=0.100 Coins per independently confirmed funded post type. Backing remains ₦1 per Coin. USD/other currency equivalents are dated illustrative display conversions, not new economics or a payout quote.
- Fresh composer reviews use native WhatsApp membership/posting rights. No mandatory separate admin command for normal personal status/chat. Locked chat in DOUBLE is explicitly skipped while status remains eligible for an attempt. Owner-level removal bans, selected-number ownership, exclusions, ignores, explicit review and UNKNOWN no-retry remain. Old queued runs retain their original contract via absence of the immutable version marker. New native paid reservations still require all funding, opt-in and receipt gates and allocate only sendable legs; paid execution stays OFF.
- Personal per-post number 1/2/both, shared-group dedupe, one owner wallet; searchable persistent owned-group ignore checklist plus the original invite inputs; no autojoin.
- SDK request uses actual **PAPPYPAY** custom code, not a display substitution; existing online account untouched.
- Simple earning-led home/dashboard; detailed rates/values/calculator moved to separate public pages. 1,000/day and 5,000/day are conditional workloads with clear requirements, not available jobs or guaranteed income. More visible action buttons and matching warm scene materials preserve the founder-confirmed automatic Android motion.
- Executed: lint/build PASS; unit/API 178 PASS + one optional Redis SKIP; browser 44 PASS; public read-only 39 PASS. Actual supplied invite metadata decoded correctly with a real thumbnail; no physical pairing/send claimed. Production preserved all 23 source-of-truth fingerprints, 903 auth entries, configuration, groups and online account; treasury reconciliation PASS; only additive migration 6. Backup/rollback and evidence recorded in WORKER-EXPERIENCE-0.8.0.md. GitHub write grant remains pending; verified source bundles used.


## 15 October 2026 — native wire-ID/late-error compatibility follow-up v0.8.1

Exact installed SDK audit found the normal send wrapper overwrites the caller's message ID. Use the SDK's own native encoder plus one relay with the durably claimed ID; validate target/from-me/current socket before publishing, no SDK patch, substitute ID or replay. Handle current owned socket's numeric messages.update errors for personal runs by account+group+wire ID, with idempotency, late-error/ACCEPTED-race handling and no fake receipt credit. All monetary gates remain OFF. Real installed native encoding/upload-boundary tests plus owned socket event routing now execute: final184 tests,183PASS/one optional RedisSKIP; unchanged UI44browserPASS; finalproduction39readonlyPASS. All23fingerprints/auth903/config/online session preserved again; rollback details and actual limitations in SDK-COMPATIBILITY-0.8.1.md.
