import type { LeadRecord } from "../types";
import type { CustomerIntent } from "../orchestrator/types";
import { analyzeLeadProfile } from "./lead-profile";
import type { ConversationStage } from "./types";

export function resolveConversationStage(params: {
  isFirstUserMessage: boolean;
  intent: CustomerIntent;
  lead?: LeadRecord;
  previousStage?: ConversationStage;
}): ConversationStage {
  const { intent, lead, isFirstUserMessage, previousStage } = params;

  if (intent === "complaint") {
    return "human_handoff";
  }

  if (intent === "booking_request") {
    return "booking";
  }

  if (intent === "support_request") {
    return previousStage === "follow_up" ? "follow_up" : "human_handoff";
  }

  if (isFirstUserMessage) {
    return "new_visitor";
  }

  const { collected, missing } = analyzeLeadProfile(lead);
  const hasBudget = collected.includes("budgetRange");
  const hasTimeline = collected.includes("timeline");
  const hasContact =
    collected.includes("fullName") &&
    (collected.includes("phone") || collected.includes("email"));
  const hasService = collected.includes("serviceNeeded");

  if (
    hasContact &&
    hasService &&
    hasBudget &&
    hasTimeline &&
    (intent === "sales_enquiry" || intent === "pricing_question")
  ) {
    return "recommendation";
  }

  if (hasService && (hasBudget || hasTimeline) && missing.length <= 3) {
    return "qualification";
  }

  if (
    intent === "sales_enquiry" ||
    intent === "pricing_question" ||
    intent === "general_question"
  ) {
    return collected.length >= 1 ? "qualification" : "discovery";
  }

  return previousStage ?? "discovery";
}
