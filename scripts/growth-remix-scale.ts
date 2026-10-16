// Synthetic local benchmark, not real sends or a production throughput/SLA claim.
import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { setImmediate as yieldLoop } from "node:timers/promises";
import sharp from "sharp";
import { fixture, running } from "../tests/growth-fixtures";
import { GrowthCreativeEngine } from "../backend/growthCreative";
const db = fixture();
let calls = 0;
try {
  const image = await sharp("public/social-card-v1.png")
    .resize(960, 504)
    .jpeg({ quality: 80 })
    .toBuffer();
  const engine = new GrowthCreativeEngine(db, {
    get: async (url) => {
      calls++;
      return {
        "matched-text": url,
        title: "SYNTHETIC Scale Community",
        description:
          "SYNTHETIC benchmark fixture, not live destination metadata.",
        previewType: 5,
        thumbnailBase64: image.toString("base64"),
        inlineThumbnailBase64: image.toString("base64"),
        thumbnailWidth: 960,
        thumbnailHeight: 504,
      };
    },
  });
  const id = running(db),
    g = await engine.gallery("buyer", id),
    texts = new Set<string>();
  let maxDelay = 0,
    last = performance.now();
  const timer = setInterval(() => {
    const t = performance.now();
    maxDelay = Math.max(maxDelay, t - last - 5);
    last = t;
  }, 5);
  const start = performance.now();
  for (let i = 0; i < 10000; i++) {
    const p = engine.allocate(
      id,
      `${120363000000100000n + BigInt(i)}@g.us`,
      g.assetId,
    );
    texts.add(p.creative.text);
    if (i % 25 === 24) await yieldLoop();
  }
  const duration = performance.now() - start;
  clearInterval(timer);
  const cjk = running(db),
    other = new GrowthCreativeEngine(db, {
      get: async (url) => ({
        "matched-text": url,
        title: "你好 مرحبا",
        description: "",
      }),
    }),
    cg = await other.gallery("buyer", cjk),
    nonLatin = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    nonLatin.add(
      other.allocate(cjk, `${120363000000200000n + BigInt(i)}@g.us`, cg.assetId)
        .creative.text,
    );
    if (i % 25 === 24) await yieldLoop();
  }
  if (texts.size !== 10000 || nonLatin.size !== 1000 || calls !== 1)
    throw Error("Scale invariants failed");
  const report = {
    syntheticOnly: true,
    liveSends: 0,
    livePayments: 0,
    latinGroups: 10000,
    uniqueLatinTexts: texts.size,
    nonLatinGroups: 1000,
    uniqueNonLatinTexts: nonLatin.size,
    providerFetchesForLatinOrder: calls,
    latinAllocationMs: Math.round(duration),
    maxSampledEventLoopDelayMs: Math.round(maxDelay * 10) / 10,
    peakRssMiB: Math.round((process.resourceUsage().maxRSS / 1024) * 10) / 10,
    imageBytes: image.length,
    storedAssetRows: (
      db.prepare("SELECT COUNT(*) n FROM growth_creative_assets").get() as any
    ).n,
    storedPlacementRows: (
      db
        .prepare("SELECT COUNT(*) n FROM growth_creative_placements")
        .get() as any
    ).n,
    foreignKeyErrors: db.prepare("PRAGMA foreign_key_check").all(),
    note: "One local Node process; yielded every 25 allocations. No WhatsApp socket, image-generation API, provider send, delivery proof or 1000-user SLA is tested.",
  };
  mkdirSync("docs/testing", { recursive: true });
  writeFileSync(
    "docs/testing/growth-remix-scale.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  db.close();
}
