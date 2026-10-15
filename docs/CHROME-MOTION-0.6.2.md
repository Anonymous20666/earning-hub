# Chrome Android motion correction — v0.6.2

15 October 2026. Deployed at https://pappy-earnig-hub.duckdns.org.

## Actual report and diagnosis boundary

The founder still saw no movement after v0.6.1 and identified **Chrome on Android**. The founder's physical phone/preferences were not remotely inspected. Actual production checks in Chrome Pixel 7 **emulation**, with explicit simulated preferences, found:

- Normal preferences: changing phone transforms.
- `navigator.connection.saveData=true`: completely paused scene.
- Reduced-motion preference: completely static scene with `animation-name:none`.

These reproduce ways the old app became static; they do not prove which preference the founder's phone was reporting. Previous normal-preference tests were insufficient to establish this user's experience.

## Changes

- Network data-saving no longer blocks local CSS animation; this scene requires no extra animation downloads.
- More noticeable phone movement: 22px vertical travel, wider tilting/yaw and a six-second repeating cycle.
- Orbit/card animations use broadly supported combined `transform` keyframes rather than individual `rotate`/`translate`/`scale` animation properties. Mobile scale and card tilt are retained inside combined transforms.
- An explicit **per-browser** motion preference: `/?motion=on` enables and remembers animation; `/?motion=system` clears it and restores system preference; `/?motion=off` explicitly disables it. URL intent still works when browser storage is blocked. No Play/Pause/design-permission UI added.
- Explicit `on` correctly overrides the global reduced-motion CSS duration/iteration rules for the scene alone, not navigation or the rest of the website. Normal visitors still have their reduced-motion preference respected. Offscreen/hidden-tab pauses remain.
- Legacy media-query listener and missing IntersectionObserver fallbacks are covered.

The founder was given https://pappy-earnig-hub.duckdns.org/?motion=on to explicitly request motion without changing phone settings. **Confirmation from the founder's actual device is still pending.** Do not equate emulation with physical-device verification.

## Evidence

- TypeScript lint/build PASS.
- Unit/integration: 167 total, 166 passed, 1 Redis check skipped, 0 failed.
- Focused browser motion suite: **6 passed**, including 4 dedicated Chrome Android-emulation cases (data saving, reduced-motion opt-in/persistence/reset/off, blocked storage, legacy listener/observer fallback). Tests sample transforms and visible element displacement, not only an `is-playing` class.
- Full 36-case browser run: **35 passed, 1 failed during a test screenshot**, after the treasury functional assertions passed. The accumulated high-DPR full-page treasury screenshot crashed Chromium; this repeated on an isolated rerun. Bounded that unbounded-list screenshot to its viewport without changing any financial assertions. The affected treasury test then passed on both desktop and mobile (**2 passed**). Initial failure and retest logs are retained rather than described as a clean uninterrupted full run.
- Actual public domain: **34 read-only checks passed**, including Android-emulated data-saving, reduced-motion before opt-in, actual motion after explicit opt-in and motion persisting after a fresh load without a query. No accounts, pairing, messages or joins created.
- Production preservation: 23 business/identity fingerprints unchanged; 903 encrypted authentication entries preserved; credentials, both existing groups, treasury/paid settings and encryption configuration/permissions unchanged; zero foreign-key errors; existing slot ONLINE.
- Verified pre-release database backup: `/app/data/backups/pappy-2026-10-15T06-38-27-356Z.sqlite`.
- Previous container: `pappy-earning-hub-rollback-20261015T063816Z`.

Evidence is in `docs/testing/chrome-motion-*`. No financial rule, paid/payout gate, account or messaging policy changed. GitHub write grant is still pending; the code is committed locally and included in a source-update bundle based on the previously supplied v0.6.0 full-history bundle. No GitHub push is claimed.

Continuous motion without an on-page pause mechanism still needs manual motion-accessibility review; automated axe checks alone do not establish complete WCAG conformance. Explicit per-browser opt-in is kept distinct from forcing motion on all reduced-motion users.
