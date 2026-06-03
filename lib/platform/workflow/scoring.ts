import type { LeadScoringSettings } from "@/lib/platform/settings-types";
import type { LeadCategory } from "@/lib/platform/types";
import type { WorkflowLeadScores } from "./types";

function clampBant(n: number): number {
  return Math.max(0, Math.min(3, Math.round(n)));
}

/** Map LLM 0–3 BANT score to org-configured min–max range per dimension. */
export function scaleDimensionScore(raw: number, min: number, max: number): number {
  const bant = clampBant(raw);
  if (max <= min) return min;
  return Math.round(min + (bant / 3) * (max - min));
}

export function sumLeadScores(
  raw: { need: number; budget: number; authority: number; timeline: number },
  scoring: LeadScoringSettings
): WorkflowLeadScores {
  const need = scaleDimensionScore(raw.need, scoring.need_min, scoring.need_max);
  const budget = scaleDimensionScore(raw.budget, scoring.budget_min, scoring.budget_max);
  const authority = scaleDimensionScore(
    raw.authority,
    scoring.authority_min,
    scoring.authority_max
  );
  const timeline = scaleDimensionScore(
    raw.timeline,
    scoring.timeline_min,
    scoring.timeline_max
  );
  return {
    need,
    budget,
    authority,
    timeline,
    total: need + budget + authority + timeline,
  };
}

export function categoryFromSettings(
  total: number,
  scoring: LeadScoringSettings
): LeadCategory {
  if (total >= scoring.hot_threshold) return "hot";
  if (total >= scoring.warm_threshold) return "warm";
  if (total >= scoring.cold_threshold) return "cold";
  return "cold";
}
