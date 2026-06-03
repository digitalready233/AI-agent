import type { LeadScoringSettings } from "@/lib/platform/settings-types";
import type { LeadCategory } from "@/lib/platform/types";
import type { WorkflowAnalysis } from "./schemas";
import { categoryFromSettings } from "./scoring";

/**
 * Maps workflow analysis to platform lead_category using org Lead Scoring settings.
 */
export function resolveLeadCategory(
  analysis: WorkflowAnalysis,
  scoreTotal: number,
  scoring: LeadScoringSettings
): LeadCategory {
  if (analysis.detected_intent === "support_request") {
    return "support";
  }

  if (
    analysis.detected_intent === "complaint" &&
    scoreTotal < scoring.warm_threshold &&
    !analysis.flags.ready_to_pay
  ) {
    return "not_qualified";
  }

  const bantCategory = categoryFromSettings(scoreTotal, scoring);

  if (
    bantCategory === "cold" &&
    scoreTotal < scoring.cold_threshold &&
    (analysis.detected_intent === "general_enquiry" || scoreTotal <= scoring.cold_threshold / 2) &&
    !analysis.suggest_booking
  ) {
    return "not_qualified";
  }

  return bantCategory;
}
