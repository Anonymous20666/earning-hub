import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  normalizePersonalImage,
  personalImagePreview,
} from "../backend/personalMedia";
test("high-quality image normalization retains 3000px detail and lossless PNG pixels, strips EXIF and never upscales", async () => {
  const source = await sharp({
    create: { width: 3000, height: 1500, channels: 3, background: "#397947" },
  })
    .png()
    .withMetadata({ exif: { IFD0: { Artist: "SYNTHETIC-private" } } })
    .toBuffer();
  const result = await normalizePersonalImage(source);
  assert.equal(result.width, 3000);
  assert.equal(result.height, 1500);
  assert.equal(result.mime, "image/png");
  const meta = await sharp(result.bytes).metadata();
  assert.equal(meta.exif, undefined);
  assert.equal(meta.icc, undefined);
  assert.deepEqual(
    await sharp(source).removeAlpha().raw().toBuffer(),
    await sharp(result.bytes).removeAlpha().raw().toBuffer(),
  );
  const small = await normalizePersonalImage(
    await sharp({
      create: { width: 120, height: 80, channels: 3, background: "#333" },
    })
      .jpeg()
      .toBuffer(),
  );
  assert.equal(small.width, 120);
  assert.equal(small.height, 80);
});
test("photo normalization uses full 4:4:4 chroma, preserves orientation and bounds larger dimensions without inventing detail", async () => {
  const source = await sharp({
    create: { width: 5000, height: 2000, channels: 3, background: "#397947" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const result = await normalizePersonalImage(source);
  assert.equal(result.width, 1638);
  assert.equal(result.height, 4096);
  const meta = await sharp(result.bytes).metadata();
  assert.equal(meta.chromaSubsampling, "4:4:4");
  assert.equal(meta.orientation, undefined);
  assert.ok(result.bytes.length <= 8 * 1024 * 1024);
});
test("preview is 320px with correct aspect ratio and bounded bytes, while full-size bytes remain separate", async () => {
  const source = await sharp({
    create: { width: 2048, height: 1024, channels: 3, background: "#4f6f32" },
  })
    .png()
    .toBuffer();
  const preview = await personalImagePreview(source);
  assert.equal(preview.width, 2048);
  assert.equal(preview.height, 1024);
  const thumb = await sharp(preview.jpegThumbnail).metadata();
  assert.equal(thumb.width, 320);
  assert.equal(thumb.height, 160);
  assert.ok(preview.jpegThumbnail.length <= 32768);
  assert.ok(!source.equals(preview.jpegThumbnail));
});
test("invalid, SVG and decompression-bomb images are still refused", async () => {
  for (const bytes of [
    Buffer.from("not an image"),
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>',
    ),
    await sharp({
      create: { width: 4100, height: 4100, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer(),
  ])
    await assert.rejects(() => normalizePersonalImage(bytes));
});
