import { createBrotliDecompress, createUnzip } from "node:zlib";
import { extractPreviewMetadata, decodePreviewText } from "./previewMetadata";
import { previewImagePool } from "./previewPool";
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

const previewAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 4,
  maxTotalSockets: 16,
  maxFreeSockets: 2,
  timeout: 2000,
});
export async function fetchPublicResource(
  input: string,
  kind: "html" | "image",
  deadline = Date.now() + 16000,
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
            Math.max(1, Math.min(4000, deadline - Date.now())),
          );
        }),
      ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw Object.assign(
      Error("Destination resolves to a private or reserved address"),
      { code: "UNSAFE_DESTINATION" },
    );
  addresses.sort((a, b) => a.family - b.family);
  const limit = kind === "html" ? 1048576 : 2097152;
  let result: { body: Buffer; location?: string } | undefined, lastError: any;
  for (const pin of addresses.slice(0, 2)) {
    try {
      result = await new Promise<{ body: Buffer; location?: string }>(
        (resolve, reject) => {
          const req = https.get(
            u,
            {
              agent: previewAgent,
              lookup: ((_h: any, o: any, cb: any) =>
                o?.all
                  ? cb(null, [pin])
                  : cb(null, pin.address, pin.family)) as any,
              headers: {
                Accept:
                  kind === "html"
                    ? "text/html,application/xhtml+xml"
                    : "image/jpeg,image/png,image/webp,image/gif,application/octet-stream;q=0.5",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "en-US,en;q=0.8",
                "User-Agent":
                  "PappyPay-LinkPreview/0.11 (+https://pappy-earnig-hub.duckdns.org)",
              },
              timeout: Math.max(1, Math.min(5000, deadline - Date.now())),
            },
            (res) => {
              const status = res.statusCode || 0,
                type = String(res.headers["content-type"] || "")
                  .split(";")[0]
                  .trim()
                  .toLowerCase();
              if ([301, 302, 303, 307, 308].includes(status)) {
                if (!res.headers.location) {
                  res.destroy();
                  reject(Error("Redirect has no destination"));
                  return;
                }
                resolve({
                  body: Buffer.alloc(0),
                  location: res.headers.location,
                });
                res.destroy();
                return;
              }
              const allowed =
                kind === "html"
                  ? [
                      "text/html",
                      "application/xhtml+xml",
                      "",
                      "application/octet-stream",
                    ]
                  : [
                      "image/jpeg",
                      "image/png",
                      "image/webp",
                      "image/gif",
                      "",
                      "application/octet-stream",
                      "binary/octet-stream",
                    ];
              if (status !== 200 || !allowed.includes(type)) {
                res.destroy();
                reject(
                  Error("Destination did not return supported public " + kind),
                );
                return;
              }
              const encoding = String(
                res.headers["content-encoding"] || "identity",
              ).toLowerCase();
              if (!["identity", "gzip", "deflate", "br"].includes(encoding)) {
                res.destroy();
                reject(Error("Unsupported preview compression"));
                return;
              }
              const source =
                encoding === "br"
                  ? res.pipe(createBrotliDecompress())
                  : encoding === "gzip" || encoding === "deflate"
                    ? res.pipe(createUnzip())
                    : res;
              let raw = 0,
                length = 0,
                settled = false;
              const chunks: Buffer[] = [];
              res.on("data", (chunk: Buffer) => {
                raw += chunk.length;
                if (raw > 2097152 && !settled) {
                  settled = true;
                  req.destroy(
                    Error("Compressed preview exceeds resource limit"),
                  );
                }
              });
              const finish = () => {
                if (settled) return;
                settled = true;
                const body = Buffer.concat(chunks);
                if (
                  kind === "html" &&
                  !["text/html", "application/xhtml+xml"].includes(type) &&
                  !/<(?:!doctype\s+html|html|head|meta|title)\b/i.test(
                    body.subarray(0, 2048).toString("utf8"),
                  )
                ) {
                  reject(
                    Error("Destination did not return supported public html"),
                  );
                  return;
                }
                resolve({ body });
              };
              source.on("data", (chunk: Buffer) => {
                if (settled) return;
                if (length + chunk.length > limit) {
                  if (kind === "html") {
                    chunks.push(chunk.subarray(0, Math.max(0, limit - length)));
                    length = limit;
                    finish();
                    source.destroy();
                    res.destroy();
                  } else {
                    settled = true;
                    req.destroy(Error("Preview image exceeds 2 MiB"));
                  }
                  return;
                }
                length += chunk.length;
                chunks.push(chunk);
              });
              source.on("end", finish);
              source.on("error", (e) => {
                res.destroy();
                reject(e);
              });
              res.on("error", reject);
            },
          );
          const end = setTimeout(
            () => req.destroy(Error("Preview request timed out")),
            Math.max(1, Math.min(6000, deadline - Date.now())),
          );
          req.on("close", () => clearTimeout(end));
          req.on("error", reject);
          req.on("timeout", () =>
            req.destroy(Error("Preview request timed out")),
          );
        },
      );
      break;
    } catch (e) {
      lastError = e;
      if (Date.now() >= deadline) break;
    }
  }
  if (!result) throw lastError || Error("Preview request failed");
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
export async function fetchPublicHtml(input: string, redirects = 0) {
  return (
    await fetchPublicResource(input, "html", Date.now() + 16000, redirects)
  ).body.toString("utf8");
}
export const cleanPreviewText = decodePreviewText;
export function previewFromHtml(html: string, url: string): SafePreview {
  const metadata = extractPreviewMetadata(html);
  if (!metadata.title) throw Error("No preview title was found");
  return {
    "matched-text": url,
    title: metadata.title,
    description: metadata.description,
  };
}
export async function normalizePreviewImage(bytes: Buffer) {
  return previewImagePool.run(bytes);
}
export async function safePreview(url: string): Promise<SafePreview> {
  const deadline = Date.now() + 16000,
    page = await fetchPublicResource(url, "html", deadline),
    html = page.body.toString("utf8"),
    preview = previewFromHtml(html, url),
    metadata = extractPreviewMetadata(html);
  preview.canonicalUrl = page.url;
  preview.previewType = 0;
  for (const candidate of metadata.images) {
    if (Date.now() >= deadline) break;
    try {
      const imageUrl = new URL(candidate, page.url).href,
        bytes = (await fetchPublicResource(imageUrl, "image", deadline)).body;
      Object.assign(preview, await normalizePreviewImage(bytes));
      preview.previewType = 5;
      break;
    } catch {
      /* Try another real candidate. Never invent an image or relax SSRF/byte validation. */
    }
  }
  return preview;
}
