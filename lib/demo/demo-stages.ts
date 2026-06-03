/** Guided AI sales presentation stages */
export const SALES_DEMO_STAGES = [
  "welcome",
  "need_discovery",
  "demo_path_selection",
  "presentation",
  "value_explanation",
  "objection_handling",
  "qualification",
  "recommendation",
  "booking",
  "human_handoff",
  "close",
] as const;

export type SalesDemoStage = (typeof SALES_DEMO_STAGES)[number];

/** @deprecated Legacy stages — mapped at read time */
export const LEGACY_DEMO_STAGES = [
  "discovery",
  "product_overview",
  "feature_explanation",
  "use_case_match",
  "booking_recommendation",
  "handoff",
] as const;

const LEGACY_STAGE_MAP: Record<string, SalesDemoStage> = {
  welcome: "welcome",
  discovery: "need_discovery",
  product_overview: "presentation",
  feature_explanation: "value_explanation",
  use_case_match: "presentation",
  objection_handling: "objection_handling",
  qualification: "qualification",
  booking_recommendation: "booking",
  handoff: "human_handoff",
  close: "close",
  need_discovery: "need_discovery",
  demo_path_selection: "demo_path_selection",
  presentation: "presentation",
  value_explanation: "value_explanation",
  recommendation: "recommendation",
  booking: "booking",
  human_handoff: "human_handoff",
};

export function normalizeDemoStage(stage: string | null | undefined): SalesDemoStage {
  if (!stage) return "welcome";
  const key = stage.trim().toLowerCase();
  if ((SALES_DEMO_STAGES as readonly string[]).includes(key)) {
    return key as SalesDemoStage;
  }
  return LEGACY_STAGE_MAP[key] ?? "need_discovery";
}

export function isSalesDemoStage(stage: string): stage is SalesDemoStage {
  return (SALES_DEMO_STAGES as readonly string[]).includes(stage);
}
