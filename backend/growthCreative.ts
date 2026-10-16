import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { type Database, transaction } from "./database";
import { PreviewEngine, completePreview } from "./previewEngine";
import type { SafePreview } from "./safePreview";
import { ownedGrowth } from "./growth";
import { GROWTH_PRODUCTS, type GrowthProduct } from "../shared/growthRules";
import {
  GROWTH_REMIX_VERSION,
  GROWTH_REMIX_CAPACITY,
  renderGrowthRemix,
  type GrowthRemix,
} from "../shared/growthRemix";
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const now = () => new Date().toISOString();
const one = (db: Database, sql: string, ...args: any[]): any =>
  db.prepare(sql).get(...args);
function gcd(a: number, b: number): number {
  while (b) {
    const r = a % b;
    a = b;
    b = r;
  }
  return a;
}
export function growthStyleIndex(seed: string, ordinal: number): number {
  if (
    !/^[a-f0-9]{64}$/.test(seed) ||
    !Number.isSafeInteger(ordinal) ||
    ordinal < 0 ||
    ordinal >= GROWTH_REMIX_CAPACITY
  )
    throw Error("Invalid creative sequence");
  const digest = createHmac("sha256", Buffer.from(seed, "hex"))
    .update("growth-remix-v1")
    .digest();
  let multiplier = 1 + (digest.readUInt32BE(0) % (GROWTH_REMIX_CAPACITY - 1));
  while (gcd(multiplier, GROWTH_REMIX_CAPACITY) !== 1)
    multiplier = multiplier === GROWTH_REMIX_CAPACITY - 1 ? 1 : multiplier + 1;
  const offset = digest.readUInt32BE(4) % GROWTH_REMIX_CAPACITY;
  // Both operands are <14 million; the product stays safely below 2^53.
  return (multiplier * ordinal + offset) % GROWTH_REMIX_CAPACITY;
}
function previewSnapshot(p: SafePreview, destination: string): SafePreview {
  // Only factual bounded metadata and validated-image fields from PreviewEngine, never arbitrary client preview JSON.
  const snapshot: SafePreview = {
    "matched-text": destination,
    title: typeof p.title === "string" ? p.title.slice(0, 500) : "",
    description:
      typeof p.description === "string" ? p.description.slice(0, 1500) : "",
  };
  if (completePreview(p))
    Object.assign(snapshot, {
      canonicalUrl: destination,
      previewType: 5,
      thumbnailBase64: p.thumbnailBase64,
      inlineThumbnailBase64: p.inlineThumbnailBase64,
      thumbnailWidth: p.thumbnailWidth,
      thumbnailHeight: p.thumbnailHeight,
    });
  return snapshot;
}
export class GrowthCreativeEngine {
  constructor(
    private db: Database,
    private previews: Pick<PreviewEngine, "get">,
  ) {}
  async gallery(user: string, id: string, count = 4) {
    if (!Number.isInteger(count) || count < 1 || count > 6)
      throw Error("Choose 1–6 preview examples");
    const isAdmin =
      one(this.db, "SELECT role FROM users WHERE id=?", user)?.role === "ADMIN";
    const order = ownedGrowth(this.db, id, user, isAdmin),
      input = JSON.parse(order.input_json),
      destination = input.destination;
    let asset = one(
      this.db,
      "SELECT * FROM growth_creative_assets WHERE order_id=? AND order_revision=? AND quality='COMPLETE' ORDER BY created_at LIMIT 1",
      id,
      order.revision,
    );
    let quality: "COMPLETE" | "PARTIAL" | "UNAVAILABLE" =
        asset?.quality || "UNAVAILABLE",
      preview: SafePreview = asset
        ? JSON.parse(asset.preview_json)
        : { "matched-text": destination, title: "", description: "" };
    if (!asset) {
      try {
        const fetched = await this.previews.get(destination);
        quality = completePreview(fetched) ? "COMPLETE" : "PARTIAL";
        preview = previewSnapshot(fetched, destination);
      } catch {
        /* Honest unavailable result, never invented image/count. */
      }
      const snapshot = JSON.stringify(preview),
        snapshotHash = hash(quality + snapshot);
      asset = transaction(this.db, () => {
        const current = ownedGrowth(this.db, id, user, isAdmin);
        if (
          current.revision !== order.revision ||
          current.input_json !== order.input_json ||
          current.status === "CANCELLED"
        )
          throw Error(
            "Campaign changed during creative preparation; review again",
          );
        const prior = one(
          this.db,
          "SELECT * FROM growth_creative_assets WHERE order_id=? AND order_revision=? AND (quality='COMPLETE' OR snapshot_hash=?) ORDER BY CASE quality WHEN 'COMPLETE' THEN 0 ELSE 1 END LIMIT 1",
          id,
          order.revision,
          snapshotHash,
        );
        if (prior) return prior;
        const count = one(
          this.db,
          "SELECT COUNT(*) n FROM growth_creative_assets WHERE order_id=?",
          id,
        ).n;
        if (count >= 8)
          throw Error(
            "This order reached its eight-snapshot creative storage bound. Staff review is required; no post was sent",
          );
        this.db
          .prepare("INSERT INTO growth_creative_assets VALUES(?,?,?,?,?,?,?,?)")
          .run(
            randomUUID(),
            id,
            order.revision,
            destination,
            snapshotHash,
            snapshot,
            quality,
            now(),
          );
        return one(
          this.db,
          "SELECT * FROM growth_creative_assets WHERE order_id=? AND order_revision=? AND snapshot_hash=?",
          id,
          order.revision,
          snapshotHash,
        );
      });
      quality = asset.quality;
      preview = JSON.parse(asset.preview_json);
    }
    const seed = randomBytes(32),
      examples: GrowthRemix[] = [],
      seen = new Set<string>(),
      fonts = new Set<number>(),
      colors = new Set<string>(),
      types = new Set<string>();
    for (let i = 0; examples.length < count && i < 512; i++) {
      const index =
        createHmac("sha256", seed)
          .update("gallery:" + i)
          .digest()
          .readUInt32BE(0) % GROWTH_REMIX_CAPACITY;
      const rendered = renderGrowthRemix({
        product: input.product,
        destination,
        destinationName: preview.title,
        styleIndex: index,
      });
      if (
        seen.has(rendered.text) ||
        fonts.has(rendered.nativeFont) ||
        colors.has(rendered.backgroundColor) ||
        types.has(rendered.typography)
      )
        continue;
      seen.add(rendered.text);
      fonts.add(rendered.nativeFont);
      colors.add(rendered.backgroundColor);
      types.add(rendered.typography);
      examples.push(rendered);
    }
    if (examples.length !== count)
      throw Error(
        "Could not prepare a sufficiently varied preview set; try again. No post was sent",
      );
    return {
      engineVersion: GROWTH_REMIX_VERSION,
      assetId: asset.id,
      metadataRecordedAt: asset.created_at,
      quality,
      preview,
      examples,
      previewOnly: true,
      liveDispatch: false,
      warning:
        quality === "COMPLETE"
          ? "Real destination metadata snapshot. Browser approximation only; WhatsApp may render fonts or the preview differently."
          : "Destination preview is incomplete/unavailable. No image or follower count is invented. Live work is still disabled.",
      catalogue: { combinations: GROWTH_REMIX_CAPACITY, finite: true },
      nativeFontEvidence:
        "Installed Plogme protocol/encoder intersection; physical-device rendering not certified",
    };
  }
  // Internal planner API only. No HTTP endpoint accepts group IDs or creates sends.
  // One frozen design per order/group, shared by both legs; account changes do not reroll it.
  allocate(orderId: string, groupJid: string, assetId: string) {
    if (!/^\d{5,30}(?:-\d{5,30})?@g\.us$/.test(groupJid))
      throw Error("A real target group identifier is required");
    const outcome = transaction(this.db, () => {
      const order = one(
        this.db,
        "SELECT * FROM growth_orders WHERE id=?",
        orderId,
      );
      if (!order || !["ACCEPTED", "RUNNING"].includes(order.status))
        throw Error(
          "Accepted or running reviewed order required for allocation; this is not funding authorization",
        );
      const prior = one(
        this.db,
        "SELECT * FROM growth_creative_placements WHERE order_id=? AND group_jid=?",
        orderId,
        groupJid,
      );
      if (prior) {
        if (prior.order_revision !== order.revision)
          throw Error(
            "Campaign revision changed; previous placement must not be reused",
          );
        return {
          id: prior.id,
          assetId: prior.asset_id,
          creative: JSON.parse(prior.render_json) as GrowthRemix,
          reused: true,
        };
      }
      const asset = one(
        this.db,
        "SELECT * FROM growth_creative_assets WHERE id=? AND order_id=? AND order_revision=?",
        assetId,
        orderId,
        order.revision,
      );
      if (!asset) throw Error("A current, owned preview asset is required");
      const input = JSON.parse(order.input_json),
        preview = JSON.parse(asset.preview_json);
      if (asset.destination !== input.destination)
        throw Error("Preview destination mismatch");
      this.db
        .prepare(
          "INSERT OR IGNORE INTO growth_creative_sequences VALUES(?,1,?,0)",
        )
        .run(orderId, randomBytes(32).toString("hex"));
      const seq = one(
        this.db,
        "SELECT * FROM growth_creative_sequences WHERE order_id=?",
        orderId,
      );
      if (seq.engine_version !== GROWTH_REMIX_VERSION)
        throw Error("Creative sequence version needs operator review");
      let ordinal = seq.next_ordinal;
      for (
        let attempt = 0;
        attempt < 512 && ordinal < GROWTH_REMIX_CAPACITY;
        attempt++, ordinal++
      ) {
        const creative = renderGrowthRemix({
            product: input.product as GrowthProduct,
            destination: input.destination,
            destinationName: preview.title,
            styleIndex: growthStyleIndex(seq.seed, ordinal),
          }),
          bodyHash = hash(creative.text),
          id = randomUUID();
        this.db
          .prepare(
            "UPDATE growth_creative_sequences SET next_ordinal=? WHERE order_id=?",
          )
          .run(ordinal + 1, orderId);
        const inserted = this.db
          .prepare(
            "INSERT OR IGNORE INTO growth_creative_placements VALUES(?,?,?,?,?,?,?,?,?)",
          )
          .run(
            id,
            orderId,
            groupJid,
            order.revision,
            assetId,
            creative.styleIndex,
            bodyHash,
            JSON.stringify(creative),
            now(),
          );
        if (inserted.changes) return { id, assetId, creative, reused: false };
      }
      return null; // Commit consumed collision slots; never silently reuse another group's text.
    });
    if (!outcome)
      throw Error(
        "No fresh readable remix in this allocation window. Pause for review or retry later; no post was sent",
      );
    return outcome;
  }
  content(
    placementId: string,
    surface: "GROUP_STATUS" | "GROUP_CHAT",
    readableFallback = false,
  ) {
    if (!["GROUP_STATUS", "GROUP_CHAT"].includes(surface))
      throw Error("Unsupported posting surface");
    const row = one(
      this.db,
      "SELECT p.*,a.preview_json,a.quality FROM growth_creative_placements p JOIN growth_creative_assets a ON a.id=p.asset_id WHERE p.id=?",
      placementId,
    );
    if (!row) throw Error("Creative placement not found");
    const creative = JSON.parse(row.render_json) as GrowthRemix,
      preview = JSON.parse(row.preview_json);
    return {
      text: readableFallback ? creative.plainText : creative.text,
      linkPreview: row.quality === "COMPLETE" ? preview : null,
      ...(surface === "GROUP_STATUS"
        ? {
            groupStatus: true,
            font: readableFallback ? 0 : creative.nativeFont,
            backgroundColor: creative.backgroundColor,
          }
        : {}),
    };
  }
}
