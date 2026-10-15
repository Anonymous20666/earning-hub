# Final compatibility release — v0.8.1

Live: https://pappy-earnig-hub.duckdns.org — health v0.8.1 / pre-launch. This completes the worker redesign described in `WORKER-EXPERIENCE-0.8.0.md`.

## Additional audit finding and correction

Inspection of the exact installed Plogme 2.1.0 showed its normal `sendMessage` branch generates another message ID even when the caller supplied one. The previous synthetic high-level send mock honored the ID and therefore did not expose this upstream incompatibility. A real successful send could consequently be classified as UNKNOWN and prevent DOUBLE's second leg.

The adapter now uses Plogme's exported **native `generateWAMessage` encoder + one `relayMessage` call** with the already durably claimed ID. It validates the generated ID, group, from-me flag and unchanged owned socket before relay. It does not patch/vendor the SDK, fake a returned ID, replay a send, disable native encryption or add dependencies. Real installed-encoder tests cover group status, backgrounds, mentions, previews and encrypted image preparation with only a synthetic upload/relay boundary and no network send.

The current owned socket also consumes Plogme's actual `messages.update` error shape (status 0 + numeric server error) and correlates it to **account + group + wire ID**, for personal runs only. Late errors cannot be overwritten by an ACCEPTED race. Only unsent dependent chats are cancelled; a started chat cannot be recalled. Repeated/stale/foreign events and ordinary receipt statuses cannot fabricate failures, delivery proof or earnings. Provider error messages warn that some recipients might already have seen a post and nothing was retried. Paid reservations/receipts and money remain untouched.

## Final executed verification

- Lint and production build PASS.
- **184 unit/API tests: 183 PASS, 1 optional Redis SKIP, 0 FAIL.** Includes real installed native encoder, malformed-ID refusal before relay, asynchronous ACK races, late errors, account/group correlation, duplicate events and the actual owned socket's event handler. A last integration test initially lacked its fixture's wallet; setup was corrected without removing the zero-credit assertion. Final logs are `docs/testing/worker-compatibility-{lint,unit,build}.txt`.
- **44 browser regression tests PASS** for the unchanged worker UI, desktop/mobile and Android motion. v0.8.1 changes only backend compatibility and version metadata, not frontend behavior.
- **39 public production read-only checks PASS** against v0.8.1; no production test accounts, pairing, sends or joins. This is not a physical-device delivery or pairing claim.
- Both release preservation checks passed: all 23 business/identity fingerprints unchanged, wallet/ledger/treasury/settings/history/groups intact, auth entries **903 → 903**, slot 1 **ONLINE**, root-only key configuration unchanged, foreign-key errors **0**. v0.8.1 adds no schema migration beyond v0.8.0's additive migration 6.
- Paid jobs/worker, payments and payouts remain OFF. No funding or income was invented. Pairing and personal posts do not earn Coins.

Final-release verified database backup: `/app/data/backups/pappy-2026-10-15T10-49-04-653Z.sqlite`. Preserved rollback container: `pappy-earning-hub-rollback-20261015T104852Z` (v0.8.0), with the earlier v0.7.0 rollback also retained. Do not overwrite subsequent legitimate activity with an old database backup.

GitHub write grant remains pending; source history is committed on the VPS and protected by the verified incremental bundle chain.
