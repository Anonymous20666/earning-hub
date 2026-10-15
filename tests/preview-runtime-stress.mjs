// Offline runtime/container check. No credentials, accounts, Internet or WhatsApp sends.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
const telemetry = (...paths) => {
  for (const file of paths) {
    try {
      return readFileSync(file, "utf8").trim();
    } catch {
      /* cgroup v1/v2 or restricted mounts */
    }
  }
  return "unavailable";
};
const source = (name) => pathToFileURL(resolve("backend", name)).href;
const { PreviewImagePool } = await import(source("previewPool.ts"));
const { normalizePersonalImage } = await import(source("personalMedia.ts"));
const { createApp } = await import(source("app.ts"));
const { openDatabase } = await import(source("database.ts"));
await import("plogme"); // Include the installed native library's resident cost, without opening any socket.
const bytes = await sharp({
  create: {
    width: 4000,
    height: 4000,
    channels: 4,
    background: { r: 38, g: 90, b: 62, alpha: 0.5 },
  },
})
  .png()
  .toBuffer();
const db = openDatabase(":memory:"),
  pool = new PreviewImagePool(),
  app = createApp(db, { rateMax: 10000, secureCookies: false });
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
let peak = process.memoryUsage().rss;
const monitor = setInterval(
  () => (peak = Math.max(peak, process.memoryUsage().rss)),
  10,
);
const start = performance.now();
try {
  const work = Promise.all([
    Promise.all(Array.from({ length: 16 }, () => pool.run(bytes))),
    normalizePersonalImage(bytes),
  ]);
  let maxHealth = 0;
  for (let i = 0; i < 40; i++) {
    const begin = performance.now(),
      response = await fetch(
        `http://127.0.0.1:${server.address().port}/api/health`,
      );
    assert.equal(response.status, 200);
    await response.json();
    maxHealth = Math.max(maxHealth, performance.now() - begin);
  }
  const [previews, media] = await work;
  assert.equal(previews.length, 16);
  assert.equal(pool.threads.size, 2);
  assert.ok(media.bytes.length <= 8388608);
  assert.ok(
    previews.every(
      (p) => Buffer.from(p.inlineThumbnailBase64, "base64").length <= 32768,
    ),
  );
  console.log(
    JSON.stringify({
      syntheticOfflineRuntime: true,
      decodedInputPixels: 16000000,
      previewJobs: 16,
      simultaneousFullImageJobs: 1,
      healthRequests: 40,
      maximumHealthMs: +maxHealth.toFixed(1),
      workerThreads: [...pool.threads],
      durationMs: +(performance.now() - start).toFixed(1),
      peakProcessRssMiB: +(peak / 1048576).toFixed(1),
      cgroupMemoryMax: telemetry(
        "/sys/fs/cgroup/memory.max",
        "/sys/fs/cgroup/memory/memory.limit_in_bytes",
      ),
      cgroupMemoryPeak: telemetry(
        "/sys/fs/cgroup/memory.peak",
        "/sys/fs/cgroup/memory/memory.max_usage_in_bytes",
      ),
      cpuMax: telemetry(
        "/sys/fs/cgroup/cpu.max",
        "/sys/fs/cgroup/cpu/cpu.cfs_quota_us",
      ),
      noNetwork: true,
      noMessages: true,
    }),
  );
} finally {
  clearInterval(monitor);
  await pool.close();
  app.locals.previewEngine?.close();
  await new Promise((r) => server.close(r));
  db.close();
}
