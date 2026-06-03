import type { AgentRole } from "../config";

/** Intent labels produced by the orchestrator classifier */
export const CUSTOMER_INTENTS = [
  "sales_enquiry",
  "support_request",
  "pricing_question",
  "booking_request",
  "complaint",
  "general_question",
] as const;

export type CustomerIntent = (typeof CUSTOMER_INTENTS)[number];

export const LEAD_STAGES = [
  "discovery",
  "qualification",
  "closing",
  "support_handling",
  "n_a",
] as const;

export type LeadStageHint = (typeof LEAD_STAGES)[number];

export interface IntentClassification {
  intent: CustomerIntent;
  inferred_service?: string;
  lead_stage: LeadStageHint;
  brief_reason: string;
}

export interface OrchestratorTurnResult {
  /** KB text injected into the system prompt (retrieved sections or full fallback) */
  knowledgeForPrompt: string;
  /** Role passed to buildSystemPrompt after intent + client override */
  effectiveRole: AgentRole;
  intent: IntentClassification;
  retrievalSectionTitles: string[];
}

export function mapIntentToRole(
  intent: CustomerIntent,
  clientRole?: AgentRole
): AgentRole {
  if (clientRole && clientRole !== "unified") return clientRole;
  switch (intent) {
    case "sales_enquiry":
    case "pricing_question":
      return "sales";
    case "support_request":
    case "complaint":
      return "support";
    case "booking_request":
      return "appointment";
    default:
      return "unified";
  }
}
