# Automatic continuous scene — v0.6.1

15 October 2026. Deployed and healthy at https://pappy-earnig-hub.duckdns.org.

## Cause and correction

The v0.6.0 scene deliberately stopped after 4.5 seconds. On mobile that timer could expire before the visitor even scrolled to the illustration. The founder reported that it was no longer moving and clarified the intended continuously animated default.

Removed the automatic cutoff. The scene now continues while visible, resumes when scrolled back into view and pauses when the tab is hidden. Device reduced-motion and network data-saving preferences still suppress motion, including preference changes while the page is open. Play/Pause buttons and design narration remain removed. No financial, referral, messaging, authentication or database-schema rules changed.

## Verification

- TypeScript lint and production build: PASS.
- Unit/integration: 167 total, 166 passed, 1 Redis integration skipped, 0 failed.
- Targeted desktop/mobile browser regressions: 2 passed. Tests wait 5.5 seconds, sample actual computed phone transforms 300 ms apart, verify continued movement, scroll offscreen/back to verify pause/resume and toggle reduced-motion preferences.
- Actual domain: 30 public read-only checks passed, including actual changing transforms beyond the old cutoff on desktop and 390px mobile. No registration, pairing, WhatsApp messages or joins.
- 23 business/identity fingerprints unchanged; zero foreign-key errors; existing 903 encrypted authentication entries and credential entry preserved. Both existing small groups and ONLINE slot preserved. Treasury/paid settings and encryption-key file content/root-only permissions unchanged.
- Verified backup before restart: `/app/data/backups/pappy-2026-10-15T06-15-09-047Z.sqlite`.
- Previous container retained: `pappy-earning-hub-rollback-20261015T061453Z`.

Automated accessibility checks are not proof of complete WCAG conformance. In particular, continuously moving decoration without an on-page pause mechanism needs manual review against motion requirements; device reduced-motion support is retained, and no blanket conformance claim is made.

GitHub write access remains pending the earlier deploy-key grant. This fix is committed locally on the VPS; no remote push is claimed or retried without an access change. Source history is preserved independently of private account/session backups.
