# URL-only Smart Promotion correction

15 October 2026 — local, unreleased. Production application and database contents were not changed.

## Subsequent remix implementation

The screenshot has since been supplied and inspected. A real local compositional URL/typography engine, migration 10, protected example gallery and immutable per-group allocations are now implemented and tested. See `GROWTH-REMIX-ENGINE.md` and the updated implementation status. The original correction evidence below predates the remix; it must not be confused with current test counts or physical-provider certification.

## Founder instruction

A growth/Smart Promotion posts the destination URL itself. It does not solicit or post an advertiser-written caption. At the time of this correction the founder planned to supply the SaaS reference; a screenshot has now been supplied. Do not claim that design is implemented before inspecting the supplied reference.

## Implemented now

- Removed `message` from the new growth input type, validator, form, review and fixtures. No caption is required to save/submit growth orders.
- Added `shared/growthPost.ts`: allowlisted URL-only post instruction builder, using the same platform-specific destination validation as drafts. It accepts only product/destination as meaningful inputs and cannot append old message/caption/private-title fields to post text.
- Campaign detail responses omit obsolete message/caption fields from historic local drafts; immutable quote plans now include the explicit URL-only post instruction.
- Older Smart verified campaign UI no longer requests a caption. Its legacy storage field is kept empty for schema compatibility, regardless of supplied former caption. Direct-session advertising and free personal posting are not changed by this correction.
- The private campaign label is not promotional text. Artwork is separate from URL post text. No imaginary generated artwork or provider-preview success is returned.

## What remained after this earlier correction

- The reference/engine were pending at this earlier checkpoint. They are now implemented locally from the supplied screenshot; physical native-card/font rendering remains unverified. No actual SaaS source was supplied or inspected.
- Live provider access, channel count verification and actual post-trigger testing. The earlier live-engine/merchant/funding/payout blockers remain.

## Authorized account and testing boundary

The founder states the existing paired worker number is theirs and authorizes tests across its groups/channels. Start with discovery/read-only checks. Do not equate membership or ownership of the paired phone with permission to change or broadcast into every third-party destination. Writes need current destination/control/permission checks; no mass test blast, ownership transfer, fabricated follower changes or unfunded paid work.

A read-only production SQLite inspection found one slot (slot 1, masked suffix 7112), recorded ONLINE with paid opt-in; two cached member-group rows, both marked user-admin. The inventory scan timestamp was 2026-10-15T13:22:24.828Z. These are cached records, not a fresh SDK read, a channel inventory, physical provider permission confirmation or a follower baseline. No second socket was opened, session decrypted/copied, auth session provisioned, test broadcast sent, or admin/follower state changed. An SSH key permission issue was repaired locally to mode 0600 before the read-only inspection; no key material was printed.

## Executed verification

- TypeScript lint PASS; production frontend build PASS.
- Full current suite: **252 tests, 251 passed, one optional Redis skipped, zero failed**. Includes five new URL-only regression tests.
- Six targeted desktop/mobile browser tests PASS: new growth save/edit/submit with no message field; Telegram channel planning with no caption; legacy Smart verified estimate/save/edit/delete with no caption. The new growth flows also execute existing automated accessibility and overflow checks.
- First browser launch could not start because sandbox OS libraries had not persisted. Installed only the missing local QA browser libraries and reran successfully. No production dependency change or package/lockfile edit was required.
- Node/runtime/app dependencies restored from existing lockfiles because generated dependency directories do not persist across workspace sessions.
- Separate access-gated QA server stopped and its fixture database/token removed after tests.

Evidence: `docs/testing/growth-url-only-{tests,build,browser}.txt`.

Earlier screenshots, test counts and source handoffs describe the earlier planning foundation. This correction and the current source supersede the earlier caption contract; earlier audit evidence must not be presented as proof of a final mini-card design or live verification.
