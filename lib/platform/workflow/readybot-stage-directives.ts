import type { WorkflowStage } from "./schemas";
import {
  inferReadybotPipelineStep,
  type ReadybotPipelineStep,
} from "./readybot-stage-engine";

/** Injected into workflow response generation for ReadyBot-style agents. */
export function readybotStageDirective(
  stage: WorkflowStage,
  missingLeadFields: string[],
  extraction?: import("./schemas").WorkflowAnalysis["lead_extraction"]
): string {
  const step = extraction
    ? inferReadybotPipelineStep(extraction)
    : workflowStageToPipelineStep(stage);
  const missing =
    missingLeadFields.length > 0
      ? ` Missing fields: ${missingLeadFields.join(", ")} — collect one only.`
      : "";

  const map: Record<ReadybotPipelineStep, string> = {
    onboarding: !extraction?.full_name?.trim()
      ? "Onboarding: collect **name** only. Do not ask discovery, stack, team, or budget questions."
      : "Onboarding: you have their name. Ask **how you can help** / what they need (one question). Do not ask growth goals, stack, team, or budget yet.",
    discovery:
      "Discovery: ask **only one** question — their biggest **growth milestone** in the next 6 months (or new campaign / fix ads / build from scratch). Do not ask stack, team, or budget. Do not combine questions.",
    stack:
      "Stack: ask **exactly one** question about **Paid ads**, **Social/branding**, or **Web/ops** (pick the line that fits their need). Do not ask team or budget until they answer.",
    team:
      "Team: ask **only** whether they use an **in-house team plus agency**, or **full agency** management. Do not ask budget or timing until answered.",
    budget_timing:
      "Budget & Timing: only now — ask **one** question about budget tier (A/B/C) **or** when they want to start. **Never quote specific prices.** Do not skip to close until both budget and timeline are clear.",
    close:
      "Close: one-sentence summary, then ask for **email and phone** OR point to the **scheduler** (one ask). Only after onboarding through budget/timing are complete.",
  };

  if (stage === "handoff") {
    return (
      "Handoff: customer needs a human or is hot. Confirm contact if missing. " +
      "Do not continue discovery questions. Not a human yourself." +
      missing
    );
  }

  if (stage === "objection_handling") {
    return (
      "Objection: one sentence empathy + one sentence value. **No price quotes.** " +
      "One follow-up question aligned with the current pipeline step only." +
      missing
    );
  }

  return (map[step] ?? map.discovery) + missing;
}

function workflowStageToPipelineStep(stage: WorkflowStage): ReadybotPipelineStep {
  switch (stage) {
    case "greeting":
      return "onboarding";
    case "discovery":
      return "discovery";
    case "qualification":
      return "stack";
    case "booking":
      return "close";
    case "handoff":
      return "close";
    default:
      return "discovery";
  }
}

export function isReadybotStyleAgent(agent: {
  name?: string | null;
  nickname?: string | null;
  company_product_name?: string | null;
  system_prompt?: string | null;
}): boolean {
  const n = `${agent.name ?? ""} ${agent.nickname ?? ""}`.toLowerCase();
  const company = (agent.company_product_name ?? "").toLowerCase();
  const prompt = (agent.system_prompt ?? "").toLowerCase();
  return (
    n.includes("readybot") ||
    n.includes("ready bot") ||
    prompt.includes("readybot") ||
    (company.includes("digital ready") &&
      (agent.name ?? "").toLowerCase().includes("bot"))
  );
}
