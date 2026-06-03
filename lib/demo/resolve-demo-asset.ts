import type { DemoAnalysis } from "./demo-schemas";
import type { DemoAsset, DemoPath } from "./types";
import { getDemoAsset, listDemoAssets } from "./demo-data";

function sortByDisplayOrder(assets: DemoAsset[]): DemoAsset[] {
  return [...assets].sort((a, b) => a.sort_order - b.sort_order);
}

export function assetsForDemoPath(
  allAssets: DemoAsset[],
  path: DemoPath | null
): DemoAsset[] {
  const active = allAssets.filter((a) => a.status === "active");

  if (path?.id) {
    const pathLinked = sortByDisplayOrder(
      active.filter((a) => a.demo_path_id === path.id)
    );
    if (pathLinked.length > 0) return pathLinked;
  }

  if (!path?.demo_asset_sequence?.length) return sortByDisplayOrder(active);

  const sequence = path.demo_asset_sequence.map((t) => t.toLowerCase());
  const ordered: DemoAsset[] = [];
  for (const title of sequence) {
    const match = active.find((a) => a.title.toLowerCase() === title);
    if (match) ordered.push(match);
  }
  if (ordered.length > 0) return ordered;
  return active.filter((a) =>
    sequence.some((t) => a.title.toLowerCase().includes(t))
  );
}

export async function resolveNextDemoAsset(params: {
  organizationId: string;
  analysis: DemoAnalysis;
  pathAssets: DemoAsset[];
  allAssets: DemoAsset[];
  currentAssetId?: string | null;
  lastAssetId?: string | null;
  customerMessage?: string;
  advanceSlide?: boolean;
}): Promise<DemoAsset | null> {
  const { organizationId, analysis, pathAssets, allAssets } = params;
  const assets = pathAssets.length > 0 ? pathAssets : allAssets;

  if (analysis.next_asset_id) {
    const picked = await getDemoAsset(analysis.next_asset_id);
    if (picked && picked.organization_id === organizationId) return picked;
  }

  const msg = [
    analysis.detected_intent,
    analysis.lead_extraction.service_interest ?? "",
    analysis.lead_extraction.business_name ?? "",
    analysis.lead_extraction.industry ?? "",
    params.customerMessage ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const matchByKeyword = (keywords: string[]) =>
    assets.find((a) => keywords.some((k) => a.title.toLowerCase().includes(k)));

  if (
    msg.includes("social") ||
    msg.includes("real estate") ||
    msg.includes("realtor") ||
    msg.includes("property")
  ) {
    return matchByKeyword(["social media"]) ?? null;
  }
  if (msg.includes("website") || msg.includes("web") || msg.includes("ecommerce")) {
    return matchByKeyword(["website"]) ?? null;
  }
  if (msg.includes("ad") || msg.includes("advert") || msg.includes("ppc")) {
    return matchByKeyword(["advertising", "digital ad"]) ?? null;
  }
  if (msg.includes("brand") || msg.includes("creative") || msg.includes("logo")) {
    return matchByKeyword(["branding", "creative"]) ?? null;
  }
  if (msg.includes("why") || msg.includes("choose")) {
    return matchByKeyword(["why work"]) ?? null;
  }

  const lastId = params.lastAssetId ?? params.currentAssetId;
  const idx = lastId ? assets.findIndex((a) => a.id === lastId) : -1;

  if (params.advanceSlide && idx >= 0 && idx < assets.length - 1) {
    return assets[idx + 1] ?? null;
  }

  if (idx >= 0 && idx < assets.length - 1) {
    const stage = analysis.current_demo_stage;
    if (stage === "presentation" || stage === "value_explanation") {
      return assets[idx + 1] ?? null;
    }
  }

  if (idx < 0 && assets.length > 0) {
    return assets[0];
  }

  return null;
}
