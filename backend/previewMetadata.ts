// Bounded metadata extraction only. Never execute scripts or follow declared URLs here.
function decodeEntities(input: string, passes = 1): string {
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
    lsquo: "‘",
    rsquo: "’",
    ldquo: "“",
    rdquo: "”",
    laquo: "«",
    raquo: "»",
    euro: "€",
    pound: "£",
    yen: "¥",
    cent: "¢",
    times: "×",
    divide: "÷",
    eacute: "é",
    Eacute: "É",
    aacute: "á",
    oacute: "ó",
    uacute: "ú",
    iacute: "í",
    ntilde: "ñ",
    uuml: "ü",
    ouml: "ö",
    auml: "ä",
  };
  let text = input.slice(0, 16384);
  for (let pass = 0; pass < passes; pass++) {
    const next = text.replace(
      /&(?:#(x[0-9a-f]+|[0-9]+)|([a-z]+));/gi,
      (original, numeric, name) => {
        if (!numeric)
          return (
            named[String(name)] ?? named[String(name).toLowerCase()] ?? original
          );
        const n = /^x/i.test(numeric)
          ? parseInt(numeric.slice(1), 16)
          : Number(numeric);
        return Number.isSafeInteger(n) &&
          n > 0 &&
          n <= 0x10ffff &&
          !(n >= 0xd800 && n <= 0xdfff)
          ? String.fromCodePoint(n)
          : "";
      },
    );
    if (next === text) break;
    text = next;
  }
  return text;
}
export function decodePreviewText(input: string): string {
  return decodeEntities(input, 5)
    .replace(/<[^>]*>/g, "")
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,
      "",
    )
    .replace(/[\ud800-\udfff]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
function attributes(tag: string) {
  const out: Record<string, string> = {};
  for (const m of tag
    .slice(0, 16384)
    .matchAll(
      /(?:^|\s)([\w:-]{1,64})\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
    ))
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4];
  return out;
}
// One forward scan; do not regex-rescan unclosed scripts or treat script/comment text as metadata.
function* metadataNodes(
  html: string,
): Generator<{ tag: string; body?: string }> {
  const lower = html.toLowerCase(),
    open = /<(meta|link|script|style|title)\b|<!--/gi;
  let match: RegExpExecArray | null,
    count = 0;
  while ((match = open.exec(html)) && count++ < 2048) {
    if (match[0] === "<!--") {
      const end = html.indexOf("-->", open.lastIndex);
      if (end < 0) return;
      open.lastIndex = end + 3;
      continue;
    }
    const name = match[1].toLowerCase(),
      limit = Math.min(html.length, open.lastIndex + 16384);
    let quote = "",
      end = -1;
    for (let i = open.lastIndex; i < limit; i++) {
      const c = html[i];
      if (quote) {
        if (c === quote) quote = "";
      } else if (c === '"' || c === "'") quote = c;
      else if (c === ">") {
        end = i;
        break;
      }
    }
    if (end < 0) {
      open.lastIndex = limit;
      continue;
    }
    const tag = html.slice(match.index, end + 1);
    open.lastIndex = end + 1;
    if (name === "script" || name === "style" || name === "title") {
      const close = lower.indexOf(`</${name}`, end + 1);
      if (close < 0) return;
      const finish = html.indexOf(">", close);
      if (finish < 0) return;
      open.lastIndex = finish + 1;
      if (
        (name === "title" && close - end <= 4097) ||
        (name === "script" && close - end <= 65537)
      )
        yield { tag, body: html.slice(end + 1, close) };
    } else yield { tag };
  }
}
export function extractPreviewMetadata(source: string) {
  const html = source.slice(0, 1048576),
    values = new Map<string, string[]>(),
    images: string[] = [];
  const allowed = new Set([
    "og:title",
    "twitter:title",
    "og:description",
    "twitter:description",
    "description",
    "og:image:secure_url",
    "og:image",
    "og:image:url",
    "twitter:image",
    "twitter:image:src",
    "image",
  ]);
  const add = (key: string, value: string) => {
    if (!allowed.has(key)) return;
    const decoded = key.includes("image")
      ? decodeEntities(value).trim()
      : decodePreviewText(value);
    if (decoded) {
      const list = values.get(key) || [];
      if (list.length < 8) list.push(decoded);
      values.set(key, list);
    }
  };
  const first = (...keys: string[]) =>
    keys.map((k) => values.get(k)?.[0]).find(Boolean) || "";
  const jsonImages: string[] = [];
  let jsonTitle = "",
    jsonDescription = "",
    htmlTitle = "",
    visited = 0;
  const walk = (value: any, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 6 || ++visited > 300)
      return;
    if (Array.isArray(value)) {
      for (const v of value.slice(0, 30)) walk(v, depth + 1);
      return;
    }
    const image = value.image;
    for (const item of (Array.isArray(image) ? image : [image]).slice(0, 8)) {
      const candidate =
        typeof item === "string" ? item : item?.url || item?.contentUrl;
      if (typeof candidate === "string") jsonImages.push(candidate.trim());
    }
    if (!jsonTitle && typeof (value.headline || value.name) === "string")
      jsonTitle = value.headline || value.name;
    if (!jsonDescription && typeof value.description === "string")
      jsonDescription = value.description;
    if (value["@graph"]) walk(value["@graph"], depth + 1);
  };
  for (const { tag, body } of metadataNodes(html)) {
    const a = attributes(tag),
      key = (a.property || a.name || a.itemprop || "").toLowerCase();
    if (/^<meta/i.test(tag)) add(key, a.content || "");
    else if (
      /^<link/i.test(tag) &&
      (a.rel || "").toLowerCase().split(/\s+/).includes("image_src") &&
      a.href &&
      images.length < 8
    )
      images.push(decodeEntities(a.href).trim());
    else if (/^<title/i.test(tag) && !htmlTitle) htmlTitle = body || "";
    else if (
      /^<script/i.test(tag) &&
      a.type?.toLowerCase() === "application/ld+json" &&
      body
    ) {
      try {
        walk(JSON.parse(body));
      } catch {
        /* Never execute malformed JSON or resolve remote contexts. */
      }
    }
  }
  const candidates = [
    ...(values.get("og:image:secure_url") || []),
    ...(values.get("og:image") || []),
    ...(values.get("og:image:url") || []),
    ...(values.get("twitter:image") || []),
    ...(values.get("twitter:image:src") || []),
    ...(values.get("image") || []),
    ...images,
    ...jsonImages,
  ];
  return {
    title: decodePreviewText(
      first("og:title", "twitter:title") || htmlTitle || jsonTitle,
    ).slice(0, 150),
    description: decodePreviewText(
      first("og:description", "twitter:description", "description") ||
        jsonDescription,
    ).slice(0, 250),
    images: [...new Set(candidates)]
      .filter((s) => s.length <= 1500)
      .slice(0, 8),
  };
}
