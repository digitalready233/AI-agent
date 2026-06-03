import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getLead,
  listBookings,
  listConversations,
  listLeads,
  saveBooking,
  saveConversation,
  saveLead,
  saveMessage,
  saveNotification,
} from "@/lib/platform/data";
import { getOrganizationSettings } from "@/lib/platform/settings-data";
import type { Booking, Conversation, Lead } from "@/lib/platform/types";
import { meetingTypeLabel } from "@/lib/calendar/meeting-types";
import type { MeetingTypeKey } from "@/lib/calendar/types";
import { getCalendlyWebhookSigningKey } from "./credentials";
import type { CalendlyWebhookEvent } from "./types";

export function verifyCalendlyWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string | null;
  signingKey: string | null;
}): { valid: boolean; skipped: boolean } {
  const key = params.signingKey?.trim();
  if (!key) {
    console.warn("[calendly] webhook signing key not set — verification skipped");
    return { valid: true, skipped: true };
  }

  const header = params.signatureHeader?.trim();
  if (!header) {
    return { valid: false, skipped: false };
  }

  const expected = createHmac("sha256", key).update(params.rawBody, "utf8").digest("hex");

  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(header, "hex");
    if (a.length !== b.length) return { valid: false, skipped: false };
    return { valid: timingSafeEqual(a, b), skipped: false };
  } catch {
    return { valid: false, skipped: false };
  }
}

async function findOrganizationForCalendlyWebhook(): Promise<string | null> {
  const envOrg = process.env.PLATFORM_ORGANIZATION_ID?.trim();
  if (envOrg) return envOrg;
  return null;
}

async function matchLeadAndConversation(
  organizationId: string,
  email: string | null,
  phone: string | null,
  conversationIdHint: string | null,
  leadIdHint: string | null
): Promise<{ lead: Lead | null; conversation: Conversation | null }> {
  if (leadIdHint) {
    const lead = await getLead(leadIdHint);
    if (lead && lead.organization_id === organizationId) {
      const conversations = await listConversations(organizationId);
      const conv = conversations.find((c) => c.lead_id === lead.id) ?? null;
      return { lead, conversation: conv };
    }
  }

  if (conversationIdHint) {
    const conversations = await listConversations(organizationId);
    const conv = conversations.find((c) => c.id === conversationIdHint) ?? null;
    if (conv?.lead_id) {
      const lead = await getLead(conv.lead_id);
      return { lead: lead ?? null, conversation: conv };
    }
    return { lead: null, conversation: conv };
  }

  const leads = await listLeads(organizationId);
  if (email) {
    const lead = leads.find(
      (l) => l.email?.toLowerCase() === email.toLowerCase()
    );
    if (lead) {
      const conversations = await listConversations(organizationId);
      const conv = conversations.find((c) => c.lead_id === lead.id) ?? null;
      return { lead, conversation: conv };
    }
  }

  if (phone) {
    const digits = phone.replace(/\D/g, "");
    const lead = leads.find((l) => l.phone?.replace(/\D/g, "") === digits);
    if (lead) {
      const conversations = await listConversations(organizationId);
      const conv = conversations.find((c) => c.lead_id === lead.id) ?? null;
      return { lead, conversation: conv };
    }
  }

  return { lead: null, conversation: null };
}

export async function processCalendlyWebhook(
  organizationId: string,
  body: CalendlyWebhookEvent
): Promise<{ status: string; bookingId?: string }> {
  console.info("[calendly] webhook", { event: body.event, organizationId });

  const payload = body.payload;
  const invitee = payload.invitee ?? {
    uri: payload.uri ?? "",
    email: payload.email ?? "",
    name: payload.name ?? "Guest",
    tracking: undefined,
  };

  const scheduled = payload.scheduled_event;
  const inviteeUri = invitee.uri || payload.uri || "";
  const eventUri = scheduled?.uri ?? payload.event ?? "";

  const email = invitee.email?.trim() || null;
  const name = invitee.name?.trim() || "Guest";
  const conversationIdHint =
    invitee.tracking?.utm_content?.trim() || null;
  const leadIdHint = invitee.tracking?.utm_campaign?.trim() || null;

  const existingBookings = await listBookings(organizationId);
  const existing = existingBookings.find(
    (b) =>
      b.calendly_invitee_uri === inviteeUri ||
      (eventUri && b.calendly_event_uri === eventUri)
  );

  if (body.event === "invitee.canceled") {
    if (existing) {
      const now = new Date().toISOString();
      await saveBooking({
        ...existing,
        status: "cancelled",
        webhook_payload: body as unknown as Record<string, unknown>,
        updated_at: now,
      });
    }
    return { status: "cancelled", bookingId: existing?.id };
  }

  const { lead, conversation } = await matchLeadAndConversation(
    organizationId,
    email,
    null,
    conversationIdHint,
    leadIdHint
  );

  const startIso = scheduled?.start_time ?? new Date().toISOString();
  const endIso =
    scheduled?.end_time ??
    new Date(new Date(startIso).getTime() + 30 * 60_000).toISOString();
  const meetingLink = scheduled?.location?.join_url ?? null;
  const now = new Date().toISOString();
  const dateStr = startIso.slice(0, 10);
  const timeStr = new Date(startIso).toISOString().slice(11, 16);

  const booking: Booking = {
    id: existing?.id ?? crypto.randomUUID(),
    organization_id: organizationId,
    agent_id: conversation?.agent_id ?? null,
    lead_id: lead?.id ?? null,
    conversation_id: conversation?.id ?? null,
    title: scheduled?.name ?? `Calendly — ${name}`,
    customer_name: name,
    customer_email: email,
    customer_phone: lead?.phone ?? conversation?.customer_phone ?? null,
    service_needed: scheduled?.name ?? "Calendly meeting",
    meeting_type: "sales_consultation",
    meeting_date: dateStr,
    meeting_time: timeStr,
    starts_at: startIso,
    ends_at: endIso,
    duration_minutes: Math.round(
      (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000
    ),
    assigned_to: conversation?.assigned_to ?? null,
    staff_email: null,
    meeting_link: meetingLink,
    google_calendar_event_id: null,
    provider: "calendly",
    external_event_id: eventUri || inviteeUri,
    calendly_invitee_uri: inviteeUri,
    calendly_event_uri: eventUri,
    location_type: "calendly",
    webhook_payload: body as unknown as Record<string, unknown>,
    status: "confirmed",
    notes: "Booked via Calendly webhook.",
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  await saveBooking(booking);

  if (lead) {
    await saveLead({
      ...lead,
      lead_status: lead.lead_status === "customer" ? lead.lead_status : "qualified",
      next_action: `Calendly meeting on ${dateStr} at ${timeStr}`,
      updated_at: now,
    });
  }

  if (conversation) {
    await saveConversation({
      ...conversation,
      status: "booked",
      conversation_stage: "booking",
      recommended_next_action: `Confirmed via Calendly`,
      updated_at: now,
    });
  }

  const orgSettings = await getOrganizationSettings(organizationId);
  if (orgSettings.notifications.events.new_booking !== false) {
    await saveNotification({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      type: "booking_created",
      title: "New Calendly booking",
      message: `${name} booked via Calendly for ${dateStr} at ${timeStr}.`,
      status: "unread",
      metadata: {
        booking_id: booking.id,
        provider: "calendly",
        lead_id: lead?.id,
        conversation_id: conversation?.id,
      },
      created_at: now,
    });
  }

  return { status: "created", bookingId: booking.id };
}

export async function resolveCalendlyWebhookOrganization(
  _body: CalendlyWebhookEvent
): Promise<string | null> {
  return findOrganizationForCalendlyWebhook();
}

export async function savePendingCalendlyBookingState(params: {
  organizationId: string;
  conversationId: string;
  meetingTypeKey: string;
  calendlyUrl: string;
}): Promise<void> {
  const conversation = await listConversations(params.organizationId).then((rows) =>
    rows.find((c) => c.id === params.conversationId)
  );
  if (!conversation) return;

  const now = new Date().toISOString();
  await saveConversation({
    ...conversation,
    conversation_stage: "booking",
    recommended_next_action: `Complete Calendly booking: ${meetingTypeLabel(params.meetingTypeKey as MeetingTypeKey)}`,
    updated_at: now,
  });

  await saveMessage({
    id: crypto.randomUUID(),
    conversation_id: params.conversationId,
    sender_type: "system",
    sender_name: "Booking",
    content: "Calendly booking started — complete scheduling in the widget.",
    metadata: {
      pending_calendly_booking: {
        meeting_type: params.meetingTypeKey,
        calendly_url: params.calendlyUrl,
        started_at: now,
      },
    },
    created_at: now,
  });
}
