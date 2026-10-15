import sharp from "sharp";
import https from "node:https";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
const blocked = new BlockList(),
  blocked6 = new BlockList();
for (const [a, p] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["192.88.99.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(a, p, "ipv4");
for (const [a, p] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
  ["2001::", 32],
  ["2002::", 16],
  ["2001:2::", 48],
  ["2001:10::", 28],
  ["2001:20::", 28],
  ["2001:30::", 28],
  ["3fff::", 20],
] as const)
  blocked6.addSubnet(a, p, "ipv6");
export function publicAddress(address: string) {
  const family = isIP(address);
  if (family === 6) {
    const first = parseInt(address.split(":")[0], 16);
    if (!(first >= 0x2000 && first < 0x4000)) return false;
  }
  return (
    !!family &&
    !(family === 4 ? blocked : blocked6).check(
      address,
      family === 4 ? "ipv4" : "ipv6",
    )
  );
}
export function destination(value: unknown) {
  if (typeof value !== "string" || value.length > 1500)
    throw Error("A public HTTPS destination is required");
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw Error("Enter a valid HTTPS link");
  }
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443") ||
    (!u.hostname.includes(".") && isIP(u.hostname.replace(/[\[\]]/g, "")) === 0)
  )
    throw Error("A public HTTPS destination on port 443 is required");
  const host = u.hostname.replace(/[\[\]]/g, "");
  if (isIP(host) && !publicAddress(host))
    throw Error("Private and reserved destinations are not permitted");
  if (/(^|\.)(localhost|local|internal|home|test|invalid)$/.test(host))
    throw Error("Internal destinations are not permitted");
  return u;
}
export type SafePreview = {
  "matched-text": string;
  title: string;
  description: string;
  canonicalUrl?: string;
  previewType?: number;
  thumbnailBase64?: string;
  inlineThumbnailBase64?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
};
export async function fetchPublicResource(
  input: string,
  kind: "html" | "image",
  deadline = Date.now() + 12000,
  redirects = 0,
): Promise<{ body: Buffer; url: string }> {
  if (Date.now() >= deadline) throw Error("Preview request timed out");
  const u = destination(input),
    host = u.hostname.replace(/[\[\]]/g, "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await Promise.race([
        lookup(host, { all: true }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(Error("Preview DNS lookup timed out")),
            Math.min(4000, deadline - Date.now()),
          );
        }),
      ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw Object.assign(
      Error("Destination resolves to a private or reserved address"),
      { code: "UNSAFE_DESTINATION" },
    );
  const pin = addresses[0],
    limit = kind === "html" ? 262144 : 2097152;
  const result = await new Promise<{ body: Buffer; location?: string }>(
    (resolve, reject) => {
      const req = https.get(
        u,
        {
          lookup: ((_h: any, _o: any, cb: any) =>
            _o?.all
              ? cb(null, [pin])
              : cb(null, pin.address, pin.family)) as any,
          headers: {
            Accept:
              kind === "html"
                ? "text/html,application/xhtml+xml"
                : "image/jpeg,image/png,image/webp,image/gif",
            "User-Agent": "PappyPay-LinkPreview/0.5",
          },
          timeout: Math.max(1, Math.min(5000, deadline - Date.now())),
        },
        (res) => {
          const status = res.statusCode || 0,
            type = String(res.headers["content-type"] || "")
              .split(";")[0]
              .toLowerCase();
          if (status >= 300 && status < 400) {
            resolve({ body: Buffer.alloc(0), location: res.headers.location });
            res.destroy();
            return;
          }
          if (
            status !== 200 ||
            (kind === "html"
              ? !["text/html", "application/xhtml+xml"].includes(type)
              : ![
                  "image/jpeg",
                  "image/png",
                  "image/webp",
                  "image/gif",
                ].includes(type))
          ) {
            res.destroy();
            reject(
              Error("Destination did not return supported public " + kind),
            );
            return;
          }
          const chunks: Buffer[] = [];
          let length = 0;
          res.on("data", (chunk: Buffer) => {
            if (length + chunk.length > limit) {
              if (kind === "html") {
                chunks.push(chunk.subarray(0, Math.max(0, limit - length)));
                resolve({ body: Buffer.concat(chunks) });
                res.destroy();
              } else req.destroy(Error("Preview image exceeds 2 MiB"));
              return;
            }
            length += chunk.length;
            chunks.push(chunk);
          });
          res.on("end", () => resolve({ body: Buffer.concat(chunks) }));
          res.on("error", reject);
        },
      );
      const end = setTimeout(
        () => req.destroy(Error("Preview request timed out")),
        Math.max(1, Math.min(6000, deadline - Date.now())),
      );
      req.on("close", () => clearTimeout(end));
      req.on("error", reject);
      req.on("timeout", () => req.destroy(Error("Preview request timed out")));
    },
  );
  if (result.location) {
    if (redirects >= 3) throw Error("Too many redirects");
    return fetchPublicResource(
      new URL(result.location, u).href,
      kind,
      deadline,
      redirects + 1,
    );
  }
  return { body: result.body, url: u.href };
}
export async function fetchPublicHtml(
  input: string,
  redirects = 0,
): Promise<string> {
  return (
    await fetchPublicResource(input, "html", Date.now() + 12000, redirects)
  ).body.toString("utf8");
}
// Metadata is plain text, never trusted HTML. Bounded decoding handles WhatsApp's
// nested amp/hex entities; strip tags AFTER decoding so encoded markup cannot escape.
export function cleanPreviewText(input: string): string {
  const named: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
    copy: "©",
    reg: "®",
    trade: "™",
    ndash: "–",
    mdash: "—",
    hellip: "…",
    bull: "•",
  };
  let text = input.slice(0, 16384);
  for (let pass = 0; pass < 5; pass++) {
    const decoded = text.replace(
      /&(?:#(x[0-9a-f]+|[0-9]+)|([a-z]+));/gi,
      (original, numeric, name) => {
        if (!numeric) return named[String(name).toLowerCase()] ?? original;
        const value = /^x/i.test(numeric)
          ? parseInt(numeric.slice(1), 16)
          : Number(numeric);
        return Number.isSafeInteger(value) &&
          value > 0 &&
          value <= 0x10ffff &&
          !(value >= 0xd800 && value <= 0xdfff)
          ? String.fromCodePoint(value)
          : "";
      },
    );
    if (decoded === text) break;
    text = decoded;
  }
  return text
    .replace(/<[^>]*>/g, "")
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,
      "",
    )
    .replace(/[\ud800-\udfff]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
const clean = cleanPreviewText;
function meta(html: string) {
  const out: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^<>]*>/gi) || []) {
    const attrs: Record<string, string> = {};
    for (const m of tag
      .slice(0, 8192)
      .matchAll(/(?:^|\s)([\w:-]{1,64})\s*=\s*(["'])([\s\S]*?)\2/g))
      attrs[m[1].toLowerCase()] = m[3];
    const key = (attrs.property || attrs.name || "").toLowerCase();
    if (key && attrs.content && !out[key]) out[key] = clean(attrs.content);
  }
  return out;
}
export function previewFromHtml(html: string, url: string): SafePreview {
  const m = meta(html),
    title = clean(
      m["og:title"] ||
        m["twitter:title"] ||
        html.match(/<title\b[^<>]{0,1024}>([^<]{0,4096})<\/title>/i)?.[1] ||
        "",
    ).slice(0, 150),
    description = clean(
      m["og:description"] || m["twitter:description"] || m.description || "",
    ).slice(0, 250);
  if (!title) throw Error("No preview title was found");
  return { "matched-text": url, title, description };
}
export async function normalizePreviewImage(bytes: Buffer) {
  const magic = bytes.subarray(0, 12);
  if (
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
  const image = sharp(bytes, { limitInputPixels: 16000000 }),
    info = await image.metadata();
  if (!["jpeg", "png", "webp", "gif"].includes(info.format || ""))
    throw Error("Unsupported thumbnail");
  if ((info.width || 0) < 48 || (info.height || 0) < 48)
    throw Error("Website image is too small for a useful preview");
  const upscale = Math.max(info.width || 0, info.height || 0) < 600;
  let { data, info: output } = await image
    .rotate()
    .resize({
      width: upscale ? 640 : 1000,
      height: upscale ? 640 : 1000,
      fit: "inside",
      withoutEnlargement: !upscale,
    })
    .jpeg({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  if (data.length > 350000) {
    const compact = await sharp(data)
      .resize({
        width: 640,
        height: 640,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 72 })
      .toBuffer({ resolveWithObject: true });
    data = compact.data;
    output = compact.info;
  }
  if (data.length > 350000) throw Error("Thumbnail too large");
  const inline = await sharp(data)
    .resize({
      width: 320,
      height: 320,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 65 })
    .toBuffer();
  return {
    inlineThumbnailBase64: inline.toString("base64"),
    thumbnailBase64: data.toString("base64"),
    thumbnailWidth: output.width,
    thumbnailHeight: output.height,
  };
}
export async function safePreview(url: string): Promise<SafePreview> {
  const deadline = Date.now() + 12000,
    page = await fetchPublicResource(url, "html", deadline),
    html = page.body.toString("utf8"),
    preview = previewFromHtml(html, url),
    m = meta(html),
    candidate =
      m["og:image:secure_url"] ||
      m["og:image"] ||
      m["twitter:image"] ||
      m["twitter:image:src"];
  preview.canonicalUrl = page.url;
  preview.previewType = 0;
  if (candidate) {
    try {
      const imageUrl = new URL(candidate, page.url).href,
        bytes = (await fetchPublicResource(imageUrl, "image", deadline)).body;
      Object.assign(preview, await normalizePreviewImage(bytes));
      preview.previewType = 5;
    } catch {
      /* Never pretend a missing/blocked/invalid image is a video or a working thumbnail. */
    }
  }
  return preview;
}
