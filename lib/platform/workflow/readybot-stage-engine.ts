import type { WorkflowAnalysis, WorkflowStage } from "./schemas";

/** Ordered sales pipeline — never skip or combine steps. */
export type ReadybotPipelineStep =
  | "onboarding"
  | "discovery"
  | "stack"
  | "team"
  | "budget_timing"
  | "close";

export const READYBOT_PIPELINE_STEPS: readonly ReadybotPipelineStep[] = [
  "onboarding",
  "discovery",
  "stack",
  "team",
  "budget_timing",
  "close",
] as const;

const WORKFLOW_STAGE_ORDER: WorkflowStage[] = [
  "greeting",
  "discovery",
  "qualification",
  "recommendation",
  "objection_handling",
  "booking",
  "handoff",
  "close",
];

function hasText(v: string | undefined | null): boolean {
  return Boolean(v?.trim());
}

export function inferReadybotPipelineStep(
  extraction: WorkflowAnalysis["lead_extraction"]
): ReadybotPipelineStep {
  if (!hasText(extraction.full_name)) return "onboarding";
  if (!hasText(extraction.service_interest)) return "onboarding";
  if (!hasText(extraction.growth_milestone)) return "discovery";
  if (!hasText(extraction.current_stack)) return "stack";
  if (!hasText(extraction.team_structure)) return "team";
  const hasBudget =
    hasText(extraction.budget_tier) || hasText(extraction.budget);
  if (!hasBudget || !hasText(extraction.timeline)) return "budget_timing";
  if (!hasText(extraction.email) && !hasText(extraction.phone)) {
    return "close";
  }
  return "close";
}

/** Maps pipeline step → persisted workflow stage enum. */
export function readybotStepToWorkflowStage(
  step: ReadybotPipelineStep
): WorkflowStage {
  switch (step) {
    case "onboarding":
      return "greeting";
    case "discovery":
      return "discovery";
    case "stack":
    case "team":
    case "budget_timing":
      return "qualification";
    case "close":
      return "booking";
  }
}

export function workflowStageRank(stage: WorkflowStage): number {
  const i = WORKFLOW_STAGE_ORDER.indexOf(stage);
  return i >= 0 ? i : 0;
}

/** Clamp LLM stage so the conversation cannot advance past captured pipeline data. */
export function capWorkflowStageToStep(
  llmStage: WorkflowStage,
  step: ReadybotPipelineStep
): WorkflowStage {
  const allowed = readybotStepToWorkflowStage(step);
  return workflowStageRank(llmStage) > workflowStageRank(allowed)
    ? allowed
    : llmStage;
}

/**
 * ReadyBot: stage comes from lead/memory state, not free-form LLM jumps.
 * Handoff stage is set only when evaluateReadybotHandoff is true.
 */
export function applyReadybotStageGuard(
  analysis: WorkflowAnalysis,
  handoffRequired: boolean
): WorkflowAnalysis {
  if (handoffRequired) {
    return { ...analysis, conversation_stage: "handoff" };
  }
  const step = inferReadybotPipelineStep(analysis.lead_extraction);
  return {
    ...analysis,
    conversation_stage: readybotStepToWorkflowStage(step),
    recommended_next_action: readybotRecommendedAction(step),
  };
}

function readybotRecommendedAction(step: ReadybotPipelineStep): string {
  const map: Record<ReadybotPipelineStep, string> = {
    onboarding: "Collect name, then how you can help (one question at a time).",
    discovery: "Ask one growth-milestone question only.",
    stack: "Ask one stack question (ads, social, or web/ops) only.",
    team: "Ask internal vs external team support only.",
    budget_timing: "Ask budget tier and timeline only — never quote prices.",
    close: "Ask for email/phone or offer scheduler only.",
  };
  return map[step];
}

/** Handoff only when customer asks for human, custom pricing, or lead is hot. */
export function evaluateReadybotHandoff(params: {
  analysis: WorkflowAnalysis;
  leadCategory: import("@/lib/platform/types").LeadCategory;
}): boolean {
  const { analysis, leadCategory } = params;
  if (
    analysis.detected_intent === "human_request" ||
    analysis.flags.human_requested
  ) {
    return true;
  }
  if (analysis.flags.custom_pricing_requested) return true;
  if (leadCategory === "hot") return true;
  return false;
}

export function readybotBookingAllowed(
  step: ReadybotPipelineStep,
  leadCategory: import("@/lib/platform/types").LeadCategory
): boolean {
  return step === "close" && (leadCategory === "hot" || leadCategory === "warm");
}

/** Analyzer instructions injected for ReadyBot agents. */
export const READYBOT_ANALYZER_STAGE_RULES = `## ReadyBot pipeline (enforce in conversation_stage + lead_extraction)

Always set conversation_stage from the **earliest incomplete** step (never skip ahead):
- greeting: onboarding — missing name OR missing service_interest (initial need)
- discovery: have name + need, missing growth_milestone
- qualification: have growth_milestone; missing current_stack OR team_structure OR (budget/timeline)
- booking: stack + team + budget/timeline captured; missing email AND phone
- handoff: only when human_requested, custom_pricing_requested, or lead is hot (do not use handoff stage otherwise)

Per turn, fill lead_extraction from the full thread:
- full_name, service_interest (onboarding need), growth_milestone, current_stack, team_structure, budget_tier, budget, timeline, email, phone

Flags:
- human_requested if they want a person
- custom_pricing_requested if they want a custom quote beyond tiers
- Never set suggest_booking true until stack, team, and budget/timing are known.

Do not combine multiple pipeline questions in recommended_next_action.`;
