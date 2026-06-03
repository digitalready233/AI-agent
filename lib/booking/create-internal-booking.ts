import {
  saveBooking,
  saveConversation,
  saveLead,
  saveNotification,
} from "@/lib/platform/data";
import type { Agent, Booking, Conversation, Lead } from "@/lib/platform/types";
import { getMeetingTypeBySlug } from "./meeting-types-data";
import { getBookingSettings } from "./settings-data";

export class InternalBookingError extends Error {
  constructor(
    message: string,
    public code: "INVALID_SLOT" | "INVALID_MEETING_TYPE" | "SLOT_TAKEN"
  ) {
    super(message);
    this.name = "InternalBookingError";
  }
}

function isoToDateAndTime(startIso: string, endIso: string, timezone: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new InternalBookingError("Invalid time slot.", "INVALID_SLOT");
  }
  const meeting_date = startIso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  const start_time = `${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())}:00`;
  const end_time = `${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}:00`;
  return {
    meeting_date,
    start_time,
    end_time,
    meeting_time: start_time.slice(0, 5),
    duration_minutes: Math.round((end.getTime() - start.getTime()) / 60000),
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    timezone,
  };
}

export async function createInternalBooking(params: {
  organizationId: string;
  agent: Agent;
  conversation: Conversation;
  lead: Lead;
  meetingTypeSlug: string;
  startIso: string;
  endIso: string;
  notes?: string;
}): Promise<Booking> {
  const {
    organizationId,
    agent,
    conversation,
    lead,
    meetingTypeSlug,
    startIso,
    endIso,
    notes,
  } = params;

  const meetingType = await getMeetingTypeBySlug(organizationId, meetingTypeSlug);
  if (!meetingType || meetingType.status !== "active") {
    throw new InternalBookingError("Invalid meeting type.", "INVALID_MEETING_TYPE");
  }

  const settings = await getBookingSettings(organizationId);
  const assignedProfileId =
    meetingType.assigned_staff ??
    settings.default_assigned_profile_id ??
    conversation.assigned_to ??
    null;

  const times = isoToDateAndTime(startIso, endIso, settings.timezone);
  const now = new Date().toISOString();
  const title = `${meetingType.name} — ${lead.full_name ?? "Customer"}`;

  const booking: Booking = {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    agent_id: agent.id,
    lead_id: lead.id,
    conversation_id: conversation.id,
    title,
    customer_name: lead.full_name ?? conversation.customer_name,
    customer_email: lead.email ?? conversation.customer_email,
    customer_phone: lead.phone ?? conversation.customer_phone,
    service_needed: lead.service_interest,
    meeting_date: times.meeting_date,
    meeting_time: times.meeting_time,
    meeting_type: meetingType.slug,
    meeting_type_id: meetingType.id,
    start_time: times.start_time,
    end_time: times.end_time,
    timezone: times.timezone,
    starts_at: times.starts_at,
    ends_at: times.ends_at,
    duration_minutes: times.duration_minutes,
    assigned_to: assignedProfileId,
    provider: "internal",
    location_type: meetingType.location_type,
    status: "confirmed",
    notes: notes ?? null,
    created_at: now,
    updated_at: now,
  };

  const saved = await saveBooking(booking);

  await saveLead({
    ...lead,
    lead_status: "qualified",
    updated_at: now,
  });

  await saveConversation({
    ...conversation,
    status: "booked",
    conversation_stage: "booking",
    updated_at: now,
  });

  await saveNotification({
    id: crypto.randomUUID(),
    organization_id: organizationId,
    type: "booking_created",
    title: "New meeting booked",
    message: `${saved.customer_name ?? "Customer"} — ${meetingType.name} on ${times.meeting_date} at ${times.meeting_time?.slice(0, 5) ?? ""}`,
    status: "unread",
    metadata: {
      booking_id: saved.id,
      conversation_id: conversation.id,
      lead_id: lead.id,
    },
    created_at: now,
  });

  return saved;
}
