import type { WorkflowAnalysis } from "./schemas";
import type { ReadybotPipelineStep } from "./readybot-stage-engine";

export type ReadybotMicroStep =
  | "goal_clarify"
  | "milestone"
  | "stack_ads"
  | "stack_social"
  | "stack_web_ops"
  | null;

export type StackPillar = "Ads" | "Social" | "Web/Ops";

function hasText(v: string | undefined | null): boolean {
  return Boolean(v?.trim());
}

const BROAD_GOAL_RE =
  /\b(grow|growth|marketing|digital|online|social media|brand|more sales|visibility|presence)\b/i;

const SPECIFIC_MILESTONE_RE =
  /\b(\d+\s*%|\d+k|\d+\s*(followers|leads|sales|customers|months)|launch|revenue|roi|conversion)\b/i;

/** True when the prospect stated a broad goal but not followers / engagement / conversions focus. */
export function needsDiscoveryGoalClarify(
  extraction: WorkflowAnalysis["lead_extraction"]
): boolean {
  if (hasText(extraction.discovery_goal_focus)) return false;
  if (!hasText(extraction.service_interest) && !hasText(extraction.growth_milestone)) {
    return false;
  }
  if (
    hasText(extraction.growth_milestone) &&
    SPECIFIC_MILESTONE_RE.test(extraction.growth_milestone!)
  ) {
    return false;
  }
  const signal =
    extraction.service_interest?.trim() ||
    extraction.growth_milestone?.trim() ||
    "";
  if (!signal) return false;
  if (BROAD_GOAL_RE.test(signal)) return true;
  return hasText(extraction.service_interest) && !hasText(extraction.growth_milestone);
}

export function inferStackPillar(
  serviceInterest?: string | null
): StackPillar {
  const s = (serviceInterest ?? "").toLowerCase();
  if (/ads|paid|meta|google|ppc|campaign|advert/.test(s)) return "Ads";
  if (/social|instagram|tiktok|brand|content|follower|engagement/.test(s)) {
    return "Social";
  }
  return "Web/Ops";
}

export function inferReadybotMicroStep(
  extraction: WorkflowAnalysis["lead_extraction"],
  pipelineStep: ReadybotPipelineStep
): ReadybotMicroStep {
  if (pipelineStep === "discovery") {
    if (needsDiscoveryGoalClarify(extraction)) return "goal_clarify";
    if (!hasText(extraction.growth_milestone)) return "milestone";
    return null;
  }
  if (pipelineStep === "stack") {
    const pillar = inferStackPillar(extraction.service_interest);
    if (pillar === "Ads") return "stack_ads";
    if (pillar === "Social") return "stack_social";
    return "stack_web_ops";
  }
  return null;
}

export function readybotMicroStepLabel(step: ReadybotMicroStep): string | null {
  if (!step) return null;
  const map: Record<NonNullable<ReadybotMicroStep>, string> = {
    goal_clarify: "Discovery · goal focus",
    milestone: "Discovery · milestone",
    stack_ads: "Stack · paid ads",
    stack_social: "Stack · social",
    stack_web_ops: "Stack · web/ops",
  };
  return map[step];
}
