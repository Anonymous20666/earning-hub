import sharp from "sharp";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// Decode/re-encode to strip private metadata and validate bytes. Preserve line-art
// losslessly where practical; don't upscale, fabricate detail or oversharpen.
export async function normalizePersonalImage(buffer: Buffer) {
  const options = { limitInputPixels: 16000000, sequentialRead: true };
  const metadata = await sharp(buffer, options).metadata();
  if (
    !["jpeg", "png", "webp"].includes(metadata.format || "") ||
    (metadata.pages || 1) > 1
  )
    throw Error("Unsupported image");
  const pipeline = (size = 4096) =>
    sharp(buffer, options)
      .rotate()
      .resize({
        width: size,
        height: size,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toColourspace("srgb");
  let mime = "image/jpeg";
  let bytes: Buffer;
  if (metadata.format === "png" || metadata.format === "webp") {
    bytes = await pipeline().png({ compressionLevel: 6 }).toBuffer();
    mime = "image/png";
  } else
    bytes = await pipeline()
      .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
      .toBuffer();
  if (bytes.length > MAX_IMAGE_BYTES) {
    bytes = await pipeline()
      .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
      .toBuffer();
    mime = "image/jpeg";
  }
  if (bytes.length > MAX_IMAGE_BYTES)
    bytes = await pipeline(3072)
      .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
      .toBuffer();
  if (bytes.length > MAX_IMAGE_BYTES)
    throw Error("Processed image exceeds 8 MiB; use a smaller image");
  const result = await sharp(bytes, options).metadata();
  return { bytes, mime, width: result.width!, height: result.height! };
}
export async function personalImagePreview(buffer: Buffer) {
  const options = { limitInputPixels: 16000000, sequentialRead: true };
  const { width, height } = await sharp(buffer, options).metadata();
  let thumbnail = await sharp(buffer, options)
    .resize({
      width: 320,
      height: 320,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#fff" })
    .jpeg({ quality: 85, chromaSubsampling: "4:4:4" })
    .toBuffer();
  if (thumbnail.length > 32768)
    thumbnail = await sharp(buffer, options)
      .resize({
        width: 200,
        height: 200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#fff" })
      .jpeg({ quality: 75 })
      .toBuffer();
  if (thumbnail.length > 32768)
    throw Error("Could not prepare a bounded image preview");
  return { width, height, jpegThumbnail: thumbnail };
}
