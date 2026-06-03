import type { LeadCategory } from "@/lib/platform/types";
import type { WorkflowLeadScores } from "@/lib/platform/workflow/types";
import type { DemoAnalysis } from "./demo-schemas";
import type { DemoQualificationProgress } from "./types";
import { isQualificationStrong } from "./qualification-progress";

function clampBant(n: number): number {
  return Math.max(0, Math.min(3, Math.round(n)));
}

/** Demo BANT: each dimension 0–3, total 0–12 (no org scaling). */
export function sumDemoBantScores(raw: {
  need: number;
  budget: number;
  authority: number;
  timeline: number;
}): WorkflowLeadScores {
  const need = clampBant(raw.need);
  const budget = clampBant(raw.budget);
  const authority = clampBant(raw.authority);
  const timeline = clampBant(raw.timeline);
  return {
    need,
    budget,
    authority,
    timeline,
    total: need + budget + authority + timeline,
  };
}

/**
 * Demo lead bands:
 * 0–3 Cold, 4–7 Warm, 8–12 Hot
 */
export function resolveDemoLeadCategory(
  total: number,
  analysis: DemoAnalysis
): LeadCategory {
  if (analysis.detected_intent === "support_request") return "support";
  if (
    analysis.detected_intent === "complaint" &&
    total < 4 &&
    !analysis.flags.ready_to_book
  ) {
    return "not_qualified";
  }

  if (total >= 8) return "hot";
  if (total >= 4) return "warm";
  return "cold";
}

/** Promote to hot when BANT is strong (all four flags, or need+budget+timeline with high score). */
export function applyDemoHotLeadPromotion(
  category: LeadCategory,
  qualProgress: DemoQualificationProgress,
  total: number
): LeadCategory {
  if (category === "support" || category === "not_qualified") return category;
  if (isQualificationStrong(qualProgress) && total >= 8) return "hot";
  const coreCaptured =
    qualProgress.need && qualProgress.budget && qualProgress.timeline;
  if (coreCaptured && total >= 7) return "hot";
  return category;
}
