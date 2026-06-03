import type { HumanHandoffSettings } from "@/lib/platform/settings-types";
import type { LeadCategory } from "@/lib/platform/types";
import type { WorkflowAnalysis } from "./schemas";

const LOW_CONFIDENCE_THRESHOLD = 0.55;

export function evaluateHandoff(params: {
  analysis: WorkflowAnalysis;
  leadCategory: LeadCategory;
  handoffSettings: HumanHandoffSettings;
}): boolean {
  const { analysis, leadCategory, handoffSettings } = params;

  if (!handoffSettings.enabled) return false;

  const t = handoffSettings.triggers;

  if (t.customer_asks_human) {
    if (analysis.detected_intent === "human_request" || analysis.flags.human_requested) {
      return true;
    }
  }

  if (t.lead_becomes_hot && leadCategory === "hot") return true;

  if (t.ready_to_pay && analysis.flags.ready_to_pay) return true;

  if (t.custom_pricing && analysis.flags.custom_pricing_requested) return true;

  if (
    t.complaint_detected &&
    (analysis.detected_intent === "complaint" || analysis.flags.complaint_detected)
  ) {
    return true;
  }

  if (t.ai_confidence_low && analysis.ai_confidence < LOW_CONFIDENCE_THRESHOLD) {
    return true;
  }

  if (analysis.conversation_stage === "handoff") return true;

  return false;
}

export function resolveConversationStatus(params: {
  handoffRequired: boolean;
  stage: WorkflowAnalysis["conversation_stage"];
}): import("@/lib/platform/types").ConversationStatus {
  if (params.handoffRequired || params.stage === "handoff") {
    return "human_needed";
  }
  if (params.stage === "booking") {
    return "booked";
  }
  if (params.stage === "close") {
    return "closed";
  }
  return "ai_handling";
}

const BOOKING_QUALIFIED_STAGES = [
  "qualification",
  "recommendation",
  "objection_handling",
  "booking",
] as const;

/** Offer scheduling only for warm or hot leads with booking readiness signals. */
export function shouldSuggestBooking(params: {
  analysis: WorkflowAnalysis;
  leadCategory: LeadCategory;
}): boolean {
  const { analysis, leadCategory } = params;
  if (leadCategory !== "hot" && leadCategory !== "warm") {
    return false;
  }

  if (analysis.suggest_booking) return true;
  if (analysis.detected_intent === "booking_request") return true;

  return BOOKING_QUALIFIED_STAGES.includes(
    analysis.conversation_stage as (typeof BOOKING_QUALIFIED_STAGES)[number]
  );
}

/** Hot-lead handoff must not block scheduling when the customer is actively booking. */
export function shouldDeferHandoffForBooking(params: {
  analysis: WorkflowAnalysis;
  bookingEligible: boolean;
}): boolean {
  const { analysis, bookingEligible } = params;
  if (!bookingEligible) return false;

  if (analysis.detected_intent === "booking_request") return true;
  if (analysis.suggest_booking) return true;
  if (analysis.conversation_stage === "booking") return true;

  return false;
}
