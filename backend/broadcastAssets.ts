import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { type Database, transaction } from "./database";
const exec = promisify(execFile);
let active = 0;
const owners = new Set<string>();
export async function saveBroadcastAsset(
  db: Database,
  folder: string,
  user: string,
  buffer: Buffer,
) {
  if (active >= 2 || owners.has(user))
    throw Error("Another media upload is being processed. Retry shortly");
  active++;
  owners.add(user);
  try {
    return await saveAsset(db, folder, user, buffer);
  } finally {
    active--;
    owners.delete(user);
  }
}
async function saveAsset(
  db: Database,
  folder: string,
  user: string,
  buffer: Buffer,
) {
  if (
    !Buffer.isBuffer(buffer) ||
    !buffer.length ||
    buffer.length > 8 * 1024 * 1024
  )
    throw Error("Upload a JPEG, PNG, WebP, GIF or MP4 file up to 8 MiB");
  const used = (
    db
      .prepare(
        "SELECT COALESCE(SUM(bytes),0) total FROM broadcast_assets WHERE user_id=?",
      )
      .get(user) as any
  ).total;
  if (used + buffer.length > 50 * 1024 * 1024)
    throw Error("Personal media storage limit reached (50 MiB)");
  fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
  const id = randomUUID(),
    file = path.join(folder, id);
  let mime = "image/jpeg",
    bytes: Buffer;
  const mp4 = buffer.length > 12 && buffer.subarray(4, 8).toString() === "ftyp";
  const gif = buffer
    .subarray(0, 6)
    .toString()
    .match(/^GIF8[79]a$/);
  if (mp4 || gif) {
    const input = file + ".source";
    fs.writeFileSync(input, buffer, { mode: 0o600, flag: "wx" });
    try {
      const { stdout } = await exec(
        "ffprobe",
        [
          "-v",
          "error",
          "-threads",
          "1",
          "-protocol_whitelist",
          "file,pipe",
          "-show_entries",
          "format=duration:stream=codec_type,codec_name,pix_fmt,width,height",
          "-of",
          "json",
          input,
        ],
        { timeout: 10000, maxBuffer: 32768 },
      );
      const info = JSON.parse(stdout);
      const video = info.streams?.find((s: any) => s.codec_type === "video");
      if (
        !video ||
        (!gif &&
          (video.codec_name !== "h264" ||
            video.pix_fmt !== "yuv420p" ||
            info.streams.some(
              (s: any) => s.codec_type === "audio" && s.codec_name !== "aac",
            ))) ||
        video.width > 1920 ||
        video.height > 1920 ||
        !Number.isFinite(Number(info.format?.duration)) ||
        Number(info.format.duration) <= 0 ||
        Number(info.format.duration) > 90
      )
        throw Error("Use video/GIF up to 90 seconds and 1920px");
      if (gif) {
        await exec(
          "ffmpeg",
          [
            "-v",
            "error",
            "-threads",
            "1",
            "-protocol_whitelist",
            "file,pipe",
            "-i",
            input,
            "-an",
            "-c:v",
            "libx264",
            "-threads",
            "1",
            "-filter_threads",
            "1",
            "-pix_fmt",
            "yuv420p",
            "-vf",
            "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-movflags",
            "+faststart",
            "-f",
            "mp4",
            file,
          ],
          { timeout: 20000, maxBuffer: 32768 },
        );
        bytes = fs.readFileSync(file);
        if (bytes.length > 8 * 1024 * 1024)
          throw Error("Converted GIF exceeds 8 MiB");
        fs.chmodSync(file, 0o600);
      } else {
        bytes = buffer;
        fs.writeFileSync(file, bytes, { mode: 0o600, flag: "wx" });
      }
      mime = "video/mp4";
    } catch (e: any) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      if (e.code === "ENOENT")
        throw Error(
          "Video validation/conversion is unavailable on this server",
        );
      throw Error(
        "Video/GIF validation failed. Use a supported MP4/GIF up to 90 seconds and 1920px",
      );
    } finally {
      fs.unlinkSync(input);
    }
  } else {
    try {
      const image = sharp(buffer, { limitInputPixels: 16000000 });
      const metadata = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format || ""))
        throw Error("Unsupported image");
      bytes = await image
        .rotate()
        .resize({
          width: 2048,
          height: 2048,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      throw Error(
        "Upload a valid JPEG, PNG, WebP, GIF or MP4. Other payload types are not enabled",
      );
    }
    fs.writeFileSync(file, bytes, { mode: 0o600, flag: "wx" });
  }
  try {
    transaction(db, () => {
      if (
        (
          db
            .prepare(
              "SELECT COUNT(*) n FROM broadcast_assets WHERE user_id=? AND bytes>0",
            )
            .get(user) as any
        ).n >= 100
      )
        throw Error(
          "Remove unused media before uploading more (100 stored files per owner)",
        );
      const stored = (
        db
          .prepare(
            "SELECT COALESCE(SUM(bytes),0) total FROM broadcast_assets WHERE user_id=?",
          )
          .get(user) as any
      ).total;
      if (
        (
          db
            .prepare(
              "SELECT COALESCE(SUM(bytes),0) total FROM broadcast_assets",
            )
            .get() as any
        ).total +
          bytes!.length >
        512 * 1024 * 1024
      )
        throw Error(
          "Server media quota reached. Remove unused media or contact support",
        );
      if (stored + bytes!.length > 50 * 1024 * 1024)
        throw Error("Personal media storage limit reached (50 MiB)");
      db.prepare("INSERT INTO broadcast_assets VALUES(?,?,?,?,?,?)").run(
        id,
        user,
        mime,
        bytes!.length,
        createHash("sha256").update(bytes!).digest("hex"),
        new Date().toISOString(),
      );
    });
  } catch (e) {
    fs.unlinkSync(file);
    throw e;
  }
  return {
    id,
    mime,
    bytes: bytes!.length,
    convertedGif: !!gif,
    notice: gif
      ? "GIF converted to MP4 for WhatsApp compatibility"
      : mime === "image/jpeg"
        ? "Image resized if needed and metadata removed"
        : "MP4 validated",
  };
}
