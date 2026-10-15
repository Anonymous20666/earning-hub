# Posting pace, clear outcomes and image quality — v0.10.0

## Founder request

Correct the calculator's visible literal `\n` sequences; choose a delay per group (10 seconds by default, up to one minute); show a live countdown and the actual next group; call a successful personal send **Sent** rather than attaching an unconfirmed-delivery warning; and investigate/improve blurry media.

## Implementation

### Calculator

The placeholder was a quoted JSX attribute: backslash escapes were literal text, not JavaScript newlines. It is now a JavaScript string expression with actual line breaks. Browser regressions assert the exact DOM placeholder at five widths and refuse literal backslash-n text.

### Durable per-group scheduling

- Every new personal review has an integer **10–60 second** delay, default 10. The value is validated server-side, returned in review, included in its immutable payload/idempotency contract, and stored with the run. Submission cannot override the reviewed value. Existing personal review/run records without a value use 10 seconds; no old payload is rewritten.
- Additive migration 7 creates `personal_run_pacing`, `personal_owner_queue` and `personal_completed_groups`. The reviewed delay cannot be updated. No existing business/history/credential table is rebuilt or cleared.
- A durable checkpoint records group completion exactly once, and saves the owner's next eligible group time in the same transaction as the result. DOUBLE finishes both sequential post types in that group before starting the pause. A failed preflight that sent nothing does not impose a post-send pause.
- Queued runs belonging to the same owner remain ordered and cannot bypass an active pause. Other owners are not blocked by that owner's countdown. Selection cannot advance to another group while the earlier group is still in flight. The existing two-second worker tick remains; the configured delay is a minimum pause, not a promise that network/permission checks take zero extra time.
- A refresh or restart does not reset a countdown or resend a message. Restart/late-error recovery respects the completion checkpoint. Stop still cancels only unstarted posts. No browser timer authorizes a send: the server gates actual dispatch.
- The private event feed exposes the actual next queued group/post type and server-recorded deadline. The console displays its name, a remaining-seconds timer and progress indicator, or an honest earlier-post/preparation/reconnection state. Countdown ticks are not spammed into SQLite events or screen-reader live announcements.
- Personal daily/run-count and 200-group quotas remain removed. The former sixty-second *run-start quota* is not restored; this is a configurable pause between group send attempts. Ownership, ignore/removal restrictions, confirmation, deduplication and no automatic retry remain.

### Personal success wording

Successful personal sender returns remain internally ACCEPTED/CONFIRMED but render as **Sent**. Generic delivery-unconfirmed/acceptance-disclaimer copy is removed from new success/DONE events and the console footer; known old boilerplate is omitted when displaying older successful events without rewriting stored history. Genuine provider rejection, timeout, restart uncertainty and late error correction remain visible. No read/view/delivery proof or financial credit is manufactured. All paid reward/receipt rules are untouched.

### Media investigation and correction

The existing app used Sharp already, but converted every JPEG/PNG/WebP into a maximum-2048px quality-85 JPEG, losing screenshot/text detail. Inspection of installed Plogme 2.1.0 also found `extractImageThumb(..., width=32)` with JPEG quality 50. That tiny preview could look blurred before the full attachment downloads.

- Validated images retain up to **4096px** on the long side without enlargement, with orientation corrected, sRGB output and private metadata stripped. The existing 16-megapixel decoding and 8-MiB upload/output bounds remain.
- PNG/WebP inputs use lossless PNG where they fit. Photos use JPEG quality **95 / 4:4:4 chroma**, rather than 85 / default subsampling. Size-bounded fallbacks keep supported files within 8 MiB. No invented detail, heavy oversharpening or false native-HD flag is used.
- Native image messages receive a bounded **320px quality-85** JPEG preview with correct dimensions; overly large thumbnails fall back to a smaller preview. The full image remains separate. The SDK still does native encryption/upload, one relay and the durable owned wire ID. A small bounded in-memory thumbnail cache avoids repeated preview decoding. Upload processing is globally serialized to contain the higher-quality pipeline's memory use on the existing server; owner/file/storage/SSRF/security restrictions remain.
- Existing uploaded images are not retroactively sharpened or overwritten. Re-upload an original clear image to benefit from the new normalization. MP4 bytes are still validated and retained; GIF-to-MP4 and existing duration/dimension bounds remain. This is not an untested claim that WhatsApp never compresses media.

## Verification scope

New unit/API regressions cover default/max/invalid delays; immutable review and submission override refusal; exact 10/60-second gates under an injected test clock; both DOUBLE legs before pausing; other-owner progress; no same-owner bypass; restart persistence; late-ACK recovery without extending a completed pause twice; in-flight concurrency; Stop during countdown; zero personal earnings and retained cap removal.

Media tests cover >2048px detail, lossless screenshot pixels, 4:4:4 JPEG, orientation, stripped EXIF, no upscaling, input bombs/SVG rejection, bounded 320px previews, and actual installed SDK image encoding. Its full-image `fileSha256`/length/dimensions match the real input rather than the thumbnail; the original durable-ID/one-relay assertions remain.

New isolated browser journeys check the 10-second default, 60-second review, countdown visibly ticking, next-group name, countdown surviving refresh without a second submission, clean Sent wording, completed totals and accessibility/mobile geometry. These are explicitly synthetic transport contracts with WhatsApp disabled. Live release checks are public/read-only: no production test accounts, real pairing, group scans or sends. Real physical-device/media rendering still needs the founder's own check.

No pricing, reward formula, wallet, referral, paid ten-campaign/day rule, funding, payout gate or automatic Android scene motion is changed. Source recovery must not be confused with live database/key recovery; never overwrite later legitimate activity with an old database.

## Executed release results — 15 October 2026

**Live and healthy:** https://pappy-earnig-hub.duckdns.org — v0.10.0 / pre-launch.

- Lint and production build PASS; no new dependencies. Package-lock changes are only the two root application version fields.
- **199 unit/API/security/finance/native-encoder tests: 198 PASS, 1 optional Redis SKIP, 0 FAIL.** Earlier fixture expectations for forced JPEG output and synthetic group metadata were updated to the intended lossless-PNG/native group contract; added actual pixel/hash/delay assertions rather than dropping those checks.
- **56 full browser regression tests PASS**, zero failures/skips, including desktop/mobile/Android motion, accessibility, visible countdown, next group, refresh/no second submission, maximum reviewed delay and exact multiline placeholder at five widths. A separate focused run also passed all 20 relevant journeys.
- **39 general + 11 mobile-specific production public read-only checks PASS**. These include the actual multiline DOM placeholder, responsive geometry, conditional maths and unchanged automatic Android-motion behavior. No production accounts, pairing, group scans, messages, deposits or funding were created by verification.
- **29 business/identity/history fingerprints identical across release**, now including personal drafts/options, ignores, events, asset records and native policy. Existing balances, ledger, referrals, history, uploads and configuration were not rewritten. Auth entries **904 → 904**, credential count unchanged, existing number ONLINE, zero foreign-key errors. Only additive migration 7 was added. All ten live read-only treasury reconciliation checks PASS.
- The running container's backend/shared sources, server, package/lock and compiled frontend index/CSS/JS are byte-identical to the tested local build. New saved screenshots: `docs/screenshots/posting-*`; evidence: `docs/testing/posting-*`.

Verified pre-release SQLite backup: `/app/data/backups/pappy-2026-10-15T12-14-46-659Z.sqlite`. Preserved prior v0.9.0 container: `pappy-earning-hub-rollback-20261015T121435Z`. Retain the existing live data volume and external key configuration. Never restore an old database over later legitimate activity.

GitHub write permission remains pending. Preserve committed source and the independently verified incremental bundle recovery chain; do not claim a remote push without a successful result.
