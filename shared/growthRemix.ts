import {
  normalizeGrowthDestination,
  GROWTH_PRODUCTS,
  type GrowthProduct,
} from "./growthRules";

export const GROWTH_REMIX_VERSION = 1;
// Intersection of Plogme 2.1.0 ExtendedTextMessage.FontType and its encoder's 0..9 check.
// Protocol enum 10 is deliberately excluded; 3/4/5 belong to a different status enum.
export const NATIVE_GROWTH_FONTS = [
  { id: 0, name: "System" },
  { id: 1, name: "System text" },
  { id: 2, name: "Script" },
  { id: 6, name: "System bold" },
  { id: 7, name: "Morning Breeze" },
  { id: 8, name: "Calistoga" },
  { id: 9, name: "Exo 2" },
] as const;
export const GROWTH_REMIX_COLORS = [
  "#2563EB",
  "#4338CA",
  "#0F766E",
  "#7E22CE",
  "#9F1239",
  "#1D4ED8",
  "#166534",
  "#9A3412",
  "#334155",
  "#3730A3",
  "#155E75",
  "#831843",
] as const;
export const GROWTH_TYPE_STYLES = [
  "plain",
  "spaced",
  "serif-bold",
  "sans",
  "sans-bold",
  "sans-italic",
  "sans-bold-italic",
  "monospace",
  "fullwidth",
  "double-struck",
  "bold-script",
  "serif-italic",
] as const;
export type GrowthTypeStyle = (typeof GROWTH_TYPE_STYLES)[number];
const ORNAMENTS = [
  ["♡", "♡"],
  ["♥", "♥"],
  ["✧", "✧"],
  ["✦", "✦"],
  ["❀", "❀"],
  ["❋", "❋"],
  ["✿", "✿"],
  ["✩", "✩"],
  ["✶", "✶"],
  ["✷", "✷"],
  ["✵", "✵"],
  ["❖", "❖"],
  ["◈", "◈"],
  ["◇", "◇"],
  ["○", "○"],
  ["◎", "◎"],
  ["◌", "◌"],
  ["•", "•"],
  ["·", "·"],
  ["☾", "☽"],
  ["❮", "❯"],
  ["‹", "›"],
  ["«", "»"],
  ["⌜", "⌟"],
] as const;
const DIVIDERS = [
  "────",
  "━━━━",
  "════",
  "──────",
  "━━━━━━",
  "══════",
  "── ──",
  "━ ━",
  "═ ═",
  "─ · ─",
  "━ · ━",
  "═ · ═",
  "── ◦ ──",
  "━ ◦ ━",
  "═ ◦ ═",
  "─ ─ ─",
  "━ ━ ━",
  "═ ═ ═",
  "───",
  "━━━",
  "═══",
  "— —",
  "━━ ━━",
  "══ ══",
] as const;
const LAYOUTS: Array<(t: string, l: string, r: string, d: string) => string[]> =
  [
    (t, l, r, d) => [`${d} ${l} ${t} ${r} ${d}`],
    (t, l, r, d) => [`${l} ${t} ${r}`, `${d}`],
    (t, l, r, d) => [d, `${l} ${t} ${r}`],
    (t, l, r, d) => [`${d} ${l}`, t, `${r} ${d}`],
    (t, l, r, d) => [`${l} ${d} ${r}`, t],
    (t, l, r, d) => [t, `${l} ${d} ${r}`],
    (t, l, r, d) => [`${d} ${l} ${t}`, `${r} ${d}`],
    (t, l, r, d) => [`${l} ${d}`, `${t} ${r}`],
    (t, l, r, d) => [`${l} ${t}`, `${d} ${r}`],
    (t, l, r, d) => [`${l}${l} ${t} ${r}${r}`, d],
    (t, l, r, d) => [`${d} ${l}${r}`, `${t}`],
    (t, l, r, d) => [`${t}`, `${l}${r} ${d}`],
    (t, l, r, d) => [`${l} ${t} ${r}`, `${d} ${l}${r}`],
    (t, l, r, d) => [`${l}${r} ${d}`, `${l} ${t} ${r}`],
    (t, l, r, d) => [`${d} ${l} ${t} ${r}`],
    (t, l, r, d) => [`${l} ${t} ${r} ${d}`],
    (t, l, r, d) => [`${l} ${d} ${t} ${d} ${r}`],
    (t, l, r, d) => [`${l} ${t} ${r}`, `${l} ${d} ${r}`],
    (t, l, r, d) => [`${l}${r} ${t} ${l}${r}`, d],
    (t, l, r, d) => [`${l} ${d}`, t, `${d} ${r}`],
    (t, l, r, d) => [`${l} ${t} ${r}`, d, `${l}${r}`],
    (t, l, r, d) => [`${l}${r}`, `${d} ${t} ${d}`],
    (t, l, r, d) => [`${d} ${l}${r}`, `${l} ${t} ${r}`],
    (t, l, r, d) => [`${l} ${t} ${r}`, `${l}${r} ${d} ${l}${r}`],
  ];
export const GROWTH_REMIX_DIMENSIONS = [
  LAYOUTS.length,
  GROWTH_TYPE_STYLES.length,
  ORNAMENTS.length,
  DIVIDERS.length,
  GROWTH_REMIX_COLORS.length,
  NATIVE_GROWTH_FONTS.length,
] as const;
export const GROWTH_REMIX_CAPACITY = GROWTH_REMIX_DIMENSIONS.reduce(
  (n, v) => n * v,
  1,
);
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export function cleanDestinationName(value: unknown, fallback: string): string {
  const safe =
    typeof value === "string"
      ? value
          .slice(0, 1000)
          .normalize("NFC")
          .replace(/<[^>]*>/g, " ")
          .replace(
            /[\u0000-\u001f\u007f-\u009f\u061c\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g,
            " ",
          )
          .replace(/(?:https?:\/\/|www\.|(?:[a-z0-9-]+\.)+[a-z]{2,})\S*/gi, " ")
          .replace(/[@*_~`]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "";
  const parts = Array.from(segmenter.segment(safe));
  return parts.length
    ? parts
        .slice(0, 32)
        .map((x) => x.segment)
        .join("") + (parts.length > 32 ? "…" : "")
    : fallback;
}
export function styleDestinationName(
  title: string,
  style: GrowthTypeStyle,
): string {
  if (style === "plain") return title;
  if (style === "spaced")
    return Array.from(segmenter.segment(title))
      .map((x) => x.segment)
      .join(" ");
  const ranges: Partial<Record<GrowthTypeStyle, [number, number, number?]>> = {
    "serif-bold": [0x1d400, 0x1d41a, 0x1d7ce],
    sans: [0x1d5a0, 0x1d5ba, 0x1d7e2],
    "sans-bold": [0x1d5d4, 0x1d5ee, 0x1d7ec],
    "sans-italic": [0x1d608, 0x1d622],
    "sans-bold-italic": [0x1d63c, 0x1d656, 0x1d7ec],
    monospace: [0x1d670, 0x1d68a, 0x1d7f6],
    fullwidth: [0xff21, 0xff41, 0xff10],
    "double-struck": [0x1d538, 0x1d552, 0x1d7d8],
    "bold-script": [0x1d4d0, 0x1d4ea],
    "serif-italic": [0x1d434, 0x1d44e],
  };
  const range = ranges[style];
  if (!range) throw Error("Unsupported typography style");
  const holes: Record<string, number> = {
    C: 0x2102,
    H: 0x210d,
    N: 0x2115,
    P: 0x2119,
    Q: 0x211a,
    R: 0x211d,
    Z: 0x2124,
  };
  return Array.from(title)
    .map((c) => {
      if (style === "double-struck" && holes[c])
        return String.fromCodePoint(holes[c]);
      if (style === "serif-italic" && c === "h") return "ℎ";
      const n = c.codePointAt(0)!;
      return n >= 65 && n <= 90
        ? String.fromCodePoint(range[0] + n - 65)
        : n >= 97 && n <= 122
          ? String.fromCodePoint(range[1] + n - 97)
          : n >= 48 && n <= 57 && range[2]
            ? String.fromCodePoint(range[2] + n - 48)
            : c;
    })
    .join("");
}
export type GrowthRemix = {
  version: 1;
  styleIndex: number;
  layout: number;
  typography: GrowthTypeStyle;
  ornament: number;
  divider: number;
  nativeFont: number;
  nativeFontName: string;
  backgroundColor: string;
  destination: string;
  destinationName: string;
  text: string;
  plainText: string;
  compatibility: "NATIVE_AND_UNICODE_UNCERTIFIED_ON_DEVICE";
};
export function renderGrowthRemix(input: {
  product: GrowthProduct;
  destination: string;
  destinationName?: unknown;
  styleIndex: number;
}): GrowthRemix {
  if (
    !Number.isSafeInteger(input.styleIndex) ||
    input.styleIndex < 0 ||
    input.styleIndex >= GROWTH_REMIX_CAPACITY
  )
    throw Error("Remix index outside the finite catalogue");
  const destination = normalizeGrowthDestination(
      input.product,
      input.destination,
    ),
    name = cleanDestinationName(
      input.destinationName,
      GROWTH_PRODUCTS[input.product].name,
    );
  let index = input.styleIndex;
  const digits = GROWTH_REMIX_DIMENSIONS.map((radix) => {
    const d = index % radix;
    index = Math.floor(index / radix);
    return d;
  });
  const [layout, type, ornament, divider, color, font] = digits,
    typography = GROWTH_TYPE_STYLES[type],
    pair = ORNAMENTS[ornament],
    native = NATIVE_GROWTH_FONTS[font];
  const lines = LAYOUTS[layout](
    styleDestinationName(name, typography),
    pair[0],
    pair[1],
    DIVIDERS[divider],
  );
  // URL is a separate untouched line: no styled alphabet, wrappers, hidden marks or shortener.
  const footer = [
    0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1, 2, 0, 0, 1,
  ][layout];
  const split = lines.length - footer;
  const text = [
    ...lines.slice(0, split),
    destination,
    ...lines.slice(split),
  ].join("\n");
  if (text.length > 1600 || new TextEncoder().encode(text).length > 6000)
    throw Error("Compact URL post exceeds engine safety bounds");
  return {
    version: 1,
    styleIndex: input.styleIndex,
    layout,
    typography,
    ornament,
    divider,
    nativeFont: native.id,
    nativeFontName: native.name,
    backgroundColor: GROWTH_REMIX_COLORS[color],
    destination,
    destinationName: name,
    text,
    plainText: name + "\n" + destination,
    compatibility: "NATIVE_AND_UNICODE_UNCERTIFIED_ON_DEVICE",
  };
}
