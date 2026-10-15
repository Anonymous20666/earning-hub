import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { openDatabase } from "../backend/database";
import { PreviewEngine, completePreview } from "../backend/previewEngine";
import { PreviewImagePool } from "../backend/previewPool";
import { PreviewUploadCache } from "../backend/previewUploadCache";
import { extractPreviewMetadata } from "../backend/previewMetadata";
import type { SafePreview } from "../backend/safePreview";
const jpeg = await sharp({
  create: { width: 640, height: 320, channels: 3, background: "#173e2b" },
})
  .jpeg()
  .toBuffer();
const full = (url: string): SafePreview => ({
  "matched-text": url,
  title: "SYNTHETIC title",
  description: "SYNTHETIC description",
  previewType: 5,
  thumbnailBase64: jpeg.toString("base64"),
  inlineThumbnailBase64: jpeg.toString("base64"),
  thumbnailWidth: 640,
  thumbnailHeight: 320,
});
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
test("1000 simultaneous same-link preparations coalesce into one full fetch; cache results are defensive copies", async () => {
  let fetched = 0;
  const engine = new PreviewEngine({
    fetcher: async (url) => {
      fetched++;
      await tick();
      return full(url);
    },
  });
  const results = await Promise.all(
    Array.from({ length: 1000 }, (_, i) =>
      engine.get(`https://example.com/page#${i}`),
    ),
  );
  assert.equal(fetched, 1);
  assert.equal(engine.metrics.joined, 999);
  assert.equal(engine.metrics.peakActive, 1);
  results[0].title = "changed";
  const again = await engine.get("https://example.com/page#another");
  assert.equal(again.title, "SYNTHETIC title");
  assert.equal(again["matched-text"], "https://example.com/page#another");
  assert.equal(fetched, 1);
  engine.close();
});
test("1000 distinct-link load has bounded active work, explicit backpressure, and no unbounded queue", async () => {
  let active = 0,
    peak = 0;
  const engine = new PreviewEngine({
    maxActive: 4,
    maxQueued: 8,
    fetcher: async (url) => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      active--;
      return full(url);
    },
  });
  const results = await Promise.allSettled(
    Array.from({ length: 1000 }, (_, i) =>
      engine.get(`https://example.com/${i}`),
    ),
  );
  assert.equal(peak, 4);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 12);
  assert.equal(results.filter((r) => r.status === "rejected").length, 988);
  assert.equal(engine.metrics.busy, 988);
  engine.close();
});
test("failed, text-only, missing-description and incomplete-image results never become positive cache entries", async () => {
  for (const mode of [
    "failed",
    "text",
    "description",
    "inline",
    "dimensions",
  ]) {
    let calls = 0;
    const engine = new PreviewEngine({
      fetcher: async (url) => {
        calls++;
        if (mode === "failed") throw Error("SYNTHETIC external failure");
        const p = full(url);
        if (mode === "text") {
          delete p.thumbnailBase64;
          p.previewType = 0;
        }
        if (mode === "description") p.description = "";
        if (mode === "inline") delete p.inlineThumbnailBase64;
        if (mode === "dimensions") p.thumbnailWidth = 0;
        return p;
      },
    });
    for (let i = 0; i < 2; i++) {
      try {
        await engine.get("https://example.com/retry");
      } catch (e) {
        assert.equal(mode, "failed");
      }
    }
    assert.equal(calls, 2, mode);
    assert.equal(engine.metrics.stored, 0, mode);
    engine.close();
  }
});
test("signed query ordering is not merged; exact matched text is restored; TTL and bounded LRU force a fresh preparation", async () => {
  let now = 1000,
    calls = 0;
  const engine = new PreviewEngine({
    now: () => now,
    ttlMs: 100,
    memoryBytes:
      Buffer.byteLength(JSON.stringify(full("https://example.com/a?x=1&y=2"))) +
      100,
    fetcher: async (url) => {
      calls++;
      return full(url);
    },
  });
  await engine.get("https://example.com/a?x=1&y=2");
  await engine.get("https://example.com/a?y=2&x=1");
  assert.equal(calls, 2);
  await engine.get("https://example.com/a?x=1&y=2");
  assert.equal(calls, 3);
  now += 101;
  await engine.get("https://example.com/a?x=1&y=2");
  assert.equal(calls, 4);
  engine.close();
  await assert.rejects(() => engine.get("https://example.com"), /closed/);
});
test("complete normalized thumbnails survive engine restart privately in SQLite; partial/corrupt entries are not reused", async () => {
  const db = openDatabase(":memory:");
  let calls = 0;
  const fetcher = async (url: string) => {
    calls++;
    return full(url);
  };
  let engine = new PreviewEngine({ db, fetcher });
  try {
    await engine.get("https://example.com/durable");
    engine.close();
    engine = new PreviewEngine({ db, fetcher });
    await engine.get("https://example.com/durable#new");
    assert.equal(calls, 1);
    assert.equal(engine.metrics.hits, 1);
    engine.close();
    db.prepare("UPDATE link_preview_cache SET payload_json='{}'").run();
    engine = new PreviewEngine({ db, fetcher });
    await engine.get("https://example.com/durable");
    assert.equal(calls, 2);
    assert.equal(
      (db.prepare("SELECT COUNT(*) n FROM link_preview_cache").get() as any).n,
      1,
    );
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally {
    engine.close();
    db.close();
  }
});
test("durable cache obeys its byte budget and does not store raw pages or remote image addresses", async () => {
  const db = openDatabase(":memory:");
  const engine = new PreviewEngine({
    db,
    diskBytes: 12000,
    fetcher: async (url) => full(url),
  });
  try {
    for (let i = 0; i < 20; i++)
      await engine.get(`https://example.com/bounded/${i}`);
    const row = db
      .prepare("SELECT COALESCE(SUM(bytes),0) bytes FROM link_preview_cache")
      .get() as any;
    assert.ok(row.bytes <= 12000);
    const payloads = db
      .prepare("SELECT payload_json FROM link_preview_cache")
      .all() as any[];
    for (const row of payloads) {
      assert.equal(completePreview(JSON.parse(row.payload_json)), true);
      assert.equal(row.payload_json.includes("og:image"), false);
    }
  } finally {
    engine.close();
    db.close();
  }
});
test("two real worker threads normalize in parallel, cap thumbnails, reject invalid bytes and close cleanly", async () => {
  const pool = new PreviewImagePool();
  try {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => pool.run(jpeg)),
    );
    assert.equal(pool.threads.size, 2);
    for (const p of results) {
      assert.ok(Buffer.from(p.inlineThumbnailBase64, "base64").length <= 32768);
      assert.ok(Buffer.from(p.thumbnailBase64, "base64").length <= 350000);
      assert.equal(p.thumbnailWidth, 640);
    }
    await assert.rejects(() => pool.run(Buffer.from("<svg/>")), /Unsupported/);
    await assert.rejects(() => pool.run(Buffer.alloc(2097153)), /2 MiB/);
  } finally {
    await pool.close();
  }
  await assert.rejects(() => pool.run(jpeg), /closed/);
});
test("worker overload rejects extra work and shutdown settles pending promises", async () => {
  const pool = new PreviewImagePool(1, 1);
  const results = [pool.run(jpeg), pool.run(jpeg), pool.run(jpeg)].map((p) =>
    p.then(
      () => true,
      () => false,
    ),
  );
  await pool.close();
  assert.deepEqual(await Promise.all(results), [false, false, false]);
});
const native = () => ({
  directPath: "/SYNTHETIC",
  mediaKey: Buffer.alloc(32),
  fileSha256: Buffer.alloc(32),
  fileEncSha256: Buffer.alloc(32),
});
test("1000 concurrent native-thumbnail consumers share one upload but not across sockets; failures use separate short cooldown", async () => {
  let now = 1000,
    calls = 0;
  const cache = new PreviewUploadCache(() => now),
    socket = {};
  const upload = async () => {
    calls++;
    await tick();
    return native();
  };
  const all = await Promise.all(
    Array.from({ length: 1000 }, () => cache.get(socket, "same", upload)),
  );
  assert.equal(calls, 1);
  assert.ok(all.every((i) => i.directPath === "/SYNTHETIC"));
  await cache.get({}, "same", upload);
  assert.equal(calls, 2);
  const fail = async () => {
    calls++;
    return { directPath: "/partial" };
  };
  assert.equal(await cache.get(socket, "bad", fail), undefined);
  assert.equal(await cache.get(socket, "bad", fail), undefined);
  assert.equal(calls, 3);
  now += 30001;
  assert.ok(await cache.get(socket, "bad", upload));
  assert.equal(calls, 4);
  cache.clear();
  await cache.get(socket, "same", upload);
  assert.equal(calls, 5);
});
test("native upload LRU does not flush unrelated complete uploads, and expiry causes fresh upload", async () => {
  let now = 1000,
    calls = 0;
  const cache = new PreviewUploadCache(() => now, 100),
    socket = {};
  const upload = async () => {
    calls++;
    return native();
  };
  for (let i = 0; i < 30; i++) await cache.get(socket, String(i), upload);
  await cache.get(socket, "0", upload);
  await cache.get(socket, "30", upload);
  await cache.get(socket, "0", upload);
  assert.equal(calls, 31);
  await cache.get(socket, "1", upload);
  assert.equal(calls, 32);
  now += 101;
  await cache.get(socket, "0", upload);
  assert.equal(calls, 33);
});
test("metadata understands unquoted/reordered OG, Twitter, itemprop, image_src, safe JSON-LD and bounded entities", () => {
  const p = extractPreviewMetadata(
    `<title>Fallback</title><meta content='A &amp; B' property=og:title><meta name=twitter:description content='Channel &#x2022; 2 followers'><meta content=/og.jpg property=og:image><meta name=twitter:image content='/twitter.jpg'><meta itemprop=image content='/item.jpg'><link href='/link.jpg' rel=image_src><script type='application/ld+json'>{"@graph":[{"name":"JSON","image":{"url":"/json.jpg"}}]}</script>`,
  );
  assert.equal(p.title, "A & B");
  assert.equal(p.description, "Channel • 2 followers");
  assert.deepEqual(p.images, [
    "/og.jpg",
    "/twitter.jpg",
    "/item.jpg",
    "/link.jpg",
    "/json.jpg",
  ]);
  const json = extractPreviewMetadata(
    `<script type="application/ld+json">{"headline":"JSON fallback","description":"A description","image":"https://example.com/image"}</script>`,
  );
  assert.equal(json.title, "JSON fallback");
  assert.equal(json.description, "A description");
  assert.equal(
    extractPreviewMetadata('<meta property=og:title content="&#x110000; Safe">')
      .title,
    "Safe",
  );
  assert.equal(
    extractPreviewMetadata(
      Array.from(
        { length: 100 },
        (_, i) => `<meta property=og:image content='/i${i}'>`,
      ).join(""),
    ).images.length,
    8,
  );
});
test("website metadata has a real local 1200×630 social card and truthful applicable metadata without fake handles or indexing", async () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const field of [
    "og:url",
    "og:site_name",
    "og:image:width",
    "og:image:height",
    "og:image:alt",
    "twitter:title",
    "twitter:description",
    "twitter:image",
    "twitter:image:alt",
  ])
    assert.ok(html.includes(`="${field}"`), field);
  assert.match(html, /noindex,nofollow/);
  assert.ok(!html.includes("twitter:creator"));
  assert.match(html, /Paid jobs and cashout are not open yet/);
  const info = await sharp(
    readFileSync(new URL("../public/social-card-v1.png", import.meta.url)),
  ).metadata();
  assert.equal(info.width, 1200);
  assert.equal(info.height, 630);
  assert.equal(info.format, "png");
  const scripts = [
    ...html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    ),
  ];
  assert.equal(scripts.length, 1);
  assert.equal(JSON.parse(scripts[0][1])["@graph"].length, 2);
});
test("worker timeout/crash rejects safely and a replacement worker can process the next job", async () => {
  const timed = new PreviewImagePool(1, 1, 1);
  try {
    await assert.rejects(() => timed.run(jpeg), /timed out/);
  } finally {
    await timed.close();
  }
  const pool = new PreviewImagePool(1);
  try {
    const pending = pool.run(jpeg);
    void (pool as any).slots[0].worker.terminate();
    await assert.rejects(() => pending, /restarted/);
    assert.ok((await pool.run(jpeg)).thumbnailBase64);
  } finally {
    await pool.close();
  }
});
test("metadata scanning ignores script/comment fake tags and bounds malformed HTML instead of rescanning unclosed scripts", () => {
  const start = performance.now();
  const p = extractPreviewMetadata(
    `<!-- <meta property=og:title content=Fake> --><script>const fake='<meta property=og:title content=Fake>';</script><meta property=og:title content="A > B"><meta name=description content="Real"><script>` +
      "<script>".repeat(130000),
  );
  assert.equal(p.title, "A > B");
  assert.equal(p.description, "Real");
  assert.ok(performance.now() - start < 1000);
  assert.equal(extractPreviewMetadata("<meta x='".repeat(120000)).title, "");
  const signed = extractPreviewMetadata(
    '<meta property=og:image content="https://example.com/img?a=1&amp;b=&amp;amp;">',
  );
  assert.equal(signed.images[0], "https://example.com/img?a=1&b=&amp;");
});
test("health endpoint stays responsive in the same process during bounded worker preview load, including 1000 same-link callers", async () => {
  const { createApp } = await import("../backend/app");
  const db = openDatabase(":memory:"),
    pool = new PreviewImagePool();
  let fetched = 0;
  const engine = new PreviewEngine({
    fetcher: async (url) => {
      fetched++;
      return { ...full(url), ...(await pool.run(jpeg)) };
    },
  });
  const app = createApp(db, {
    personalPreviewer: (url) => engine.get(url),
    rateMax: 10000,
    secureCookies: false,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address() as any;
  let maximum = 0;
  try {
    const pending = Promise.all([
      ...Array.from({ length: 1000 }, () =>
        engine.get("https://example.com/shared-health-load"),
      ),
      ...Array.from({ length: 32 }, (_, i) =>
        engine.get(`https://example.com/load-${i}`),
      ),
    ]);
    for (let i = 0; i < 40; i++) {
      const start = performance.now(),
        response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
      assert.equal(response.status, 200);
      assert.equal(((await response.json()) as any).status, "ok");
      maximum = Math.max(maximum, performance.now() - start);
    }
    await pending;
    assert.equal(fetched, 33);
    assert.equal(pool.threads.size, 2);
    assert.ok(maximum < 1000, `Synthetic health max ${maximum.toFixed(1)}ms`);
    console.log(
      JSON.stringify({
        syntheticHealthLoad: true,
        callers: 1032,
        preparations: fetched,
        healthChecks: 40,
        maximumHealthMs: Number(maximum.toFixed(1)),
        peakPreviewJobs: engine.metrics.peakActive,
        threads: [...pool.threads],
      }),
    );
  } finally {
    engine.close();
    await pool.close();
    await new Promise<void>((r) => server.close(() => r()));
    db.close();
  }
});
