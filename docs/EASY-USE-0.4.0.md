# v0.4.0 — small groups, simpler screens and moving landing page

## User-requested behaviour
Small groups may receive approved posts. Fewer than 100 members means **zero worker reward**, not a ban on receiving posts. Personal posting already allowed small groups; the new funded-placement path now does too, with the exact 100-member reward threshold preserved. Groups need current membership, posting permissions and admin consent regardless of size. Owner-level removal, exclusion and deduplication controls still apply.

A zero-reward funded placement cannot earn referral rewards, back a new welcome bonus, count as earned bonus progress, or create an earnings-ledger credit. It cannot consume the referral hold reserved for other positive-reward work. Cancelling the last reward-bearing placement releases the referral hold even if small-group placements remain queued. Positive rewards remain exactly min(members,1000) milli-Coins, independently per confirmed surface; 99 members earns 0, 100 earns 100 milli-Coins (0.100 Coins). All funding/real-receipt gates remain unchanged. The inactive legacy synthetic worker is reward-bearing-only; it is not the live personal sender. No live paid Plogme dispatcher or verified receipt adapter has been introduced.

## Easier to use
- Overview now starts with a real-state guide: Connect WhatsApp → Choose groups → Send your post. It reads existing owner connection/group/permission state, not invented completion. Connected owners are directed forward, not told to pair again.
- Clear menu names: My WhatsApp, Send a post. Larger worker-page text, controls and checkboxes, stronger contrast, step-by-step pairing instructions and plain error help.
- Friendly status labels rather than raw protocol states. Group status, Group chat and Both are explained; allstatus/allchat/2x command meanings remain unchanged.
- Small groups are visibly included, with a no-paid-reward label. All-size inventory and permission counts are separated from the 100+ member count.
- Optional pictures, videos and preview controls are tucked into an expandable section. On mobile, selectable groups become easy-to-read cards while keeping accessible table headers. No financial rules were changed as part of copy/design edits.

## Landing motion
An original CSS perspective phone scene replaces the static network diagram. It has layered depth, gentle floating and orbital movement, with no new package, external model, 3D asset download, WebGL requirement or billing. Decorative content is labelled an illustration, not live account activity. A visible pause/play control stores the user's choice. Reduced motion and data-saving preferences default to still; motion pauses when the page is hidden or the scene is off screen. Reduced-motion users may explicitly choose playback. Essential content works without animation.

## Validation and remaining gates
139 automated tests: 138 passed, one dedicated-Redis check skipped. 24 desktop/mobile browser tests passed, including keyboard/accessibility, motion pause/reduced-motion, connected-owner guidance, selectable 42/99-member groups and zero earned balance. Display-state mocks are explicitly synthetic, restricted to isolated localhost QA and never used as real provider delivery evidence. No real group send or group join was performed as a test. Real group-status/media/receipt behaviour still needs owner validation. Paid earning, paid dispatch, checkout and payouts remain OFF; no cash or fake earnings were added.

The existing paired owner session must be preserved. Release reuses the root-only persistent keys and data volume, takes a verified SQLite backup and preserves a rollback container. WhatsApp may briefly reconnect during the app restart; neither a new pairing attempt nor an outbound test post is requested by the release.

## Live verification
Deployed on the existing HTTPS domain. All 23 read-only public checks passed. No production test account or test post was created. The owner’s existing number reconnected ONLINE after restart and both existing sub-100-member groups remained present. Account/wallet/ledger and phone-ownership fingerprints were unchanged; encrypted authentication was retained. This verifies saved-session reconnection, not delivery or receipt behaviour.
