import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { openDatabase } from "../backend/database";
import {
  recordProviderPairing,
  syncProviderInventory,
} from "../backend/inventory";
import {
  allPersonalPlan,
  preparePersonalDraft,
  submitPersonalDraft,
  personalRunFeed,
} from "../backend/personalComposer";
import {
  dispatchPersonalPlacement,
  startPersonalDispatcher,
} from "../backend/personalDispatch";
import {
  normalizePreviewImage,
  fetchPublicResource,
  previewFromHtml,
} from "../backend/safePreview";
const jid = "120363000000000071@g.us",
  jid2 = "120363000000000072@g.us";
function fixture() {
  const db = openDatabase(":memory:");
  for (const u of ["owner", "other"]) {
    db.prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?)").run(
      u,
      u + "@example.test",
      u,
      "SYNTHETIC",
      "EARNER",
      0,
      new Date().toISOString(),
    );
    db.prepare("INSERT INTO wallets(user_id) VALUES(?)").run(u);
  }
  const accounts = ([1, 2] as const).map(
    (slot) =>
      recordProviderPairing(db, {
        userId: "owner",
        slot,
        providerJid: `234800000007${slot}@s.whatsapp.net`,
        hashKey: "a".repeat(64),
      }).id,
  );
  for (const a of accounts) {
    syncProviderInventory(
      db,
      a,
      [
        {
          jid,
          subject: "SYNTHETIC small group 42",
          memberCount: 42,
          announce: false,
          userIsAdmin: true,
        },
        {
          jid: jid2,
          subject: "SYNTHETIC group 99",
          memberCount: 99,
          announce: false,
          userIsAdmin: true,
        },
      ],
      true,
    );
    for (const g of [jid, jid2])
      db.prepare(
        "INSERT INTO broadcast_permissions VALUES(?,?,1,1,1,?,?,?,NULL)",
      ).run(
        a,
        g,
        "b".repeat(64),
        "SYNTHETIC consent",
        new Date(Date.now() + 86400000).toISOString(),
      );
  }
  return { db, accounts, close: () => db.close() };
}
const input = (payload = "A plain-text post", mode = "ALLSTATUS") => ({
  kind: "TEXT",
  payload,
  mode,
});
const preview = async (url: string) => ({
  "matched-text": url,
  title: "Real extracted title",
  description: "Website description",
});
const placements = (db: any) =>
  db
    .prepare(
      "SELECT p.*,t.group_jid,t.run_id FROM broadcast_placements p JOIN broadcast_targets t ON t.id=p.target_id ORDER BY t.id,p.surface DESC",
    )
    .all() as any[];
function transport(calls: any[], reject = false) {
  return {
    refreshGroup: async () => ({
      isMember: true,
      jid,
      subject: "SYNTHETIC group",
      memberCount: 42,
      adminIds: new Set<string>(),
      announce: false,
      userIsAdmin: true,
    }),
    messageId: async () => `SYNTHETIC-${calls.length}`,
    send: async (a: string, j: string, c: any, id: string) => {
      calls.push({ a, j, c, id });
      if (reject)
        throw Error("PRIVATE SDK error must never appear in the console");
      return { key: { id } };
    },
  };
}
test("automatic plan includes sub-100 groups, deduplicates two numbers, and never bypasses scoped consent", () => {
  const f = fixture();
  try {
    let p = allPersonalPlan(f.db, "owner", "ALLSTATUS");
    assert.equal(p.targets.length, 2);
    assert.equal(p.sharedMemberships, 2);
    assert.equal(p.targets[0].members, 42);
    f.db.prepare("UPDATE broadcast_permissions SET mentions_allowed=0").run();
    assert.equal(allPersonalPlan(f.db, "owner", "ALLSTATUS").targets.length, 2);
    assert.equal(allPersonalPlan(f.db, "owner", "ALLCHAT").targets.length, 0);
    f.db
      .prepare("UPDATE broadcast_permissions SET revoked_at=?")
      .run(new Date().toISOString());
    assert.equal(allPersonalPlan(f.db, "owner", "ALLSTATUS").skips.length, 2);
    assert.equal(allPersonalPlan(f.db, "other", "ALLSTATUS").targets.length, 0);
  } finally {
    f.close();
  }
});
test("ignore lists, owner removal, offline and excluded memberships cannot be bypassed through a second number", () => {
  const f = fixture();
  try {
    f.db
      .prepare("INSERT INTO personal_ignored_groups VALUES(?,?,?,?,?)")
      .run("other", jid, "not owner", "hash", new Date().toISOString());
    assert.equal(allPersonalPlan(f.db, "owner", "ALLSTATUS").targets.length, 2);
    f.db
      .prepare("INSERT INTO personal_ignored_groups VALUES(?,?,?,?,?)")
      .run("owner", jid, "ignored", "hash", new Date().toISOString());
    f.db
      .prepare("INSERT INTO broadcast_removals VALUES(?,?,?,?,NULL)")
      .run("owner", jid2, f.accounts[0], new Date().toISOString());
    const p = allPersonalPlan(f.db, "owner", "ALLSTATUS");
    assert.equal(p.targets.length, 0);
    assert.match(p.skips[0].reason, /ignore list/);
    assert.match(p.skips[1].reason, /Removed/);
    f.db.prepare("DELETE FROM personal_ignored_groups").run();
    f.db.prepare("DELETE FROM broadcast_removals").run();
    f.db.prepare("UPDATE paired_accounts SET status='OFFLINE'").run();
    assert.equal(allPersonalPlan(f.db, "owner", "ALLSTATUS").targets.length, 0);
    f.db.prepare("UPDATE paired_accounts SET status='ONLINE'").run();
    f.db.prepare("UPDATE group_inventory SET excluded=1").run();
    assert.equal(allPersonalPlan(f.db, "owner", "ALLSTATUS").targets.length, 0);
  } finally {
    f.close();
  }
});
test("plain text is review-only until explicit confirmation; confirmation is idempotent and earns nothing", async () => {
  const f = fixture();
  try {
    const original = f.db
        .prepare("SELECT * FROM wallets ORDER BY user_id")
        .all(),
      d = await preparePersonalDraft(f.db, "owner", input(), async () => {
        throw Error("Plain text must not fetch a link");
      });
    assert.equal(placements(f.db).length, 0);
    await assert.rejects(
      () => submitPersonalDraft(f.db, "owner", d.draftId, false),
      /Confirm/,
    );
    await assert.rejects(
      () => submitPersonalDraft(f.db, "other", d.draftId, true),
      /not found/,
    );
    const [a, b] = await Promise.all([
      submitPersonalDraft(f.db, "owner", d.draftId, true),
      submitPersonalDraft(f.db, "owner", d.draftId, true),
    ]);
    assert.equal(a.id, b.id);
    assert.equal(placements(f.db).length, 2);
    const calls: any[] = [];
    while (
      await dispatchPersonalPlacement(f.db, transport(calls), "/nonexistent")
    ) {}
    assert.equal(calls.length, 2);
    assert.equal(calls[0].c.text, "A plain-text post");
    assert.notEqual(calls[0].c.backgroundColor, calls[1].c.backgroundColor);
    assert.equal(calls[0].c.groupStatus, true);
    const feed = personalRunFeed(f.db, "owner", a.id);
    assert.equal(feed.run.status, "FINISHED");
    assert.equal(feed.summary.accepted, 2);
    assert.equal(feed.events.filter((e) => e.kind === "SENDING").length, 2);
    assert.equal(feed.events.filter((e) => e.kind === "DONE").length, 1);
    for (const e of feed.events)
      assert.ok(Number.isFinite(Date.parse(e.created_at)));
    assert.deepEqual(
      f.db.prepare("SELECT * FROM wallets ORDER BY user_id").all(),
      original,
    );
    assert.equal(
      (f.db.prepare("SELECT COUNT(*) n FROM ledger").get() as any).n,
      0,
    );
    assert.ok(placements(f.db).every((p) => p.reward_milli === 0));
    assert.throws(() => personalRunFeed(f.db, "other", a.id), /not found/);
    assert.equal(
      personalRunFeed(f.db, "owner", a.id, feed.events.at(-1)!.id).events
        .length,
      0,
    );
  } finally {
    f.close();
  }
});
test("link title is extracted without losing attached multiline text, exact URL matching, or duplicating a canonical slash", async () => {
  const f = fixture();
  try {
    const original =
        "Text before\nhttps://example.com\nMore text with emojis 🎉",
      d = await preparePersonalDraft(f.db, "owner", input(original), preview);
    assert.equal(d.text, "Real extracted title\n\n" + original);
    const run = await submitPersonalDraft(f.db, "owner", d.draftId, true),
      calls: any[] = [];
    await dispatchPersonalPlacement(f.db, transport(calls), "/none");
    assert.equal(calls[0].c.text, d.text);
    assert.equal(calls[0].c.linkPreview["matched-text"], "https://example.com");
    assert.equal(calls[0].c.text.match(/https:\/\/example.com/g).length, 1);
    assert.equal(personalRunFeed(f.db, "owner", run.id).summary.accepted, 1);
  } finally {
    f.close();
  }
});
test("failed or absent website previews fall back to the untouched text, not invented thumbnails", async () => {
  const f = fixture();
  try {
    const d = await preparePersonalDraft(
      f.db,
      "owner",
      input("Keep this caption https://example.com/path"),
      async () => {
        throw Error("No metadata");
      },
    );
    assert.equal(d.preview, null);
    assert.equal(d.text, "Keep this caption https://example.com/path");
    await submitPersonalDraft(f.db, "owner", d.draftId, true);
    const calls: any[] = [];
    await dispatchPersonalPlacement(f.db, transport(calls), "/none");
    assert.equal(calls[0].c.linkPreview, null);
    assert.equal(calls[0].c.text, d.text);
    await assert.rejects(
      () =>
        preparePersonalDraft(
          f.db,
          "owner",
          input("https://127.0.0.1/private"),
          preview,
        ),
      /Private and reserved/,
    );
  } finally {
    f.close();
  }
});
test("changed ignore lists or group permissions invalidate review rather than silently changing recipients", async () => {
  const f = fixture();
  try {
    const d = await preparePersonalDraft(f.db, "owner", input());
    f.db
      .prepare("INSERT INTO personal_ignored_groups VALUES(?,?,?,?,?)")
      .run("owner", jid, "ignored", "hash", new Date().toISOString());
    await assert.rejects(
      () => submitPersonalDraft(f.db, "owner", d.draftId, true),
      /changed/,
    );
    assert.equal(placements(f.db).length, 0);
    const fresh = await preparePersonalDraft(f.db, "owner", input());
    const run = await submitPersonalDraft(f.db, "owner", fresh.draftId, true);
    assert.equal(placements(f.db).length, 1);
    assert.equal(
      personalRunFeed(f.db, "owner", run.id).summary.skippedGroups,
      1,
    );
  } finally {
    f.close();
  }
});
test("expired reviews and deleted media cannot post; a second post rotates status colour but existing rate limits remain", async () => {
  const f = fixture();
  try {
    const d = await preparePersonalDraft(f.db, "owner", input());
    f.db.prepare("UPDATE personal_drafts SET expires_at='2000-01-01'").run();
    await assert.rejects(
      () => submitPersonalDraft(f.db, "owner", d.draftId, true),
      /expired/,
    );
    await assert.rejects(
      () =>
        preparePersonalDraft(f.db, "owner", {
          kind: "MEDIA",
          payload: "",
          assetId: "foreign",
          mode: "ALLSTATUS",
        }),
      /upload/,
    );
    const d2 = await preparePersonalDraft(f.db, "owner", input()),
      r = await submitPersonalDraft(f.db, "owner", d2.draftId, true),
      color = (
        f.db
          .prepare(
            "SELECT background_color FROM personal_run_options WHERE run_id=?",
          )
          .get(r.id) as any
      ).background_color;
    const d3 = await preparePersonalDraft(f.db, "owner", input("Second post"));
    await assert.rejects(
      () => submitPersonalDraft(f.db, "owner", d3.draftId, true),
      /minute/,
    );
    f.db
      .prepare(
        "UPDATE broadcast_runs SET created_at=datetime('now','-61 seconds')",
      )
      .run();
    const r2 = await submitPersonalDraft(f.db, "owner", d3.draftId, true);
    assert.notEqual(
      (
        f.db
          .prepare(
            "SELECT background_color FROM personal_run_options WHERE run_id=?",
          )
          .get(r2.id) as any
      ).background_color,
      color,
    );
  } finally {
    f.close();
  }
});
test("uncertain status is never retried; dependent chat is skipped and the run reaches an honest final summary", async () => {
  const f = fixture();
  try {
    const d = await preparePersonalDraft(
        f.db,
        "owner",
        input("Uncertain synthetic", "DOUBLE"),
      ),
      r = await submitPersonalDraft(f.db, "owner", d.draftId, true),
      calls: any[] = [];
    while (
      await dispatchPersonalPlacement(f.db, transport(calls, true), "/none")
    ) {}
    const feed = personalRunFeed(f.db, "owner", r.id);
    assert.equal(feed.run.status, "FINISHED");
    assert.equal(feed.summary.uncertain, 2);
    assert.equal(feed.summary.cancelled, 2);
    assert.equal(calls.length, 2);
    assert.ok(calls.every((c) => c.c.groupStatus));
    assert.equal(JSON.stringify(feed).includes("PRIVATE SDK"), false);
    assert.equal(
      await dispatchPersonalPlacement(f.db, transport(calls), "/none"),
      null,
    );
  } finally {
    f.close();
  }
});
test("pre-send revocation makes no send and logs failure; current ignore changes are honoured even after queueing", async () => {
  const f = fixture();
  try {
    const d = await preparePersonalDraft(f.db, "owner", input()),
      r = await submitPersonalDraft(f.db, "owner", d.draftId, true);
    f.db
      .prepare("UPDATE broadcast_permissions SET revoked_at=?")
      .run(new Date().toISOString());
    const calls: any[] = [];
    while (await dispatchPersonalPlacement(f.db, transport(calls), "/none")) {}
    assert.equal(calls.length, 0);
    assert.equal(personalRunFeed(f.db, "owner", r.id).summary.failed, 2);
  } finally {
    f.close();
  }
});
test("restart recovery logs uncertainty and skips blocked double-mode chats instead of stranding the run", async () => {
  const f = fixture();
  try {
    const d = await preparePersonalDraft(
        f.db,
        "owner",
        input("Restart", "DOUBLE"),
      ),
      r = await submitPersonalDraft(f.db, "owner", d.draftId, true);
    f.db
      .prepare(
        "UPDATE broadcast_placements SET status='SENDING',provider_message_id=id,sent_at=? WHERE surface='GROUP_STATUS'",
      )
      .run(new Date().toISOString());
    const stop = startPersonalDispatcher(f.db, transport([]), "/none");
    await stop();
    const feed = personalRunFeed(f.db, "owner", r.id);
    assert.equal(feed.run.status, "FINISHED");
    assert.equal(feed.summary.uncertain, 2);
    assert.equal(feed.summary.cancelled, 2);
    assert.equal(feed.events.filter((e) => e.kind === "UNCERTAIN").length, 2);
  } finally {
    f.close();
  }
});
test("real-image normalization preserves aspect ratio, bounds dimensions, supplies JPEG bytes and rejects SVG/decompression bombs", async () => {
  const bytes = await sharp({
      create: { width: 1600, height: 800, channels: 3, background: "#186345" },
    })
      .png()
      .toBuffer(),
    p = await normalizePreviewImage(bytes),
    m = await sharp(Buffer.from(p.thumbnailBase64, "base64")).metadata(),
    small = await sharp(
      Buffer.from(p.inlineThumbnailBase64, "base64"),
    ).metadata();
  assert.equal(m.format, "jpeg");
  assert.equal(m.width, 1000);
  assert.equal(m.height, 500);
  assert.equal(small.width, 320);
  assert.equal(small.height, 160);
  await assert.rejects(() =>
    normalizePreviewImage(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="50000" height="50000"/>',
      ),
    ),
  );
  await assert.rejects(
    () =>
      fetchPublicResource("https://169.254.169.254/latest/meta-data", "image"),
    /Private and reserved/,
  );
});
test("Open Graph/Twitter title extraction handles swapped attributes, apostrophes and entities without deleting captions", () => {
  const p = previewFromHtml(
    '<title>Fallback</title><meta content="The owner\'s &amp; friend\'s title" property="og:title"><meta name="twitter:description" content="Real description">',
    "https://example.com/",
  );
  assert.equal(p.title, "The owner's & friend's title");
  assert.equal(p.description, "Real description");
  assert.equal(p.thumbnailBase64, undefined);
});
test("completed posts cannot be relabelled stopped; cancellation logs are durable and idempotent", async () => {
  const { cancelPersonalRun } = await import("../backend/broadcasts");
  const f = fixture();
  try {
    const d = await preparePersonalDraft(f.db, "owner", input()),
      r = await submitPersonalDraft(f.db, "owner", d.draftId, true);
    assert.equal(cancelPersonalRun(f.db, "owner", r.id).stopped, true);
    assert.equal(cancelPersonalRun(f.db, "owner", r.id).stopped, false);
    let feed = personalRunFeed(f.db, "owner", r.id);
    assert.equal(feed.events.filter((e) => e.kind === "CANCELLED").length, 1);
    assert.equal(feed.summary.pending, 0);
    assert.equal(feed.summary.cancelled, 2);
    assert.equal(
      await dispatchPersonalPlacement(f.db, transport([]), "/none"),
      null,
    );
    f.db
      .prepare(
        "UPDATE broadcast_runs SET created_at=datetime('now','-61 seconds')",
      )
      .run();
    const d2 = await preparePersonalDraft(f.db, "owner", input("Next")),
      r2 = await submitPersonalDraft(f.db, "owner", d2.draftId, true);
    while (await dispatchPersonalPlacement(f.db, transport([]), "/none")) {}
    assert.equal(cancelPersonalRun(f.db, "owner", r2.id).stopped, false);
    feed = personalRunFeed(f.db, "owner", r2.id);
    assert.equal(feed.run.status, "FINISHED");
    assert.equal(feed.events.filter((e) => e.kind === "CANCELLED").length, 0);
  } finally {
    f.close();
  }
});
test("more than 200 eligible groups is an explicit error, never a silently truncated all-status run", () => {
  const f = fixture();
  try {
    f.db.prepare("DELETE FROM group_inventory").run();
    f.db.prepare("DELETE FROM broadcast_permissions").run();
    const inventory = f.db
      .prepare("SELECT * FROM paired_accounts WHERE id=?")
      .get(f.accounts[0]);
    assert.ok(inventory);
    syncProviderInventory(
      f.db,
      f.accounts[0],
      Array.from({ length: 201 }, (_, i) => ({
        jid: `120363${String(i).padStart(12, "0")}@g.us`,
        subject: "SYNTHETIC cap " + i,
        memberCount: 42,
        announce: false,
        userIsAdmin: true,
      })),
      true,
    );
    for (const g of f.db
      .prepare("SELECT group_jid FROM group_inventory WHERE account_id=?")
      .all(f.accounts[0]) as any[])
      f.db
        .prepare(
          "INSERT INTO broadcast_permissions VALUES(?,?,1,1,1,?,?,?,NULL)",
        )
        .run(
          f.accounts[0],
          g.group_jid,
          "b".repeat(64),
          "SYNTHETIC admin consent",
          new Date(Date.now() + 86400000).toISOString(),
        );
    assert.throws(
      () => allPersonalPlan(f.db, "owner", "ALLSTATUS"),
      /no group was silently left out/,
    );
    assert.equal(placements(f.db).length, 0);
  } finally {
    f.close();
  }
});
