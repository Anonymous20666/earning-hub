import { normalizeGrowthDestination, type GrowthProduct } from "./growthRules";

export type GrowthUrlPost = {
  kind: "DESTINATION_URL";
  product: GrowthProduct;
  text: string;
  previewUrl: string;
};

// A growth promotion posts its destination, not an advertiser-written caption.
// Deliberately allowlist fields: historic draft message/caption/title fields
// must never leak into native post text. Card artwork is a separate asset.
export function buildGrowthUrlPost(input: {
  product: GrowthProduct;
  destination: string;
}): GrowthUrlPost {
  const url = normalizeGrowthDestination(input.product, input.destination);
  return { kind: "DESTINATION_URL", product: input.product, text: url, previewUrl: url };
}
