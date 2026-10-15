# PappyPay broadcast, pairing and Plogme implementation plan

**Prepared:** 15 October 2026. **Status:** proposed next-stage design, not a deployed provider integration.

The live v0.2.0 app is unchanged by this planning work. No Plogme installation, pairing request, real message, joining action, money movement or paid service was started.

## 1. What the founder clarified

- `allstatus`: post the payload to eligible **group statuses**, not everybody's private inbox and not merely the account's personal `status@broadcast` story.
- `allchat`: send the payload into eligible group chats, with mention-all/hidetag where the group has explicitly authorised it and the client supports it.
- `2x`: group status first, then group chat. The two successful placements are what justify two worker reward units. This is not a blanket multiplier for a job that only completed half its work.
- If one placement succeeds and the other is prevented by a kick/lock, credit the successful placement only. Never reverse that success because the second placement failed.
- Workers may also run their own personal broadcasts through their own paired numbers. These are a free platform benefit: no advertiser charge, no worker reward, no referral activation and no bonus-unlock contribution.
- Two numbers per owner; shared groups deduplicated. One qualifying group is enough for paid work; no 100-group earning ceiling.
- Preserve PappyPay branding, important link/preview support, real inventory, manual joining and optional authorised joining assistance.

## 2. Package verification and a material licence gate

I downloaded and statically inspected the published **plogme 2.1.0** npm tarball without installing it or executing scripts. Its SHA-512 matched the npm registry's published integrity value. That confirms the downloaded bytes match the registry, not that the code or its dependencies are safe.

The inspected package contains:

| Capability | Evidence in published source | What it does not prove |
|---|---|---|
| Custom pairing | `lib/Socket/socket.js`, `requestPairingCode(phoneNumber, customPairingCode)`; custom length must be 8 | That a chosen code will be accepted for every real device/account |
| Group status | `groupStatus: true`, group-JID validation and `groupStatusMessageV2` wrapping | That every WhatsApp version/group permits or renders every payload |
| Rich previews | `richPreview` branch and normal text `linkPreview` support | That every destination has metadata, or every client displays a card |
| Mentions | Generic message generation handles `mentions` and `mentionAll`, including `nonJidMentions` | That every participant receives a notification or reads the post |
| Provider events | Message update/receipt events exist in receive handling | That group-status confirmation has the same semantics as group-chat delivery |

**Commercial permission must be resolved first.** The included CRYSNOVAX SOURCE LICENSE is not MIT. Its permitted-use clause grants personal/non-commercial use; it imposes visible attribution and restricts specified branding/redistribution activities without written permission. Obtain the author's written permission for this commercial marketplace, hosted personal-broadcast benefit, required modifications and app branding before deployment. Preserve required attribution; naming the app PappyPay does not authorise removing library credits. This is a release gate, not a legal opinion.

Review the transitive native `whatsapp-rust-bridge` dependency, installation hooks, licences, native build availability, network/file access and vulnerabilities before installation. Pin an approved version and lockfile; do not assume the moving GitHub branch matches the npm tarball.

Plogme is a WhatsApp Web protocol library, not evidence of Meta approval. Group consent, platform-policy review and a controlled real-device pilot remain separate gates.

**Evidence URLs:**
- https://registry.npmjs.org/plogme/2.1.0
- https://www.npmjs.com/package/plogme
- https://unpkg.com/plogme@2.1.0/LICENSE
- https://unpkg.com/plogme@2.1.0/lib/Socket/socket.js
- https://unpkg.com/plogme@2.1.0/lib/Socket/messages-send.js
- https://unpkg.com/plogme@2.1.0/lib/Utils/messages.js
- https://github.com/crysnovax/bailey

## 3. Three clear modes, two strictly separate purposes

### Placement modes

| Web command | Group status | Group chat | Maximum paid worker reward/group |
|---|---:|---:|---:|
| `allstatus` | Yes | No | `r` |
| `allchat` | No | Yes, authorised mention-all | `r` |
| `2x` | First | Second, authorised mention-all | `2r` |

`r = min(eligible member snapshot, 1000) / 1000 Coins`, with the existing paid minimum of 100 members.

**A standalone allchat is one placement, not automatically two worker reward units.** An advertiser may pay a higher VIP selling price for it, but selling price and earned worker reward are separate. Your explanation ties 2x worker earnings to two successful placements. No new selling prices are silently approved here.

### Purpose is an immutable server-side field

- `PAID_CAMPAIGN`: approved advertiser/house campaign, verified funding, worker reward reservations, current group permission, receipt-based earnings, applicable paid daily capacity and first-paid-delivery referral qualification.
- `PERSONAL`: owner's content, owner's paired numbers only, no checkout, no treasury allocation, no earning ledger writes, no referral activation, no welcome-bonus progress.

A personal run cannot later be relabelled paid. The browser cannot provide trusted reward amounts, provider receipts or an arbitrary account belonging to someone else.

The 100-member minimum belongs to paid eligibility. Proposed personal-broadcast behaviour is to allow smaller communities the owner is permitted to address, because no paid reward is being claimed. Personal resource/frequency quotas must be disclosed and set before launch; free does not mean unlimited messages or unlimited server/media costs. Personal runs do not consume the ten-paid-campaign counter, but still obey group permissions and shared anti-abuse frequency limits.

## 4. Exact 2x settlement and partial success

Store two independent placements under one campaign/group assignment:

```text
Campaign + unique group + assigned owner/account
    STATUS placement -> its own provider ID, evidence, state and credit key
    CHAT placement   -> its own provider ID, evidence, state and credit key
```

For a 742-member qualifying group:

| Status outcome | Chat outcome | Worker earns |
|---|---|---:|
| Confirmed | Confirmed | 1.484 Coins |
| Confirmed | Definitely not sent / blocked / kicked | 0.742 Coins |
| Definitely failed | Confirmed, only if an authorised chat-only fallback was selected | 0.742 Coins |
| Neither confirmed | Neither confirmed | 0.000 confirmed earned Coins |
| Confirmed | Unknown | 0.742 earned; other 0.742 held for reconciliation |

An unknown result is not proven failure: never release its money or resend blindly. A later verified receipt may credit the second placement once. Kicking after two confirmed placements does not claw back either credit. A read/view count of zero is not the same as failed posting.

For the agreed four groups, `allstatus` fully succeeds at 1.290 Coins; `2x` fully succeeds at **2.580 Coins**. Mixed success is the sum of the independently confirmed placements, not a mode-wide multiplier.

At reservation, take a fresh auditable membership/reward snapshot for the group and reserve both rewards for 2x, plus existing bonus/referral backing requirements. Revalidate membership, posting capability, permission and campaign state before each placement. Retain the existing conservative membership-change guard: do not silently change the reward after work began; hold/replan the unsent placement and keep the first confirmed reward. Crossing below 100 or losing permission stops paid work immediately.

Normally require the status outcome to be known before starting chat. If status acceptance remains unresolved, wait and reconcile rather than flooding another placement. A definite status failure can permit chat-only fallback only when the campaign's approved execution policy explicitly allows it. No chat after being kicked and no switching to another number to bypass a removal.

Unused worker-reward reserves can be released when non-delivery is certain. Advertiser fees/refunds need explicit checkout terms; this plan does not invent a commercial refund policy.

## 5. Selection: what “all” and “smart” mean

### Personal runs

Offer **all eligible own groups**, **manually selected own groups**, or **smart selection within own approved inventory**. The confirmation screen must show actual target count, overlap removed, exclusions, permission gaps and the selected number(s). Never interpret “allchat” as permission to message every private contact.

### Paid smart selection

Hard filters run before scoring:

1. Paired number online and explicitly opted into paid campaigns.
2. Current membership and fresh group metadata.
3. At least 100 members; surface-specific ability to post status/chat.
4. Current verified group-admin permission for the campaign category, required surfaces and mention-all if requested.
5. Validated payload/link, frequency limits, worker daily capacity and fully backed budget.
6. Group not already assigned in this campaign, including through another paired number/worker.

Then use least-recently-broadcast fairness, relevant declared/verified targeting data and delivery cost to choose a budget-fitting set. Do not infer country, age or interests from an unreliable name or phone prefix. Member totals are estimated inventory, not unique human reach, views or guaranteed joins.

`allstatus` therefore means all eligible selected groups for the chosen run/campaign scope, not every WhatsApp group on the platform regardless of budget. No partial underpayment just to squeeze the next group into a small budget.

A campaign/group parent remains unique. Its status and chat children are each unique. Never send status twice merely because the same group appears under both numbers. Assign both placements to the same owner/account by default; do not automatically reassign after a kick to complete an unwanted advertisement.

## 6. Links and previews are a first-class subsystem

Every broadcast requires an explicit valid HTTPS destination. A preview card alone is not enough: keep the destination visible in the text/caption because cards can fail or render differently.

The composer stores a canonical payload plus surface-specific renderings:

```ts
type BroadcastMode = 'ALLSTATUS' | 'ALLCHAT' | 'DOUBLE';
type BroadcastPurpose = 'PERSONAL' | 'PAID_CAMPAIGN';
type Surface = 'GROUP_STATUS' | 'GROUP_CHAT';
type LinkPolicy = 'VISIBLE_LINK_REQUIRED' | 'PREVIEW_REQUIRED';

interface BroadcastDraft {
  mode: BroadcastMode;
  payloadType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'GIF' |
               'AUDIO' | 'DOCUMENT' | 'STICKER' | 'OTHER_SUPPORTED';
  caption: string;
  targetUrl: string;
  assetId?: string; // authorised uploaded asset, never arbitrary filesystem path
  linkPolicy: LinkPolicy;
}
```

### Payload support is a tested matrix, not “any raw object”

- **Text + URL/card:** first supported path on both surfaces, subject to real-device confirmation.
- **Image, video, GIF + caption/link:** next release path after status/chat rendering tests. A media caption link is not a guarantee of a separate rich-preview card.
- **Audio, document, sticker and other special types:** add capability-by-capability. Some cannot carry a caption or native preview on a given surface. Offer a clearly disclosed supported conversion/companion card only with user approval, or block that surface with an explanation.
- Do not silently drop media, pretend a sticker contains a clickable URL, send unsupported protocol wrappers or label a partial payload bundle fully successful.
- Before enabling paid multi-message bundles, explicitly define success and partial-work compensation. Keep them out of paid dispatch until that policy and accounting are implemented. Additional transport messages do not automatically justify additional worker reward units.
- Block raw-protocol injection, impersonation/mimic options and unsafe experimental content. Users may submit supported content, not arbitrary socket instructions.

### Safe preview pipeline

Validate destinations and fetch metadata once through an SSRF-protected, bounded service: HTTPS/public addresses only; validate all DNS answers, pin validated connections to prevent DNS rebinding, revalidate redirects, deny private/loopback/link-local/metadata endpoints, restrict MIME/size/time, and guard thumbnail fetches too. Sanitize displayed metadata, scan/validate uploads and cache by destination/version. WhatsApp invite previews may use the read-only invite-info API; resolving an invite must never join the group automatically.

If preview generation fails, offer an explicit visible-link-only policy or hold a preview-required run before posting. Do not quietly change what the advertiser bought. Browser simulation cannot guarantee recipient rendering; real Android/iOS tests must define supported combinations.

### Two important source-level findings

1. Plogme's special `richPreview: true` branch constructs a message directly. It does not necessarily apply generic `mentionAll` handling in the same way as the normal message builder. Do not assume combining those two flags produces the intended hidden mentions.
2. Generic group-status message generation deletes `groupStatus` from the supplied content object. **Build a fresh payload per group and per placement.** Reusing the same mutable object could cause later sends to use the wrong surface.

Prefer controlled, precomputed `linkPreview` data on the normal text path; that avoids unguarded library fetching and keeps generic mention/status handling together. Verify the resulting serialized message, not just the input flags.

## 7. Illustrative code shapes—not an installed production adapter

After licensing/security approval, the library call shapes are:

```js
// Custom-code API shape only. Never print the returned secret in logs.
const returnedCode = await sock.requestPairingCode(phoneNumber, customCode);

// Fresh text object for every target/surface. safePreview is server-generated,
// validated metadata, not arbitrary browser-supplied preview content.
function buildTextPlacement({ surface, caption, targetUrl, safePreview,
                              mentionAllApproved }) {
  if (surface !== 'GROUP_STATUS' && surface !== 'GROUP_CHAT') {
    throw new Error('Unsupported surface');
  }
  if (surface === 'GROUP_CHAT' && !mentionAllApproved) {
    throw new Error('This allchat target has not authorised mention-all');
  }
  return {
    text: `${caption.trim()}\n\n${targetUrl}`.trim(),
    linkPreview: { ...safePreview, 'matched-text': targetUrl },
    ...(surface === 'GROUP_STATUS'
      ? { groupStatus: true }
      : { mentionAll: true })
  };
}

// Trusted worker only, after fresh permissions and an atomic reservation.
// plannedMessageId must already be bound to this exact placement in the DB.
const sent = await sock.sendMessage(
  groupJid,
  buildTextPlacement(approvedPlacement),
  { messageId: plannedMessageId }
);
// Do NOT credit earnings here. Resolve actual provider evidence separately.
```

These excerpts show reviewed API shapes and an application-side design, not a complete licensed, secure or real-device-tested integration. The preview schema/serialization, mention-all rendering and actual provider evidence still require tests. Do not paste a basic README example into the live money worker and call it complete.

## 8. Pairing screen and PAPPYPAY branding

Keep two slots. Each slot has masked number, true connection state, last successful sync, scan action, paid-campaign permission toggle, reconnect and explicit disconnect/unlink. Distinguish `PAIRING`, `CONNECTED`, `OFFLINE`, `LOGGED_OUT`, `EXPIRED` and `ERROR`; a displayed code is not a successful pairing.

Flow:
1. Owner chooses slot and enters their own international-format number.
2. Explain linked-device access, personal broadcasts, and separately opt into paid campaign use.
3. Create one pairing attempt/socket per slot with strict owner/rate/concurrency limits.
4. Display a private code with **Copy code** and actual validity/cancel state, and instructions to open WhatsApp → Linked devices → link with phone number.
5. Only a real authenticated connection records the provider number, claims its owner history and starts a scanner.
6. Provide rescan/reconnect/cancel/unlink with real outcomes; reject another owner claiming an already-associated number.

**About your exact code:** `PAPPYPAY` has eight characters and passes the inspected library's length check. Acceptance on real devices is unverified. Reusing a public static pairing secret for every user is not recommended. The safer production design is a **PAPPYPAY-branded pairing card with a private, unique eight-character code for each attempt**, with a copy button. This is a clearly stated security recommendation, not a silent change to your requested literal code. Do not promise a particular expiry the provider cannot enforce; cancel and invalidate attempts through the supported lifecycle.

Encrypt/isolate credential and Signal-key storage; do not use an unprotected development multi-file session directory as the production credential vault. No codes, raw credentials, participant lists or session exports in browser storage/logs. A persistent protected HMAC key supports number-owner history; key rotation needs a real migration plan.

## 9. Real group dashboard and joining

Per group show: subject, number/slot, current membership count and scan time, current/past member state, status/chat capabilities, permission scopes, duplicate/excluded state, last campaign and separate status/chat results. Label kicked/left/locked groups and retain relevant history; do not delete earned evidence or present stale groups as active inventory.

React to provider group/participant updates and periodically reconcile. The owner's removal means stop that account's future placements immediately. Never auto-rejoin after removal or switch numbers to evade it.

**Manual joining is the recommended default:** show a reviewed group/invite directory and let the user choose. A random group the owner independently joins does not automatically become an approved advertising target.

**Optional auto-join assistance:** off by default; explicit owner opt-in, approved groups whose administrators permit this joining/advertising, clear per-run scope, provider rate limits, pending-approval handling and cancellation/history. No scraped invite lists, unsolicited random joining, repeated joins after a kick or anti-ban promises. Joining, reaching 100 members and obtaining advertising/mention permission are separate states. No arbitrary incubation period is invented as a new earning requirement.

## 10. Data and worker changes required

The existing v0.2.0 worker is text-only and records one rewarded delivery per campaign/group. It must not be enabled unchanged for the new 2x rules.

Add an additive reviewed migration and compatibility tests:
- Immutable `broadcast_runs`: purpose, owner, mode, target strategy, canonical payload/asset, destination, preview policy, approved execution policy and paid campaign link where applicable.
- One `campaign_group_assignment` per campaign/group with assigned owner/account and auditable base reward snapshot.
- `delivery_placements`: parent/group, surface, immutable expected payload hash, expected provider message ID, provider evidence, independent state and amount. Unique `(assignment_id, surface)`.
- States separating planned/reserved/sending/server-accepted/confirmed/definitely-failed/unknown/cancelled; parent results `FULL`, `PARTIAL`, `NONE`, `PENDING` derived from children.
- Ledger keys such as `placement:<assignment-id>:GROUP_STATUS` and `...:GROUP_CHAT`, preserving historical v0.2.0 entries. Update reconciliation to include the new placement kinds and verify parent/child reservations.
- Permission scopes for group status, chat and mention-all; expiry/revocation and evidence references.
- Encrypted pairing attempts/credential references, current capability snapshots, safe preview/media records and controlled joining requests.

Personal runs use the messaging queue but never paid settlement/referral handlers. Paid runs reserve all promised rewards before the first message. A two-placement campaign counts as one paid campaign participation, not two separate daily broadcasts; extra groups do not create extra campaign participations. Ten paid broadcasts/day remains a capacity ceiling, not guaranteed work.

Build a durable provider-event inbox, authenticate/validate event origin, bind evidence to the exact message/group/account/surface, retain until settled, and deduplicate replays. Determine a surface-specific confirmed-posting standard in live tests; do not assume group status exposes a normal chat delivery/read receipt. If trustworthy status publication evidence is unavailable, keep paid status disabled rather than fabricate it from `sendMessage()` returning successfully. Native protocol retransmission must not become a new application placement or another earning credit.

## 11. Delivery sequence and acceptance gates

1. **Licence/security:** written commercial permission, preserved attribution, exact package/transitive review and approved pin. No production install before these gates.
2. **Accounting/migration:** implement independent placements, partial payout, immutable personal/paid separation, updated budgeting/referrals/reconciliation; preserve existing users/data.
3. **Pairing/scanner:** two real sessions, secret storage, owner claims, scoped consent and live inventory/events. One controlled owner account before public pairing.
4. **Personal text/link pilot:** one explicitly permitted test group, group-status capability and preview/mention rendering verified on recipient phones. No rewards or charges.
5. **Media matrix:** image/video/GIF first; other formats only after honest surface support, link behaviour and any bundle-compensation policy are tested.
6. **Paid pilot:** genuine cleared backing, surface-specific provider evidence and new ledger race/replay/partial-success tests; disclose commercial terms and no guaranteed members.
7. **Joining assistance:** only after approved directory/permission controls; manual joining remains usable throughout.

Required tests include status success/chat kick, chat lock between placements, both success then kick, first success/second unknown, later receipt replay, duplicate group on both numbers, paid 130+ groups, membership changes, exhausted budgets, owner stop, offline/logout, public/static-code risks, personal runs never earning or activating referrals, mentions+preview serialization, mutable payload reuse, URL/thumbnail SSRF, unsupported media, safe migration, reconnect ownership and real recipient rendering.

## 12. Copyable commercial-permission request

> Hello Crysnovax. We want to use plogme 2.1.0 in Pappy Earning Hub/PappyPay, a commercial hosted platform. Users may pair up to two numbers, send their own authorised group broadcasts for free, and opt into funded advertiser/house campaigns using group status and group chat. Mention-all would require group-admin permission. We will preserve required attribution and will not represent the library as our own. Please confirm in writing whether you authorise this hosted commercial use, application branding, deployment and necessary security/integration modifications, and state any licence fees, conditions, redistribution limits and required attribution placement. We will not enable the commercial integration until permission is resolved.
