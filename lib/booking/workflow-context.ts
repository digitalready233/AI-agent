import type { WorkflowAnalysis } from "@/lib/platform/workflow/schemas";
import { getMeetingTypeBySlug, listMeetingTypes } from "./meeting-types-data";
import { parsePreferredDateTime } from "./parse-preferred-datetime";

export interface InternalWorkflowBookingContext {
  bookingRecommended: boolean;
  suggestedMeetingType: string | null;
  suggestedMeetingTypeId: string | null;
  preferredDateTime: string | null;
  bookingProvider: "internal";
  nextAction: string;
}

function resolveMeetingSlug(
  analysis: WorkflowAnalysis,
  serviceInterest?: string | null
): string {
  if (analysis.detected_intent === "booking_request") return "sales_consultation";
  if (serviceInterest?.toLowerCase().includes("demo")) return "product_demo";
  if (serviceInterest?.toLowerCase().includes("support")) return "support_call";
  if (analysis.detected_intent === "pricing_question") return "sales_consultation";
  return "sales_consultation";
}

export async function buildInternalWorkflowBookingContext(params: {
  organizationId: string;
  analysis: WorkflowAnalysis;
  serviceInterest?: string | null;
  customerMessage?: string;
  bookingRecommended: boolean;
}): Promise<InternalWorkflowBookingContext | null> {
  if (!params.bookingRecommended) return null;

  await listMeetingTypes(params.organizationId);
  const slug = resolveMeetingSlug(params.analysis, params.serviceInterest);
  const meetingType = await getMeetingTypeBySlug(params.organizationId, slug);
  const preferredDateTime = params.customerMessage
    ? parsePreferredDateTime(params.customerMessage)
    : null;

  const nextAction = preferredDateTime
    ? "confirm_slot"
    : "collect_preferred_time";

  return {
    bookingRecommended: true,
    suggestedMeetingType: meetingType?.slug ?? slug,
    suggestedMeetingTypeId: meetingType?.id ?? null,
    preferredDateTime,
    bookingProvider: "internal",
    nextAction,
  };
}
