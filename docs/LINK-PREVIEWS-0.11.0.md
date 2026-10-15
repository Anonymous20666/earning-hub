# Validated link previews and website sharing — v0.11.0

## Request and demonstrated cause

The supplied public WhatsApp channel (`https://whatsapp.com/channel/0029VbDhb0RB4hdT1Dgr4n1Z`) advertised **Him**, **Channel • 2 followers**, and an actual thumbnail. Its image CDN returned HTTP 200 and 42,819 image bytes **without Content-Type**. The former fetcher rejected that response before image validation. This was reproduced without authentication, joining the channel, pairing, or sending messages. Raw page bodies and signed CDN image addresses are not committed.

The corrected public-page probe returned a validated 640 × 640 JPEG (52,346 bytes), a separate 14,750-byte inline JPEG, and native preview type 5. This proves extraction/normalization at the time of the probe, not physical WhatsApp rendering or perpetual provider availability.

## Security and extraction

- HTTPS on port 443 only; no credentials/cookies, browser execution, login, CAPTCHA bypass or private-resource fetching. Public-IP checks cover every DNS answer. Connections use a validated pinned answer; redirects are revalidated and limited to three. Private/reserved destinations, SVG, HTML disguised as an image, tracking pixels and unsupported bytes remain rejected.
- A missing/generic image Content-Type is no longer an automatic rejection. JPEG/PNG/WebP/GIF signatures **and** successful Sharp decoding are mandatory. Existing 2 MiB image / 16 MP pixel bounds remain. Main JPEG output is ≤350,000 bytes, inline JPEG ≤32 KiB. Output dimensions are bounded; private image metadata is not retained.
- HTML head budget increases from 256 KiB to 1 MiB. Gzip, Brotli and deflate have separate compressed and decoded byte limits. DNS, connection/read and overall network deadlines remain bounded. Another public address may be tried within the same deadline, not infinitely retried.
- A bounded forward metadata scan handles quoted/unquoted/reordered OG/Twitter attributes, `image_src`, itemprop and non-executed JSON-LD. It skips comments and executable script/style text, caps tags/JSON/depth/nodes, decodes common/numeric entities, and tries up to eight distinct real image candidates. Relative image addresses use the final validated page address. Image URL entities are decoded once; signed query order is not rewritten. Sites requiring JavaScript/login, blocking automated access, offering no useful image or serving unsupported formats can still yield a partial/no preview.

## Full-preview-only cache

`PreviewEngine` is shared by the app's personal review and legacy personal-run endpoints, including different owners. It uses per-URL singleflight and four globally active jobs with up to 48 distinct queued jobs; overflow and queued timeout produce recoverable errors rather than unbounded CPU/memory use. Existing owner/global composer admission controls remain.

**Only title + non-empty description + both validated JPEG thumbnails + dimensions + image preview type qualify for positive cache storage.** Text-only, missing-description, failed, malformed or incomplete previews do not become reusable positive entries. The private draft/run snapshot still records exactly what was reviewed, even when partial; that immutable snapshot is not the positive cache.

- Memory: 64-entry / 8 MiB LRU, whichever limit is reached first.
- Private SQLite: additive migration 8, `link_preview_cache`; at most 256 entries / 32 MiB of payload. Six-hour TTL, with expiry pruning on successful writes and LRU eviction. Expired entries are not served. No public cache-list/lookup endpoint exists. Existing database file protections apply.
- Keys hash the normalized public URL with its fragment removed; path/query ordering is not sorted. Each return restores the caller's exact matched text and returns a copy.
- Cache normalized image bytes, not an expiring remote image address. No raw HTML or image download URL is retained. The original/final public page address can remain part of the preview. Complete cache entries survive application restarts. A cache read/write problem degrades to preparation rather than fabricated success.
- Preparing a draft already stored one immutable preview for its entire run. This is preserved: dispatch does not refetch/re-normalize the page for each group.

## Bounded parallelism and native sending

Two real worker threads do image validation/normalization outside the web event loop. The pool has a bounded queue, transfer buffers, byte/pixel bounds, V8 heap limits, task deadlines, worker replacement and explicit shutdown. Idle workers are unreferenced; busy workers are referenced. The libvips intermediate cache is bounded to 8 MiB / 16 items, with one native libvips thread per image, to preserve headroom inside the existing 512 MiB / one-CPU container. This changes resource use, not image quality. No new runtime dependencies or infrastructure were introduced.

The personal dispatcher now has **two concurrent owner lanes**, not one global busy lane. A database-scoped owner-in-flight lock is acquired before the first asynchronous membership lookup and always released. The existing durable per-group pause, owner run order, atomic placement claim, status-first DOUBLE sequence and no-replay/UNKNOWN rules are preserved. This is a single-server dispatcher, not a claim that multiple independent dispatcher processes can safely be started against the same SQLite database.

Native encrypted thumbnail upload metadata is socket-scoped and bounded to 30 LRU entries, with a conservative 30-minute TTL. Concurrent consumers share a pending upload. Required direct path/key/hashes must be present; failures have a **separate bounded 30-second retry cooldown**, never a complete positive-cache entry. Inline real JPEG fallback remains available. Upload expiry can require a new native encrypted upload during a long run; it does not refetch the website or regenerate the image for every target. Durable message IDs, native encoder and single relay are unchanged. No automatic message retry is added.

## Website OG/social card

Local `public/social-card-v1.png` is a real **1200 × 630** branded PNG, with a maintained SVG source. The page supplies absolute HTTPS OG image/secure URL, type, dimensions, alt text, site name, URL, locale and website type; Twitter large-card/title/description/image/alt; canonical URL; theme/application metadata; and a 180px touch icon. JSON-LD describes only the actual Organization/WebSite. No invented social handles, app IDs, search actions, reviews, endorsements or payment claims are added.

The card and copy disclose pre-launch status, unavailable paid jobs/cashout, and that pairing alone does not pay. Page **noindex,nofollow remains**. `robots.txt` permits public page/image fetching for share metadata and disallows `/api/`; robots rules are not authentication. Private API access controls are unchanged. Search indexing is not enabled. Platforms can cache older cards independently; no forced third-party cache invalidation is promised.

## Executed verification before release

- Lint and production build PASS; lockfile dependency records unchanged (only root application versions change).
- **218 unit/API/security/financial/native tests: 217 PASS, 1 optional Redis SKIP, 0 FAIL.**
- **60 full isolated desktop/mobile/Chrome-Android browser regressions PASS**, plus four focused share-card/review tests PASS after saving focused screenshots. Accessible review uses a genuine image or an honest retry warning, not a fake replacement; zero synthetic UI posts were submitted.
- 1,000 same-link callers coalesce into one preparation. 1,000 distinct simultaneous links demonstrate **bounded admission with explicit retry/backpressure**, not a false claim all 1,000 are processed immediately.
- A fully exercised synthetic run includes **1,000 distinct groups with sizes 1 through 1,000**, reuses one full preview, checks each 10-second pacing boundary with an injected clock, finishes without duplicate targets, and creates zero personal rewards. This is not a three-hour live send test.
- 1,000 synthetic native adapter relays reuse one thumbnail upload; installed native SDK encoder/identity tests remain. Additional tests cover upload socket isolation/expiry/LRU/failure cooldown, worker timeout/crash/replacement, compressed input, malformed metadata, unsafe fallback destinations, positive-cache expiry/eviction/persistence/corruption and cross-owner concurrency before preflight.
- Same-process synthetic health/load test: 1,032 preview callers (1,000 sharing one URL + 32 distinct), 33 preparations, 40 successful health checks, peak four active preview jobs and two worker threads. Latest full-suite observed maximum health request was **100.2 ms** in this sandbox. This is an observed synthetic result, **not a production latency SLA or capacity guarantee**.

Additional offline Docker runtime test used the actual candidate image with **512 MiB RAM / one CPU / network disabled**. Sixteen 16 MP preview jobs and one simultaneous 16 MP full-image job completed with two worker threads; all 40 health checks succeeded. Observed maximum health request: **166.3 ms**; sampled process peak RSS **451.1 MiB**, cgroup peak **434,909,184 bytes**. Initial telemetry reads assumed cgroup v2 and failed after processing on this v1 host; the test now supports both. These are bounded synthetic results, not proof of production worst-case capacity.

Browser evidence: `docs/screenshots/preview-*`. Release evidence: `docs/testing/preview-*`. Physical-device/provider rendering remains the founder's own check; providers may omit or change their cards. Historical reviews/runs are not silently rebuilt—make a fresh review to use the corrected preview engine.

All balances, pricing, reward formula, paid ten-campaign limit, referrals, funding/cashout OFF gates, PAPPYPAY pairing, owned accounts, prior history, upload quality and Android motion must remain unchanged. No production test accounts, pairing, group scans or sends are authorized by these tests. Never roll back live data over later legitimate activity. GitHub push status must be reported separately from verified source bundles.


## Executed production release — 15 October 2026

Live HTTPS health reports **0.11.0 / pre-launch**, with the existing WhatsApp account ONLINE. Production retains the existing 512 MiB / one-CPU / 128-PID / read-only-root / dropped-capabilities / no-new-privileges / private-loopback-port / bounded-log settings and protected external environment file. **All application runtime environment values were compared and preserved without printing secrets.**

A release guard caught omitted explicit runtime flags (WhatsApp enablement, app origin, proxy trust) in the initial replacement command. Those attempts automatically restored the previous runtime against the current data volume; no database backup was restored and no financial/history/credential rows changed. The final command explicitly preserves those flags and compares the entire application environment before accepting the release. HTTP health and provider-account readiness are checked separately.

- **32 business/identity/history/pacing fingerprints identical** across the accepted release; auth entries **904 → 904**, credential count unchanged, zero foreign-key errors. Only additive migration 8 was introduced relative to v0.10. All ten treasury reconciliation checks PASS. No pricing/reward/funding/payout changes.
- **39 general + 11 mobile production public read-only checks PASS**, plus two actual production OG/image/robots browser checks PASS. Zero production accounts, phone entries, pairing actions, owned-group scans or messages were generated.
- Public-page-only probes returned actual image previews for the supplied **Him channel**, GitHub's Node.js repository, MDN, WhatsApp's homepage and this website. `example.com` correctly produced only text because it advertises no useful thumbnail/description; it was **not** cached as complete. Five complete previews stored, one partial not stored, and the second Him lookup was a cache hit. No site/provider success is extrapolated into an unfailing guarantee.
- **49 running backend/shared/package/server/compiled frontend/static files are byte-identical to the tested local files.** No dependencies were added or upgraded.

Verified final pre-release SQLite backup: `/app/data/backups/pappy-2026-10-15T12-57-19-443Z.sqlite`. Preserved prior v0.10 runtime: `pappy-earning-hub-rollback-20261015T125718Z`. Source image: `pappy-earning-hub:link-previews-0.11.0`. Keep the current data volume and protected environment; never restore an old SQLite file over later legitimate activity.

Source commit/bundle identity is recorded in the external source-recovery instructions. A saved verified source bundle is not a successful GitHub push; write authorization remains pending unless the push command explicitly succeeds.
