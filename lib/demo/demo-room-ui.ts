import type { DemoQualificationProgress } from "./types";
import { normalizeDemoStage, type SalesDemoStage } from "./demo-stages";

/** Stages shown in the demo room progress tracker (sales journey). */
export const DEMO_STAGE_PROGRESS: { id: SalesDemoStage; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "need_discovery", label: "Need Discovery" },
  { id: "demo_path_selection", label: "Demo Path Selection" },
  { id: "presentation", label: "Presentation" },
  { id: "value_explanation", label: "Value Explanation" },
  { id: "qualification", label: "Qualification" },
  { id: "booking", label: "Booking" },
  { id: "human_handoff", label: "Human Handoff" },
  { id: "close", label: "Close" },
];

export function formatDemoStageLabel(stage: string | null | undefined): string {
  const n = normalizeDemoStage(stage);
  const found = DEMO_STAGE_PROGRESS.find((s) => s.id === n);
  if (found) return found.label;
  if (n === "recommendation") return "Recommendation";
  return n.replace(/_/g, " ");
}

export function resolveProgressStageIndex(stage: string | null | undefined): number {
  const n = normalizeDemoStage(stage);
  if (n === "objection_handling" || n === "recommendation") {
    return DEMO_STAGE_PROGRESS.findIndex((s) => s.id === "qualification");
  }
  const idx = DEMO_STAGE_PROGRESS.findIndex((s) => s.id === n);
  if (idx >= 0) return idx;
  return 0;
}

export type CustomerSentimentDisplay = "Positive" | "Neutral" | "Cautious" | "Unknown";

/** Proxy sentiment from lead score/category when no explicit sentiment field exists. */
export function inferCustomerSentiment(
  leadScore?: number | null,
  leadCategory?: string | null
): CustomerSentimentDisplay | null {
  const cat = formatLeadCategory(leadCategory);
  if (cat === "Hot") return "Positive";
  if (cat === "Warm") return "Neutral";
  if (cat === "Cold") return "Cautious";
  if (leadScore != null && leadScore >= 9) return "Positive";
  if (leadScore != null && leadScore >= 5) return "Neutral";
  if (leadScore != null && leadScore > 0) return "Cautious";
  return null;
}

export function demoProgressPercent(stage: string | null | undefined): number {
  const idx = resolveProgressStageIndex(stage);
  const max = DEMO_STAGE_PROGRESS.length - 1;
  if (max <= 0) return 0;
  return Math.round((idx / max) * 100);
}

export type LeadCategoryDisplay = "Cold" | "Warm" | "Hot" | "Unknown";

export function formatLeadCategory(
  raw: string | null | undefined
): LeadCategoryDisplay {
  if (!raw) return "Unknown";
  const k = raw.toLowerCase().replace(/\s+/g, "_");
  if (k === "hot" || k.includes("hot")) return "Hot";
  if (k === "warm" || k.includes("warm")) return "Warm";
  if (k === "cold" || k.includes("cold")) return "Cold";
  return "Unknown";
}

export type BuyingIntent = "Low" | "Medium" | "High";

export function buyingIntentFromScore(score: number | null | undefined): BuyingIntent {
  if (score == null || score <= 0) return "Low";
  if (score >= 9) return "High";
  if (score >= 5) return "Medium";
  return "Low";
}

export function recommendedQualificationQuestion(
  progress?: DemoQualificationProgress | null
): string {
  const p = progress ?? { need: false, budget: false, authority: false, timeline: false };
  if (!p.need) return "What problem are you trying to solve right now?";
  if (!p.budget) return "What budget range are you working with for this initiative?";
  if (!p.timeline) return "When are you hoping to make a decision or go live?";
  if (!p.authority) return "Who else is involved in the final decision?";
  return "Would you like to book a consultation with our team?";
}

export const OBJECTION_CATALOG = [
  "price_concern",
  "timing_concern",
  "trust_concern",
  "needs_approval",
  "custom_package",
] as const;

export function extractTalkingPoints(content: string, max = 4): string[] {
  const lines = content
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.]+\s*/, "").trim())
    .filter((l) => l.length > 12 && l.length < 200);
  if (lines.length >= 2) return lines.slice(0, max);
  const sentences = content
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 160);
  return sentences.slice(0, max);
}
