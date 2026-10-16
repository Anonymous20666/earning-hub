import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fixture, draft, running, input } from "./growth-fixtures";
import { openDatabase } from "../backend/database";
import {
  GrowthCreativeEngine,
  growthStyleIndex,
} from "../backend/growthCreative";
import { PreviewEngine } from "../backend/previewEngine";
import {
  renderGrowthRemix,
  styleDestinationName,
  cleanDestinationName,
  GROWTH_REMIX_CAPACITY,
  GROWTH_TYPE_STYLES,
  NATIVE_GROWTH_FONTS,
} from "../shared/growthRemix";
import type { SafePreview } from "../backend/safePreview";
const jpeg = Buffer.from([255, 216, 255, 224, 0, 16, 255, 217]).toString(
  "base64",
);
const preview: SafePreview = {
  "matched-text": input().destination,
  title: "SYNTHETIC Community",
  description: "SYNTHETIC metadata fixture, not an observed follower count.",
  previewType: 5,
  thumbnailBase64: jpeg,
  inlineThumbnailBase64: jpeg,
  thumbnailWidth: 120,
  thumbnailHeight: 120,
};
const seed = "b".repeat(64);
const options = {
  product: "WA_GROUP" as const,
  destination: input().destination,
  destinationName: "Pappy Community",
};

test("remix catalogue is finite, compositional and uses only protocol/encoder-intersection native font IDs", () => {
  assert.equal(GROWTH_REMIX_CAPACITY, 13934592);
  assert.equal(GROWTH_TYPE_STYLES.length, 12);
  assert.deepEqual(
    NATIVE_GROWTH_FONTS.map((f) => f.id),
    [0, 1, 2, 6, 7, 8, 9],
  );
  assert.throws(() => growthStyleIndex(seed, GROWTH_REMIX_CAPACITY));
  assert.throws(() => renderGrowthRemix({ ...options, styleIndex: -1 }));
  const indices = new Set<number>();
  for (let i = 0; i < 10000; i++) indices.add(growthStyleIndex(seed, i));
  assert.equal(indices.size, 10000);
  assert.equal(growthStyleIndex(seed, 55), growthStyleIndex(seed, 55));
  assert.notEqual(
    growthStyleIndex("a".repeat(64), 55),
    growthStyleIndex(seed, 55),
  );
});
test("Unicode alphabets use assigned characters and preserve the exact underlying ASCII letters/digits", () => {
  for (const style of GROWTH_TYPE_STYLES) {
    const title =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
      styled = styleDestinationName(title, style);
    assert.equal(styled.normalize("NFKC").replaceAll(" ", ""), title, style);
    for (const char of styled)
      assert.ok(char === " " || /[\p{L}\p{N}]/u.test(char), style + ":" + char);
  }
});
test("metadata is bounded, bidi/control/extra-link/mention stripped, non-Latin names retained, and URL never styled", () => {
  assert.equal(cleanDestinationName("你好 مرحبا", "fallback"), "你好 مرحبا");
  assert.equal(
    cleanDestinationName(
      "https://evil.test @everyone\n\u202e TITLE",
      "fallback",
    ),
    "everyone TITLE",
  );
  assert.equal(cleanDestinationName("", "WhatsApp group"), "WhatsApp group");
  const name = cleanDestinationName("界".repeat(500), "fallback");
  assert.equal(Array.from(name).length, 33);
  const destination = input().destination + "?mode=ac_t&source=ABC_123";
  for (let i = 0; i < 1000; i++) {
    const c = renderGrowthRemix({
      ...options,
      destination,
      styleIndex: growthStyleIndex(seed, i),
    });
    assert.equal(
      c.text.split("\n").filter((line) => line === destination).length,
      1,
    );
    assert.equal((c.text.match(/https:\/\//g) || []).length, 1);
    assert.equal(c.plainText, "Pappy Community\n" + destination);
    assert.ok(c.text.length <= 1600);
    assert.ok(Buffer.byteLength(c.text) <= 6000);
  }
});
test("gallery fetches metadata once, freezes one shared asset and never treats a private campaign label as the destination name", async () => {
  const db = fixture();
  try {
    const o = draft(db, { title: "PRIVATE LABEL DO NOT DISPLAY" });
    let calls = 0;
    const engine = new GrowthCreativeEngine(db, {
      get: async () => {
        calls++;
        return { ...preview };
      },
    });
    const g = await engine.gallery("buyer", o.id, 6);
    assert.equal(calls, 1);
    assert.equal(g.quality, "COMPLETE");
    assert.equal(g.examples.length, 6);
    assert.equal(new Set(g.examples.map((c) => c.nativeFont)).size, 6);
    assert.equal(new Set(g.examples.map((c) => c.backgroundColor)).size, 6);
    assert.equal(new Set(g.examples.map((c) => c.typography)).size, 6);
    assert.ok(
      g.examples.every(
        (c) =>
          c.destinationName === "SYNTHETIC Community" &&
          !c.text.includes("PRIVATE LABEL"),
      ),
    );
    const second = await engine.gallery("buyer", o.id, 4);
    assert.equal(second.assetId, g.assetId);
    assert.equal(
      (db.prepare("SELECT COUNT(*) n FROM growth_creative_assets").get() as any)
        .n,
      1,
    );
    assert.equal(g.liveDispatch, false);
    await assert.rejects(engine.gallery("other", o.id), /not found/);
    assert.equal(calls, 1);
    await assert.rejects(engine.gallery("buyer", o.id, 100), /1–6/);
  } finally {
    db.close();
  }
});
test("incomplete and failed preview fetches produce an honest URL remix without a fabricated image, follower number or private-label substitute", async () => {
  const db = fixture();
  try {
    const o = draft(db);
    for (const fail of [false, true]) {
      const engine = new GrowthCreativeEngine(db, {
        get: async () => {
          if (fail) throw Error("SYNTHETIC unreachable");
          return {
            "matched-text": input().destination,
            title: "",
            description: "",
          };
        },
      });
      const g = await engine.gallery("buyer", o.id);
      assert.equal(g.quality, fail ? "UNAVAILABLE" : "PARTIAL");
      assert.equal(g.preview.thumbnailBase64, undefined);
      assert.ok(
        g.examples.every((c) => c.destinationName === "WhatsApp group"),
      );
      assert.match(g.warning, /No image or follower count is invented/);
    }
  } finally {
    db.close();
  }
});
test("an asynchronous metadata result cannot freeze a campaign edited or cancelled during the fetch", async () => {
  const db = fixture();
  try {
    const o = draft(db);
    let resolve!: (v: SafePreview) => void;
    const engine = new GrowthCreativeEngine(db, {
      get: () =>
        new Promise((r) => {
          resolve = r;
        }),
    });
    const pending = engine.gallery("buyer", o.id);
    db.prepare("UPDATE growth_orders SET revision=revision+1 WHERE id=?").run(
      o.id,
    );
    resolve(preview);
    await assert.rejects(pending, /changed/);
    assert.equal(
      (db.prepare("SELECT COUNT(*) n FROM growth_creative_assets").get() as any)
        .n,
      0,
    );
  } finally {
    db.close();
  }
});
test("one frozen creative per order/group survives duplicate calls and both surfaces; old assets and mutated snapshots cannot be used", async () => {
  const db = fixture();
  try {
    const id = running(db),
      engine = new GrowthCreativeEngine(db, { get: async () => preview }),
      gallery = await engine.gallery("buyer", id);
    const p = engine.allocate(id, "120363000000000001@g.us", gallery.assetId),
      again = engine.allocate(
        id,
        "120363000000000001@g.us",
        "ignored-on-safe-same-group-retry",
      );
    assert.equal(again.id, p.id);
    assert.equal(again.reused, true);
    assert.deepEqual(again.creative, p.creative);
    assert.equal(
      engine.content(p.id, "GROUP_STATUS").text,
      engine.content(p.id, "GROUP_CHAT").text,
    );
    assert.equal(
      (engine.content(p.id, "GROUP_STATUS") as any).font,
      p.creative.nativeFont,
    );
    assert.equal("font" in engine.content(p.id, "GROUP_CHAT"), false);
    assert.equal(
      engine.content(p.id, "GROUP_STATUS", true).text,
      p.creative.plainText,
    );
    assert.throws(
      () => db.exec("UPDATE growth_creative_placements SET render_json='{}'"),
      /immutable/,
    );
    assert.throws(
      () => db.exec("UPDATE growth_creative_assets SET preview_json='{}'"),
      /immutable/,
    );
    const second = draft(db);
    assert.throws(
      () =>
        engine.allocate(second.id, "120363000000000002@g.us", gallery.assetId),
      /reviewed/,
    );
    db.prepare("UPDATE growth_orders SET status='ACCEPTED' WHERE id=?").run(
      second.id,
    );
    assert.throws(
      () =>
        engine.allocate(second.id, "120363000000000002@g.us", gallery.assetId),
      /owned/,
    );
    db.prepare("UPDATE growth_orders SET revision=revision+1 WHERE id=?").run(
      id,
    );
    assert.throws(
      () => engine.allocate(id, "120363000000000003@g.us", gallery.assetId),
      /current/,
    );
  } finally {
    db.close();
  }
});
test("real Plogme encoder accepts selected native fonts/backgrounds and preserves a link-only decorated text without a network send", async () => {
  const { generateWAMessageContent, proto } = (await import("plogme")) as any;
  for (const font of NATIVE_GROWTH_FONTS) {
    assert.ok(
      Object.values(proto.Message.ExtendedTextMessage.FontType).includes(
        font.id,
      ),
    );
    const content = await generateWAMessageContent(
      {
        text: renderGrowthRemix({ ...options, styleIndex: 0 }).text,
        linkPreview: null,
      },
      { font: font.id, backgroundColor: "#2563EB" },
    );
    assert.equal(content.extendedTextMessage.font, font.id);
    assert.equal(content.extendedTextMessage.backgroundArgb, 0xff2563eb);
    assert.ok(content.extendedTextMessage.text.includes(options.destination));
    const wrapped = await generateWAMessageContent(
      {
        text: renderGrowthRemix({ ...options, styleIndex: 0 }).text,
        linkPreview: null,
        groupStatus: true,
      },
      { font: font.id, backgroundColor: "#2563EB" },
    );
    const encoded = proto.Message.encode(wrapped).finish(),
      decoded = proto.Message.decode(encoded);
    const native = decoded.groupStatusMessageV2.message.extendedTextMessage;
    assert.equal(native.font, font.id);
    assert.equal(native.backgroundArgb, 0xff2563eb);
    assert.equal(native.contextInfo.isGroupStatus, true);
    assert.ok(native.text.includes(options.destination));
  }
  await assert.rejects(
    generateWAMessageContent(
      { text: "SYNTHETIC", linkPreview: null },
      { font: 10 },
    ),
    /0 and 9/,
  );
});
test("durable allocations survive reopening SQLite without reshuffling or duplicating image snapshots", async () => {
  const folder = mkdtempSync(path.join(tmpdir(), "pappy-remix-")),
    file = path.join(folder, "fixture.sqlite");
  let db = fixture(file);
  try {
    const id = running(db);
    let engine = new GrowthCreativeEngine(db, { get: async () => preview });
    const g = await engine.gallery("buyer", id),
      p = engine.allocate(id, "120363000000000001@g.us", g.assetId);
    db.close();
    db = openDatabase(file);
    engine = new GrowthCreativeEngine(db, {
      get: async () => {
        throw Error("No fetch on retry");
      },
    });
    const again = engine.allocate(id, "120363000000000001@g.us", g.assetId);
    assert.equal(again.id, p.id);
    assert.deepEqual(again.creative, p.creative);
    assert.equal(
      (db.prepare("SELECT COUNT(*) n FROM growth_creative_assets").get() as any)
        .n,
      1,
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
test("complete destination preview is coalesced/cached across owners while remix text is generated per group without per-group fetches", async () => {
  const db = fixture();
  let cache: PreviewEngine | undefined;
  try {
    const o = draft(db);
    db.prepare(
      "INSERT INTO growth_orders(id,user_id,input_json,verification_code,created_at,updated_at) VALUES('other-order','other',?,'TEST',?,?)",
    ).run(
      JSON.stringify(input()),
      new Date().toISOString(),
      new Date().toISOString(),
    );
    let calls = 0;
    cache = new PreviewEngine({
      db,
      fetcher: async () => {
        calls++;
        await new Promise((r) => setTimeout(r, 5));
        return preview;
      },
    });
    const engine = new GrowthCreativeEngine(db, cache);
    await Promise.all([
      engine.gallery("buyer", o.id),
      engine.gallery("other", "other-order"),
    ]);
    assert.equal(calls, 1);
    await engine.gallery("buyer", o.id);
    assert.equal(calls, 1);
  } finally {
    cache?.close();
    db.close();
  }
});

test("a complete metadata snapshot is reused on remix requests and hard storage bounds prevent unbounded image snapshots", async () => {
  const db = fixture();
  try {
    const o = draft(db);
    let calls = 0;
    const engine = new GrowthCreativeEngine(db, {
      get: async () => ({ ...preview, title: "SYNTHETIC snapshot " + ++calls }),
    });
    for (let revision = 1; revision <= 8; revision++) {
      db.prepare("UPDATE growth_orders SET revision=? WHERE id=?").run(
        revision,
        o.id,
      );
      await engine.gallery("buyer", o.id);
      await engine.gallery("buyer", o.id);
    }
    assert.equal(calls, 8);
    assert.equal(
      (db.prepare("SELECT COUNT(*) n FROM growth_creative_assets").get() as any)
        .n,
      8,
    );
    db.prepare("UPDATE growth_orders SET revision=9 WHERE id=?").run(o.id);
    await assert.rejects(engine.gallery("buyer", o.id), /eight-snapshot/);
  } finally {
    db.close();
  }
});
test("finite catalogue exhaustion pauses cleanly instead of silently recycling another group’s design", async () => {
  const db = fixture();
  try {
    const id = running(db),
      engine = new GrowthCreativeEngine(db, { get: async () => preview }),
      g = await engine.gallery("buyer", id);
    engine.allocate(id, "120363000000000001@g.us", g.assetId);
    db.prepare(
      "UPDATE growth_creative_sequences SET next_ordinal=? WHERE order_id=?",
    ).run(GROWTH_REMIX_CAPACITY, id);
    assert.throws(
      () => engine.allocate(id, "120363000000000002@g.us", g.assetId),
      /No fresh readable remix/,
    );
    assert.equal(
      (
        db
          .prepare("SELECT COUNT(*) n FROM growth_creative_placements")
          .get() as any
      ).n,
      1,
    );
  } finally {
    db.close();
  }
});
test("independent concurrent processes allocate the same group only once and keep different groups distinct", async () => {
  const { spawn } = await import("node:child_process");
  const folder = mkdtempSync(path.join(tmpdir(), "pappy-remix-race-")),
    file = path.join(folder, "fixture.sqlite");
  let db = fixture(file);
  try {
    const id = running(db),
      engine = new GrowthCreativeEngine(db, { get: async () => preview }),
      g = await engine.gallery("buyer", id);
    db.close();
    const at = Date.now() + 800;
    const run = (group: string) =>
      new Promise<any>((resolve, reject) => {
        const p = spawn(
          process.execPath,
          [
            "--import",
            "tsx",
            "tests/fixtures/growth-remix-race.ts",
            file,
            id,
            g.assetId,
            group,
            String(at),
          ],
          { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
        );
        let out = "",
          err = "";
        p.stdout.on("data", (b) => (out += b));
        p.stderr.on("data", (b) => (err += b));
        p.once("error", reject);
        p.once("exit", (code) => {
          if (code) reject(Error(err || out));
          else
            try {
              resolve(JSON.parse(out));
            } catch {
              reject(Error(out + err));
            }
        });
      });
    const [a, b, c] = await Promise.all([
      run("120363000000000001@g.us"),
      run("120363000000000001@g.us"),
      run("120363000000000002@g.us"),
    ]);
    assert.equal(a.id, b.id);
    assert.notEqual(c.id, a.id);
    assert.notEqual(c.creative.text, a.creative.text);
    db = openDatabase(file);
    assert.equal(
      (
        db
          .prepare("SELECT COUNT(*) n FROM growth_creative_placements")
          .get() as any
      ).n,
      2,
    );
    assert.equal(
      (db.prepare("SELECT COUNT(*) n FROM ledger").get() as any).n,
      0,
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    try {
      db.close();
    } catch {}
    rmSync(folder, { recursive: true, force: true });
  }
});
