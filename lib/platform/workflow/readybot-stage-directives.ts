import type { WorkflowStage } from "./schemas";

/** Injected into workflow response generation for ReadyBot-style agents. */
export function readybotStageDirective(
  stage: WorkflowStage,
  missingLeadFields: string[]
): string {
  const needsName = missingLeadFields.includes("name");
  const missing =
    missingLeadFields.length > 0
      ? ` Missing CRM fields: ${missingLeadFields.join(", ")} — ask for one only.`
      : "";

  const map: Record<WorkflowStage, string> = {
    greeting: needsName
      ? "Onboarding: they were already welcomed. Reply warmly in 1 sentence, then ask for their **name** only."
      : "Onboarding: you have their name. Greet them by name in 1 sentence, then ask **how you can help** (one question). Do not skip to growth goals yet.",
    discovery:
      "Discovery: answer their point in 1 sentence if needed, then ONE stack question (ads / social / web).",
    qualification: `Qualification: ONE question — team model OR budget tier OR timeline.${missing}`,
    recommendation:
      "Recommend: name the best pillar in 1 sentence + 1 question. No feature dump.",
    objection_handling:
      "Objection: 1 sentence empathy + 1 sentence value. One follow-up question. No price quotes.",
    booking:
      "Close: 1 sentence summary + ask email/phone OR point to scheduler. Bold the ask only.",
    handoff:
      "Handoff: 1–2 sentences. Confirm contact if missing. Not human.",
    close:
      "Close: 1 sentence thanks + 1 sentence next step only.",
  };

  return map[stage] ?? map.discovery;
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
