import type { DemoPath } from "./types";

export type PathSelectionResult = {
  path: DemoPath | null;
  reason: string;
};

function textBlob(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

/** Rule-based path selection from prospect language (before / alongside LLM). */
export function selectDemoPathFromMessage(
  message: string,
  paths: DemoPath[]
): PathSelectionResult {
  const msg = message.toLowerCase();
  const active = paths.filter((p) => p.status === "active");
  if (active.length === 0) return { path: null, reason: "no_paths" };

  const byKey = (key: string) =>
    active.find((p) => p.path_key === key) ??
    active.find((p) => p.title.toLowerCase().includes(key.replace(/_/g, " ")));

  const fullGrowthSignals = [
    "everything",
    "full package",
    "full digital",
    "digital growth",
    "online presence",
    "brand growth",
    "all services",
    "complete solution",
    "end to end",
    "whole business",
  ];
  if (fullGrowthSignals.some((s) => msg.includes(s))) {
    const p = byKey("full_growth");
    if (p) return { path: p, reason: "full_growth_keywords" };
  }

  const socialSignals = [
    "social media",
    "instagram",
    "tiktok",
    "facebook",
    "content",
    "posting",
    "reel",
    "reels",
    "captions",
    "account management",
    "community management",
  ];
  if (socialSignals.some((s) => msg.includes(s))) {
    const p = byKey("social_media");
    if (p) return { path: p, reason: "social_keywords" };
  }

  const websiteSignals = [
    "website",
    "web site",
    "ecommerce",
    "e-commerce",
    "online store",
    "booking",
    "payment",
    "web development",
    "landing page",
  ];
  if (websiteSignals.some((s) => msg.includes(s))) {
    const p = byKey("website");
    if (p) return { path: p, reason: "website_keywords" };
  }

  const brandSignals = [
    "logo",
    "brand",
    "identity",
    "branding",
    "design system",
    "visual",
    "flyers",
    "visual identity",
  ];
  if (brandSignals.some((s) => msg.includes(s))) {
    const p = byKey("branding");
    if (p) return { path: p, reason: "branding_keywords" };
  }

  const adsSignals = [
    "paid ads",
    "google ads",
    "meta ads",
    "facebook ads",
    "advertising",
    "ppc",
    "leads",
    "customers",
    "sales",
    "traffic",
    "ad spend",
    "campaign",
  ];
  if (adsSignals.some((s) => msg.includes(s))) {
    const p = byKey("digital_advertising");
    if (p) return { path: p, reason: "ads_keywords" };
  }

  if (msg.includes("real estate") || msg.includes("property")) {
    const social = byKey("social_media");
    if (social) return { path: social, reason: "real_estate_default_social" };
  }

  return { path: null, reason: "no_keyword_match" };
}

export function resolveDemoPathForTurn(params: {
  paths: DemoPath[];
  customerMessage: string;
  llmPathId?: string | null;
  currentPathId?: string | null;
}): PathSelectionResult {
  if (params.llmPathId) {
    const fromLlm = params.paths.find((p) => p.id === params.llmPathId);
    if (fromLlm) return { path: fromLlm, reason: "llm_selected" };
  }
  if (params.currentPathId) {
    const current = params.paths.find((p) => p.id === params.currentPathId);
    if (current) return { path: current, reason: "session_locked" };
  }
  const fromMsg = selectDemoPathFromMessage(params.customerMessage, params.paths);
  if (fromMsg.path) return fromMsg;
  return { path: null, reason: "undecided" };
}
