import test from "node:test";
import assert from "node:assert/strict";
import https from "node:https";
import { gzipSync, brotliCompressSync, deflateSync } from "node:zlib";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import sharp from "sharp";
import {
  safePreview,
  fetchPublicResource,
  normalizePreviewImage,
} from "../backend/safePreview";
// A synthetic public-IP origin bypasses DNS, but HTTPS itself is intercepted.
// These tests cannot reach WhatsApp, the public Internet or any private destination.
const origin = "https://93.184.216.34";
async function mockOrigin(
  routes: Record<
    string,
    {
      status?: number;
      type?: string;
      encoding?: string;
      location?: string;
      body: Buffer | string;
    }
  >,
  fn: (paths: string[]) => Promise<void>,
) {
  const paths: string[] = [],
    original = https.get;
  https.get = ((url: URL, opts: any, callback: any) => {
    paths.push(url.href);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "93.184.216.34");
    assert.equal(typeof opts.lookup, "function");
    opts.lookup(url.hostname, { all: true }, (err: any, pins: any[]) => {
      assert.equal(err, null);
      assert.equal(pins[0].address, "93.184.216.34");
    });
    const req: any = new EventEmitter();
    let res: any;
    req.destroy = (e?: Error) => {
      if (e) req.emit("error", e);
      res?.destroy();
      req.emit("close");
      return req;
    };
    queueMicrotask(() => {
      const route = routes[url.pathname];
      assert.ok(route, `Unexpected network path ${url.pathname}`);
      res = Readable.from([
        Buffer.isBuffer(route.body) ? route.body : Buffer.from(route.body),
      ]);
      res.statusCode = route.status || 200;
      res.headers = {
        "content-type": route.type ?? "text/html",
        "content-encoding": route.encoding,
        location: route.location,
      };
      res.once("close", () => req.emit("close"));
      callback(res);
    });
    return req;
  }) as any;
  try {
    await fn(paths);
  } finally {
    https.get = original;
  }
}
test("safe fetch follows only validated public redirects, reads real OG images and returns native-image metadata", async () => {
  const real = await sharp({
    create: { width: 960, height: 480, channels: 3, background: "#183c32" },
  })
    .png()
    .toBuffer();
  await mockOrigin(
    {
      "/page": {
        body: '<title>Real title</title><meta property="og:description" content="Real description"><meta property="og:image" content="/poster">',
      },
      "/poster": { status: 302, location: "/real.png", body: "" },
      "/real.png": { type: "image/png", body: real },
    },
    async (paths) => {
      const p = await safePreview(origin + "/page");
      assert.equal(p.title, "Real title");
      assert.equal(p.description, "Real description");
      assert.equal(p["matched-text"], origin + "/page");
      assert.equal(p.previewType, 5);
      assert.equal(p.thumbnailWidth, 960);
      assert.equal(p.thumbnailHeight, 480);
      assert.equal(
        (await sharp(Buffer.from(p.thumbnailBase64!, "base64")).metadata())
          .format,
        "jpeg",
      );
      assert.deepEqual(paths, [
        origin + "/page",
        origin + "/poster",
        origin + "/real.png",
      ]);
    },
  );
});
test("an OG image pointing at metadata/private IPs is rejected before any request; text title remains usable", async () => {
  await mockOrigin(
    {
      "/page": {
        body: '<title>Safe title</title><meta property="og:image" content="https://169.254.169.254/latest/meta-data">',
      },
    },
    async (paths) => {
      const p = await safePreview(origin + "/page");
      assert.equal(p.title, "Safe title");
      assert.equal(p.previewType, 0);
      assert.equal(p.thumbnailBase64, undefined);
      assert.equal(paths.length, 1);
    },
  );
});
test("redirects to private HTTPS destinations are never followed", async () => {
  await mockOrigin(
    {
      "/page": {
        status: 302,
        location: "https://127.0.0.1/internal",
        body: "",
      },
    },
    async (paths) => {
      await assert.rejects(
        () => fetchPublicResource(origin + "/page", "html"),
        /Private and reserved/,
      );
      assert.equal(paths.length, 1);
    },
  );
});
test("mislabelled SVG and oversized images do not create invented thumbnails", async () => {
  for (const [path, body] of [
    [
      "/svg",
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="file:///etc/passwd"/></svg>',
      ),
    ],
    ["/huge", Buffer.alloc(2097153)],
  ] as const)
    await mockOrigin(
      {
        "/page": {
          body: `<title>Keep the title</title><meta property="og:image" content="${path}">`,
        },
        [path]: { type: "image/jpeg", body },
      },
      async () => {
        const p = await safePreview(origin + "/page");
        assert.equal(p.previewType, 0);
        assert.equal(p.thumbnailBase64, undefined);
        assert.equal(p.title, "Keep the title");
      },
    );
});
test("large HTML is bounded at 256 KiB of head data, redirect loops and expired budgets fail closed", async () => {
  await mockOrigin(
    {
      "/page": { body: "<title>Head title</title>" + "x".repeat(300000) },
      "/loop": { status: 302, location: "/loop", body: "" },
    },
    async (paths) => {
      const p = await safePreview(origin + "/page");
      assert.equal(p.title, "Head title");
      await assert.rejects(
        () => fetchPublicResource(origin + "/loop", "html"),
        /Too many redirects/,
      );
      assert.equal(paths.filter((p) => p.endsWith("/loop")).length, 4);
      const before = paths.length;
      await assert.rejects(
        () => fetchPublicResource(origin + "/page", "html", Date.now() - 1),
        /timed out/,
      );
      assert.equal(paths.length, before);
    },
  );
});
test("small useful real images are proportionally enlarged for native cards, but tracking pixels are not thumbnails", async () => {
  const small = await sharp({
      create: { width: 120, height: 60, channels: 3, background: "#345632" },
    })
      .png()
      .toBuffer(),
    p = await normalizePreviewImage(small);
  assert.equal(p.thumbnailWidth, 640);
  assert.equal(p.thumbnailHeight, 320);
  const pixel = await sharp({
    create: { width: 1, height: 1, channels: 3, background: "#345632" },
  })
    .png()
    .toBuffer();
  await assert.rejects(() => normalizePreviewImage(pixel), /too small/);
});

test("missing/generic MIME is accepted only with real validated image bytes; alternate images survive unsupported, private and tiny candidates", async () => {
  const bytes = await sharp({
    create: { width: 640, height: 320, channels: 3, background: "#173e2b" },
  })
    .png()
    .toBuffer();
  await mockOrigin(
    {
      "/page": {
        body: '<meta property=og:title content="Him"><meta property=og:description content="Channel • 2 followers"><meta property=og:image content="https://127.0.0.1/private"><meta property=og:image content="/bad"><meta property=og:image content="/missing-mime">',
      },
      "/bad": {
        type: "application/octet-stream",
        body: "<html>not an image</html>",
      },
      "/missing-mime": { type: "", body: bytes },
      "/generic": { type: "application/octet-stream", body: bytes },
      "/svg": { type: "image/svg+xml", body: "<svg/>" },
    },
    async (paths) => {
      const p = await safePreview(origin + "/page");
      assert.equal(p.title, "Him");
      assert.equal(p.previewType, 5);
      assert.ok(p.thumbnailBase64);
      assert.equal(
        paths.some((p) => p.includes("127.0.0.1")),
        false,
      );
      assert.equal(paths.length, 3);
      const generic = await fetchPublicResource(origin + "/generic", "image");
      assert.deepEqual(generic.body, bytes);
      await assert.rejects(
        () => fetchPublicResource(origin + "/svg", "image"),
        /supported/,
      );
    },
  );
});
test("gzip, brotli and deflate HTML are decoded with a strict decoded-size cap; invalid compression fails", async () => {
  for (const [encoding, compress] of [
    ["gzip", gzipSync],
    ["br", brotliCompressSync],
    ["deflate", deflateSync],
  ] as const) {
    await mockOrigin(
      {
        "/page": {
          encoding,
          body: compress(
            Buffer.from(
              "<title>Compressed title</title>" + "x".repeat(1200000),
            ),
          ),
        },
        "/bad": { encoding, body: "not compressed" },
      },
      async () => {
        const resource = await fetchPublicResource(origin + "/page", "html");
        assert.equal(resource.body.length, 1048576);
        assert.equal(
          (await safePreview(origin + "/page")).title,
          "Compressed title",
        );
        await assert.rejects(() =>
          fetchPublicResource(origin + "/bad", "html"),
        );
      },
    );
  }
});
