import sharp from "sharp";
// The byte cache makes large libvips intermediate caches unnecessary on the existing 512 MiB server.
sharp.cache({ memory: 8, files: 0, items: 16 });
sharp.concurrency(1);
export async function normalizeImage(input) {
  const bytes = Buffer.from(input),
    magic = bytes.subarray(0, 12);
  if (
    bytes.length > 2097152 ||
    !(
      magic.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
      magic
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      ["GIF87a", "GIF89a"].includes(magic.subarray(0, 6).toString()) ||
      (magic.subarray(0, 4).toString() === "RIFF" &&
        magic.subarray(8, 12).toString() === "WEBP")
    )
  )
    throw Error("Unsupported thumbnail bytes");
  const image = sharp(bytes, {
      limitInputPixels: 16000000,
      sequentialRead: true,
    }),
    info = await image.metadata();
  if (!["jpeg", "png", "webp", "gif"].includes(info.format || ""))
    throw Error("Unsupported thumbnail");
  if ((info.width || 0) < 48 || (info.height || 0) < 48)
    throw Error("Website image is too small for a useful preview");
  const upscale = Math.max(info.width || 0, info.height || 0) < 600;
  let { data, info: out } = await image
    .rotate()
    .resize({
      width: upscale ? 640 : 1000,
      height: upscale ? 640 : 1000,
      fit: "inside",
      withoutEnlargement: !upscale,
    })
    .jpeg({ quality: 85, chromaSubsampling: "4:4:4" })
    .toBuffer({ resolveWithObject: true });
  if (data.length > 350000) {
    const compact = await sharp(data)
      .resize({
        width: 640,
        height: 640,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 75 })
      .toBuffer({ resolveWithObject: true });
    data = compact.data;
    out = compact.info;
  }
  if (data.length > 350000) throw Error("Thumbnail too large");
  let inline = await sharp(data)
    .resize({
      width: 320,
      height: 320,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 80 })
    .toBuffer();
  if (inline.length > 32768)
    inline = await sharp(data)
      .resize({
        width: 200,
        height: 200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 65 })
      .toBuffer();
  if (inline.length > 32768) throw Error("Inline thumbnail too large");
  return {
    inlineThumbnailBase64: inline.toString("base64"),
    thumbnailBase64: data.toString("base64"),
    thumbnailWidth: out.width,
    thumbnailHeight: out.height,
  };
}
