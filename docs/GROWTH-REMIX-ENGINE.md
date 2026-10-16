# Destination URL remix engine — local implementation and evidence

**15 October 2026 · unreleased · production unchanged at v0.11.0**

## Contract and actual reference

The founder supplied `Screenshot_20261015-164155.jpg`: a native status background, real channel preview, decorated/spaced destination name, clickable URL and divider. Only that screenshot was inspected—not an actual SaaS implementation. Its follower count is not a current measurement and is not used in the engine, tests or benchmark.

Promotion remains the **destination URL**, not an advertiser-written caption. The engine decorates the actual public destination name around the validated stored URL. Private campaign titles and legacy advertiser messages are never inputs to promotional text. Existing personal posting, paid accounting, rates, worker rewards and payment rules are unchanged.

## Implemented

- `shared/growthRemix.ts`: 24 layouts × 12 Unicode text styles × 24 ornament pairs × 24 dividers × 12 backgrounds × 7 native fonts = **13,934,592 finite parameter combinations**. This is not the number of distinct text bodies, fonts, or universally different visual appearances. The URL remains a separate, unchanged line; Unicode typography applies only to the bounded destination name.
- Text styles: plain, spaced, mathematical bold, sans bold, sans italic, sans bold italic, monospace, double-struck, script, bold script, fullwidth and circled. Assigned Unicode characters, including letterlike-symbol exceptions, are checked by normalization tests. Non-Latin names are preserved rather than transliterated; their typography choices may look identical.
- Installed Plogme/protocol font intersection: **0 System, 1 System text, 2 Script, 6 System bold, 7 Morning Breeze, 8 Calistoga, 9 Exo 2**. The protocol also names 10, but the installed encoder rejects values above 9; therefore 10 is excluded. Unrelated consumer-status enum values 3–5 are not substituted. Encoding acceptance is **not physical-device certification**.
- Native font/background settings are emitted only for native status content. Ordinary group chat receives the decorated Unicode text and original link preview; WhatsApp does not accept arbitrary message-bubble font/background settings through this path. Telegram receives ordinary text/preview, not WhatsApp-native styling.
- `GrowthCreativeEngine.gallery`: owner/admin-authorized examples from the existing safe preview pipeline. It returns explicit COMPLETE/PARTIAL/UNAVAILABLE quality, metadata snapshot time, readable fallback, four examples by default, and a maximum of six. Example sets deliberately vary native font, colour and typography. Regenerate changes examples; it does not send or allocate work.
- `POST /api/growth/:id/creative-preview`: existing authentication, advertiser/admin role, CSRF, owner checks and compose limiter. There is no HTTP group-allocation or send endpoint.
- `GrowthCreativeGallery.tsx`: saved-order detail gallery, regenerate, copy-text controls, readable fallback, full-image or honest missing-image state, timestamp and browser/device approximation warning. Copy does not pretend to include a native preview or native settings.
- Additive local migration **10**: immutable order/revision metadata assets, durable order seeds/ordinals, immutable group placements, unique style indexes and unique text hashes within each order. Production remains on migration 8.

## Scale, persistence and storage boundaries

1. Public metadata and images use the same SSRF-protected `PreviewEngine` as personal previews, including its existing coalescing, concurrency and bounded caches. A COMPLETE asset is frozen and reused for all subsequent remixes of that order revision. A campaign edit requires a new revision. Thus regenerate is not a claim to fetch the latest follower count or image.
2. Snapshot revision recheck and insertion are inside one SQLite transaction. One COMPLETE asset per order/revision is enforced in the schema. There is a hard **eight-snapshot lifetime storage bound per order**, including partial/unavailable snapshots; hitting it fails explicitly and requires staff review. It does not change a price, reward or purchase range. There is no deletion/retention policy implied by this technical bound; launch still needs a documented policy and operational monitoring.
3. Metadata thumbnails are stored in shared **asset rows**, never copied into each group's placement JSON. The source may contain both full and smaller inline thumbnails; these are not newly rendered/generated per group. Cross-owner requests can share the safe preview cache without sharing private order identifiers or ownership rights.
4. Internal `allocate(orderId, groupJid, assetId)` requires ACCEPTED/RUNNING state and a current owned asset. It is **creative preparation, not funding, group permission, delivery or dispatch authorization**. First allocation saves the full render; retries, account changes and both legs reuse it. No seed is returned by the public gallery endpoint.
5. A cryptographically seeded affine permutation traverses the finite catalogue without repeating style indexes. Native font/background differences do not necessarily change text, so the allocator also enforces per-order body-hash uniqueness. It consumes conflicting slots and searches at most **512 candidates per allocation**. If no fresh body is found—or the catalogue is exhausted—it fails closed rather than silently reusing another group's body. This can pause earlier than the theoretical parameter capacity, especially for non-Latin names.
6. Plain readable fallback intentionally can repeat the same simple name/URL across groups. It is not advertised as an infinitely unique body, anti-ban method, or device/font compatibility guarantee.
7. Future wave scheduling must prepare bounded chunks and yield to the event loop rather than synchronously allocate an entire large order in one HTTP request. There is no 10,000-allocation HTTP endpoint here.

## Executed evidence

- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npm test`: **266 tests, 265 PASS, 1 optional Redis/BullMQ integration SKIP, 0 FAIL**. The optional integration was not run; this is not a Redis certification claim.
- New remix tests: **13 PASS**. Cover catalogue/permutation, Unicode assignments/normalization, name sanitization/bounds, exact URL integrity, ownership and sample limits, metadata failure, edit/fetch race, immutable retry/two-surface content, SQLite restart, shared preview cache, storage bounds, finite exhaustion and independent-process allocation races. An additional API security test covers roles, CSRF, ownership, count limits, ignored forged destination/title/group/funding fields, and absence of allocations/funding/sends.
- Real installed SDK, offline: all seven selected font/background combinations encode and survive protobuf roundtrip under `groupStatusMessageV2.message.extendedTextMessage`, including `contextInfo.isGroupStatus`; no socket/network send occurs. Font 10 rejection is asserted.
- Full isolated, access-gated browser regression: **72 PASS**, desktop/mobile plus four Android-motion cases. Final focused gallery check: **2 PASS**, with zero automated WCAG A/AA violations in the tested states, no horizontal overflow at the tested sizes, correct copying/readable toggle/missing-image warnings and no send request. Gallery browser image/data is explicitly labelled **SYNTHETIC**; API tests independently exercise the actual backend with an injected synthetic metadata provider. Browser tests are not screenshots of WhatsApp.
- Logs: `docs/testing/growth-remix-{lint,build,tests,full-browser,browser}.txt`; axe results and desktop/mobile application screenshots are adjacent.

### Synthetic allocation benchmark

Latest reproducible run: Node 22.23.3, `--max-old-space-size=128`, one local process, in-memory SQLite fixture; yields every 25 allocations. Measured values, not production capacity commitments:

| Measurement | Result |
|---|---:|
| Latin allocations / distinct bodies | 10,000 / 10,000 |
| Non-Latin allocations / distinct bodies | 1,000 / 1,000 |
| Metadata/image provider calls for Latin order | 1 |
| Latin allocation elapsed time | 2,774 ms |
| Maximum sampled event-loop delay | 20 ms |
| Process peak RSS, including native/SQLite/test runtime | 164.6 MiB |
| Synthetic full JPEG bytes | 40,141 |
| Asset rows / placement rows, both orders | 2 / 11,000 |
| Foreign-key errors | 0 |
| Live sends / payments | 0 / 0 |

Full data: `docs/testing/growth-remix-scale.json` and `growth-remix-scale-log.txt`. This does not model 1,000 physical users, network uploads, provider throttles, live delivery, disk growth over months, the whole application's memory, or the production VPS's single CPU / 512 MiB limit. The allocator is not advertised as a provider throughput/SLA guarantee.

## Fonts and offline reference studio

A **118,852-byte** browser-only Unicode math glyph subset avoids common missing mathematical-letter glyphs in the gallery. It is not embedded in WhatsApp messages and cannot force remote-device rendering. Its modified family is `Pappy Math Symbols`; original Google copyright/OFL is preserved in `docs/licenses/noto-fonts-OFL.txt` and `public/fonts/LICENSE-noto.txt`. No npm dependency or lockfile changed.

Source Noto Sans Math SHA-256: `8242bd1e55368b27e32455260754cf9aa58f3ad7ea80664b66c21f1b09910d6c`.
Bundled WOFF2 SHA-256: `37ff216b27bc3056860ce88506da031a654bf786b5969346ef1076dc51eed134`.
Optional rebuild uses `scripts/build-remix-font.py`, fonttools 4.66.1 and brotli 1.2.0; normal app build/runtime just uses the checked-in WOFF2.

The separate self-contained `/home/user/remix-studio.html` is an **offline reference-only design review**, not the authenticated application or a sender. It embeds a crop of the supplied reference photo and explicitly labels it illustrative, asserts no follower count, and disables copying until a real URL is supplied. The production engine never uses that reference crop as fetched destination metadata. Its private reference screenshots are excluded from Git and from the source patch. To rebuild it with an authorized crop:

```sh
node scripts/build-remix-studio.mjs /path/to/private-reference-crop.jpg /path/to/remix-studio.html
```

## Reproduction

Use Node 22.16+ and existing package lock:

```sh
npm ci
npm run lint
npm test
npm run build
node --max-old-space-size=128 --import tsx scripts/growth-remix-scale.ts
```

Browser QA uses the existing `scripts/growth-qa-server.ts` and `playwright.growth.config.ts`; create a fresh private QA folder with a random mode-0600 `access-token`, a separate database, and `WHATSAPP_ENABLED=false`. The gate is required; do not expose synthetic account credentials publicly. Required Playwright browser/OS/font packages are local QA tools only. Run the browser config against that isolated gate; stop it and delete token/database/traces after verification. Do not publish traces containing gate headers.

## Remaining integrations / not claimed

This engine is local, not deployed, not pushed to GitHub, and **not wired to a funded growth dispatcher**. The existing production website, accounts, credentials, sessions, ledger and pricing were untouched. No live paired-account/channel/group writes, follower reads, test broadcasts or physical-phone font tests were performed in this continuation. The earlier cached paired-account inventory is not current control or follower proof.

A future live sender must require verified funding/reserves, buyer-approved creative/source revision and fallback policy, real current group permission/membership/worker availability, dedupe/quota rules, bounded scheduling, safe media upload reuse, durable single-relay/no-replay proof and the existing two-leg settlement logic. It must not call this allocator as a substitute for those checks. Paid growth's access/counting/observation/removal/funding/payout launch blockers remain documented in `GROWTH-IMPLEMENTATION-STATUS.md`. Direct-session and free-personal posting remain unchanged. No anti-ban claim, invented refund rule, automatic spend or guaranteed growth was introduced.
