import {
  getBookingForConversation,
  listProfiles,
  saveBooking,
  saveConversation,
  saveLead,
  saveNotification,
} from "@/lib/platform/data";
import { getOrganizationSettings } from "@/lib/platform/settings-data";
import type { Agent, Booking, Conversation, Lead } from "@/lib/platform/types";
import { getCalendarSettings } from "./calendar-settings-data";
import { createGoogleCalendarEvent } from "./google-calendar-api";
import { getMeetingType, meetingTypeLabel } from "./meeting-types";
import { assignStaffForBooking } from "./staff-assignment";
import { getGoogleConnectedEmail, hasGoogleCalendarOAuth } from "./google-tokens";
import type { MeetingTypeKey } from "./types";

export class CalendarBookingError extends Error {
  constructor(
    message: string,
    public code:
      | "NOT_CONNECTED"
      | "INVALID_SLOT"
      | "INVALID_MEETING_TYPE"
      | "SLOT_TAKEN"
      | "CALENDAR_API_FAILED"
  ) {
    super(message);
    this.name = "CalendarBookingError";
  }
}

export async function createCalendarBooking(params: {
  organizationId: string;
  agent: Agent;
  conversation: Conversation;
  lead: Lead;
  meetingTypeKey: string;
  startIso: string;
  endIso: string;
  notes?: string;
}): Promise<Booking> {
  const {
    organizationId,
    agent,
    conversation,
    lead,
    meetingTypeKey,
    startIso,
    endIso,
  } = params;

  const settings = await getCalendarSettings(organizationId);
  const meetingType = getMeetingType(settings.meeting_types, meetingTypeKey);
  if (!meetingType) {
    throw new CalendarBookingError("Invalid meeting type.", "INVALID_MEETING_TYPE");
  }

  const connected = await hasGoogleCalendarOAuth(organizationId);
  if (!connected) {
    throw new CalendarBookingError(
      "Google Calendar is not connected. Ask your admin to connect it in Integrations.",
      "NOT_CONNECTED"
    );
  }

  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new CalendarBookingError("Invalid time slot.", "INVALID_SLOT");
  }

  const existing = await getBookingForConversation(conversation.id);
  if (
    existing &&
    existing.starts_at === startIso &&
    (existing.status === "scheduled" || existing.status === "confirmed")
  ) {
    return existing;
  }

  const orgSettings = await getOrganizationSettings(organizationId);
  const profiles = await listProfiles(organizationId);

  const staff = await assignStaffForBooking({
    organizationId,
    settings,
    meetingType,
    conversation,
    profiles,
  });
  const assignedProfileId = staff.profileId;

  const customerEmail = lead.email ?? conversation.customer_email ?? null;
  const customerName = lead.full_name ?? conversation.customer_name ?? "Customer";
  const title = `${meetingType.label} — ${customerName}`;
  const dateStr = startIso.slice(0, 10);
  const timeStr = start.toISOString().slice(11, 16);

  const attendeeEmails: string[] = [];
  if (customerEmail) attendeeEmails.push(customerEmail);
  const organizerEmail =
    settings.connected_calendar_email ??
    (await getGoogleConnectedEmail(organizationId));
  const staffEmail = staff.staffEmail ?? organizerEmail;
  if (staffEmail) attendeeEmails.push(staffEmail);
  else if (organizerEmail) attendeeEmails.push(organizerEmail);

  let googleEventId: string | null = null;
  let meetingLink: string | null = null;

  try {
    const event = await createGoogleCalendarEvent({
      organizationId,
      calendarId: settings.calendar_id,
      summary: title,
      description: [
        `Meeting type: ${meetingType.label}`,
        lead.service_interest ? `Interest: ${lead.service_interest}` : null,
        conversation.summary ? `Summary: ${conversation.summary}` : null,
        params.notes,
      ]
        .filter(Boolean)
        .join("\n"),
      startIso,
      endIso,
      timezone: settings.timezone,
      attendeeEmails,
      addGoogleMeet:
        settings.enable_google_meet &&
        meetingType.location_type === "google_meet",
    });
    googleEventId = event.eventId;
    meetingLink = event.htmlLink ?? null;
  } catch (err) {
    console.error("[createCalendarBooking] Google event failed", err);
    throw new CalendarBookingError(
      err instanceof Error ? err.message : "Could not create calendar event.",
      "CALENDAR_API_FAILED"
    );
  }

  const now = new Date().toISOString();
  const booking = await saveBooking({
    id: existing?.id ?? crypto.randomUUID(),
    organization_id: organizationId,
    agent_id: agent.id,
    lead_id: lead.id,
    conversation_id: conversation.id,
    title,
    customer_name: customerName,
    customer_email: customerEmail,
    customer_phone: lead.phone ?? conversation.customer_phone ?? null,
    service_needed: lead.service_interest ?? meetingType.label,
    meeting_type: meetingTypeKey,
    meeting_date: dateStr,
    meeting_time: timeStr,
    starts_at: startIso,
    ends_at: endIso,
    duration_minutes: meetingType.duration_minutes,
    assigned_to: assignedProfileId,
    staff_email: staffEmail,
    meeting_link: meetingLink,
    google_calendar_event_id: googleEventId,
    provider: "google_calendar",
    external_event_id: googleEventId,
    location_type: meetingType.location_type,
    status: "confirmed",
    notes: params.notes ?? `Booked via AI chat (${meetingTypeKey}).`,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  });

  await saveLead({
    ...lead,
    lead_status: lead.lead_status === "customer" ? lead.lead_status : "qualified",
    next_action: `Meeting scheduled: ${meetingType.label} on ${dateStr} at ${timeStr}`,
    updated_at: now,
  });

  await saveConversation({
    ...conversation,
    status: "booked",
    conversation_stage: "booking",
    recommended_next_action: `Confirmed ${meetingType.label}`,
    updated_at: now,
  });

  if (orgSettings.notifications.events.new_booking !== false) {
    await saveNotification({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      type: "booking_created",
      title: "New meeting booked",
      message: `${customerName} booked a ${meetingType.label} for ${dateStr} at ${timeStr}.`,
      status: "unread",
      metadata: {
        booking_id: booking.id,
        lead_id: lead.id,
        conversation_id: conversation.id,
        meeting_type: meetingTypeKey,
      },
      created_at: now,
    });
  }

  return booking;
}

export function resolveMeetingTypeFromAnalysis(
  intent: string,
  serviceInterest?: string | null
): MeetingTypeKey {
  if (intent === "booking_request") return "sales_consultation";
  if (serviceInterest?.toLowerCase().includes("demo")) return "product_demo";
  if (serviceInterest?.toLowerCase().includes("support")) return "support_call";
  if (intent === "pricing_question") return "strategy_session";
  return "sales_consultation";
}

export { meetingTypeLabel };
