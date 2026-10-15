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
export async function fetchPublicHtml(
  input: string,
  redirects = 0,
): Promise<string> {
  const u = destination(input),
    host = u.hostname.replace(/[\[\]]/g, "");
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await Promise.race([
        lookup(host, { all: true }),
        new Promise<never>((_, reject) => {
          const timer = setTimeout(
            () => reject(Error("Preview DNS lookup timed out")),
            5000,
          );
          timer.unref();
        }),
      ]);
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw Object.assign(
      Error("Destination resolves to a private or reserved address"),
      { code: "UNSAFE_DESTINATION" },
    );
  const pin = addresses[0];
  const result = await new Promise<{
    body: string;
    location?: string;
    status: number;
  }>((resolve, reject) => {
    const request = https.get(
      u,
      {
        lookup: ((_h: any, _o: any, callback: any) => {
          if (_o?.all) callback(null, [pin]);
          else callback(null, pin.address, pin.family);
        }) as any,
        headers: {
          Accept: "text/html",
          "User-Agent": "PappyPay-LinkPreview/0.3",
        },
        timeout: 5000,
      },
      (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400) {
          response.resume();
          resolve({ status, body: "", location: response.headers.location });
          return;
        }
        if (
          status !== 200 ||
          !String(response.headers["content-type"])
            .toLowerCase()
            .startsWith("text/html")
        ) {
          response.resume();
          reject(Error("Destination did not return a public HTML page"));
          return;
        }
        let length = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          length += chunk.length;
          if (length > 262144) {
            request.destroy(Error("Preview page exceeds 256 KiB"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({ status, body: Buffer.concat(chunks).toString("utf8") }),
        );
        response.on("error", reject);
      },
    );
    const deadline = setTimeout(
      () => request.destroy(Error("Preview request timed out")),
      6000,
    );
    request.on("close", () => clearTimeout(deadline));
    request.on("timeout", () =>
      request.destroy(Error("Preview request timed out")),
    );
    request.on("error", reject);
  });
  if (result.location) {
    if (redirects >= 3) throw Error("Too many redirects");
    return fetchPublicHtml(new URL(result.location, u).href, redirects + 1);
  }
  if (result.status !== 200)
    throw Error("Destination redirect has no location");
  return result.body;
}
const clean = (s: string) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
export function previewFromHtml(html: string, url: string) {
  const title = clean(
    html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "",
  ).slice(0, 150);
  const tag = (html.match(/<meta\b[^>]*>/gi) || []).find((t) =>
    /\b(?:name|property)\s*=\s*["'](?:og:)?description["']/i.test(t),
  );
  const description = clean(
    tag?.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] || "",
  ).slice(0, 250);
  if (!title) throw Error("No preview title was found");
  return { "matched-text": url, title, description };
}
export async function safePreview(url: string) {
  return previewFromHtml(await fetchPublicHtml(url), url);
}
