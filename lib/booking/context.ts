import { getBookingSettings } from "@/lib/calendar/calendar-settings-data";
import { resolveMeetingTypeFromAnalysis } from "@/lib/calendar/create-booking";
import { getMeetingType } from "@/lib/calendar/meeting-types";
import { buildCalendlyEmbedUrl } from "@/lib/calendly/client";
import {
  resolveActiveBookingProvider,
  resolveCalendlyUrlForMeetingType,
} from "./provider";
import type { WorkflowAnalysis } from "@/lib/platform/workflow/schemas";

export interface WorkflowBookingContext {
  suggestBooking: boolean;
  bookingProvider: "google_calendar" | "calendly" | null;
  meetingTypeKey: string;
  calendlyEmbedUrl: string | null;
  pendingCalendly: boolean;
}

export async function buildWorkflowBookingContext(params: {
  organizationId: string;
  analysis: WorkflowAnalysis;
  serviceInterest?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  conversationId?: string | null;
  leadId?: string | null;
}): Promise<WorkflowBookingContext> {
  const settings = await getBookingSettings(params.organizationId);
  const meetingTypeKey = resolveMeetingTypeFromAnalysis(
    params.analysis.detected_intent,
    params.serviceInterest
  );
  const meetingType = getMeetingType(settings.meeting_types, meetingTypeKey);
  const provider = await resolveActiveBookingProvider(
    params.organizationId,
    meetingTypeKey
  );

  if (provider === "calendly" && meetingType) {
    const baseUrl = resolveCalendlyUrlForMeetingType(settings, meetingType);
    const calendlyEmbedUrl = baseUrl
      ? buildCalendlyEmbedUrl({
          schedulingUrl: baseUrl,
          name: params.customerName,
          email: params.customerEmail,
          conversationId: params.conversationId,
          leadId: params.leadId,
        })
      : null;

    return {
      suggestBooking: true,
      bookingProvider: "calendly",
      meetingTypeKey,
      calendlyEmbedUrl,
      pendingCalendly: Boolean(calendlyEmbedUrl),
    };
  }

  return {
    suggestBooking: true,
    bookingProvider: provider === "calendly" ? "calendly" : "google_calendar",
    meetingTypeKey,
    calendlyEmbedUrl: null,
    pendingCalendly: false,
  };
}
