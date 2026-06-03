import type { LeadCategory } from "@/lib/platform/types";
import type { DemoAnalysis } from "./demo-schemas";
import type { HandoffReason } from "./types";

/** When to escalate a demo to human takeover. */
export function resolveDemoHandoffRequired(params: {
  analysis: DemoAnalysis;
  leadCategory: LeadCategory;
}): boolean {
  const { analysis, leadCategory } = params;
  return resolveHandoffReason({ analysis, leadCategory }) != null;
}

/** Primary reason for handoff (first match wins). */
export function resolveHandoffReason(params: {
  analysis: DemoAnalysis;
  leadCategory: LeadCategory;
}): HandoffReason | null {
  const { analysis, leadCategory } = params;
  const f = analysis.flags;

  if (f.human_requested) return "human_requested";
  if (f.ready_to_pay) return "ready_to_pay";
  if (f.custom_pricing_requested) return "custom_pricing";
  if (f.complaint_detected) return "complaint";
  if (f.outside_knowledge) return "outside_knowledge";
  if (f.low_confidence) return "low_confidence";
  if (f.wants_final_confirmation) return "final_confirmation";
  if (f.wants_negotiation) return "negotiation";
  if (leadCategory === "hot") return "hot_lead";
  if (analysis.handoff_required) return "manual";
  if (f.serious_objection) return "outside_knowledge";

  return null;
}

export function handoffReasonLabel(reason: string | null | undefined): string {
  const labels: Record<string, string> = {
    hot_lead: "Hot lead",
    human_requested: "Customer asked for a human",
    ready_to_pay: "Ready to pay",
    custom_pricing: "Custom pricing request",
    complaint: "Complaint",
    outside_knowledge: "Outside knowledge base",
    low_confidence: "Low AI confidence",
    final_confirmation: "Final confirmation needed",
    negotiation: "Negotiation requested",
    manual: "Manual handoff",
  };
  return labels[reason ?? ""] ?? reason ?? "Human closer needed";
}

/** Notify admins when a demo prospect becomes hot. */
export function resolveDemoHotLeadAdminAlert(params: {
  leadCategory: LeadCategory;
  analysis: DemoAnalysis;
  previousCategory?: LeadCategory | null;
}): boolean {
  const { leadCategory, analysis, previousCategory } = params;
  if (leadCategory !== "hot") return false;
  if (previousCategory === "hot") return false;
  return (
    analysis.flags.ready_to_book ||
    analysis.suggest_booking ||
    analysis.flags.ready_to_pay ||
    Boolean(analysis.lead_extraction.budget?.trim()) ||
    Boolean(analysis.lead_extraction.timeline?.trim())
  );
}

export function resolveDemoBookingRecommended(params: {
  analysis: DemoAnalysis;
  leadCategory: LeadCategory;
  handoffRequired: boolean;
  qualificationStrong?: boolean;
}): boolean {
  const { analysis, leadCategory } = params;
  const warmOrHot = leadCategory === "hot" || leadCategory === "warm";
  if (!warmOrHot) return false;

  const hasSeriousBant = Boolean(
    analysis.lead_extraction.budget?.trim() && analysis.lead_extraction.timeline?.trim()
  );

  return (
    analysis.suggest_booking ||
    analysis.flags.ready_to_book ||
    analysis.flags.ready_to_pay ||
    analysis.flags.asks_next_step ||
    analysis.flags.requests_consultation ||
    (leadCategory === "hot" &&
      (hasSeriousBant || params.qualificationStrong || analysis.flags.ready_to_book)) ||
    (leadCategory === "warm" &&
      (hasSeriousBant || analysis.current_demo_stage === "booking") &&
      (analysis.suggest_booking || analysis.flags.ready_to_book))
  );
}
