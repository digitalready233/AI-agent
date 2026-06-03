import {
  getAgent,
  getConversation,
  getKnowledgeContextForAgent,
  getLead,
  listBookings,
  saveLead,
  saveNotification,
} from "@/lib/platform/data";
import { scoreLeadFromNbat } from "@/lib/agent/scoring";
import { appendCallEvent, saveCall } from "./call-data";

export type VoiceToolContext = {
  organizationId: string;
  agentId: string;
  callId: string;
  conversationId: string | null;
  leadId: string | null;
  callerPhone: string | null;
};

export async function searchKnowledgeBase(
  ctx: VoiceToolContext,
  query: string
): Promise<{ snippets: string }> {
  const kb = await getKnowledgeContextForAgent(ctx.agentId, ctx.organizationId);
  if (!kb.trim()) return { snippets: "No knowledge base content available." };
  const q = query.toLowerCase();
  const lines = kb.split("\n").filter((l) => l.toLowerCase().includes(q));
  return {
    snippets: lines.length ? lines.slice(0, 12).join("\n") : kb.slice(0, 2000),
  };
}

export async function createOrUpdateLead(
  ctx: VoiceToolContext,
  fields: {
    full_name?: string;
    phone?: string;
    email?: string;
    service_interest?: string;
    budget?: string;
    timeline?: string;
    notes?: string;
  }
): Promise<{ leadId: string }> {
  const now = new Date().toISOString();
  const phone = fields.phone ?? ctx.callerPhone ?? null;

  if (ctx.leadId) {
    const existing = await getLead(ctx.leadId);
    if (existing) {
      const updated = await saveLead({
        ...existing,
        full_name: fields.full_name ?? existing.full_name,
        phone: phone ?? existing.phone,
        email: fields.email ?? existing.email,
        service_interest: fields.service_interest ?? existing.service_interest,
        budget: fields.budget ?? existing.budget,
        timeline: fields.timeline ?? existing.timeline,
        notes: fields.notes ?? existing.notes,
        updated_at: now,
      });
      return { leadId: updated.id };
    }
  }

  const lead = await saveLead({
    id: crypto.randomUUID(),
    organization_id: ctx.organizationId,
    full_name: fields.full_name ?? null,
    phone,
    email: fields.email ?? null,
    service_interest: fields.service_interest ?? null,
    budget: fields.budget ?? null,
    timeline: fields.timeline ?? null,
    source: "voice",
    lead_status: "working",
    lead_category: null,
    notes: fields.notes ?? null,
    created_at: now,
    updated_at: now,
  });

  const { getCallById, saveCall: persistCall } = await import("./call-data");
  const call = await getCallById(ctx.organizationId, ctx.callId);
  if (call) {
    await persistCall({ ...call, lead_id: lead.id, updated_at: now });
    await appendCallEvent({
      organizationId: ctx.organizationId,
      callId: ctx.callId,
      eventType: "lead.linked",
      payload: { leadId: lead.id },
    });
  }

  return { leadId: lead.id };
}

export async function scoreLead(
  ctx: VoiceToolContext,
  scores: { need: 0 | 1 | 2 | 3; budget: 0 | 1 | 2 | 3; authority: 0 | 1 | 2 | 3; timeline: 0 | 1 | 2 | 3 }
): Promise<{ total: number; category: string }> {
  const result = scoreLeadFromNbat(scores);
  if (ctx.leadId) {
    const lead = await getLead(ctx.leadId);
    if (lead) {
      await saveLead({
        ...lead,
        lead_score: result.total,
        lead_category: result.category as typeof lead.lead_category,
        lead_status:
          result.status === "Hot"
            ? "qualified"
            : lead.lead_status,
        updated_at: new Date().toISOString(),
      });
    }
  }
  return { total: result.total, category: result.category };
}

export async function checkAvailability(
  ctx: VoiceToolContext,
  _preferredDate?: string
): Promise<{ available: boolean; message: string }> {
  const bookings = await listBookings(ctx.organizationId);
  const upcoming = bookings.filter(
    (b) => b.status === "scheduled" || b.status === "confirmed"
  );
  return {
    available: true,
    message: `There are ${upcoming.length} upcoming bookings. Offer the next available consultation slot per agent booking rules.`,
  };
}

export async function createBooking(
  ctx: VoiceToolContext,
  params: {
    customer_name: string;
    customer_email?: string;
    customer_phone?: string;
    preferred_datetime: string;
    meeting_type?: string;
    notes?: string;
  }
): Promise<{ bookingId: string | null; error?: string }> {
  if (!ctx.conversationId || !ctx.leadId) {
    return { bookingId: null, error: "Link lead and conversation before booking." };
  }

  const [agent, conversation, lead] = await Promise.all([
    getAgent(ctx.agentId),
    getConversation(ctx.conversationId),
    getLead(ctx.leadId),
  ]);

  if (!agent?.enabled || !conversation || !lead) {
    return { bookingId: null, error: "Missing agent, conversation, or lead." };
  }

  const preferred = new Date(params.preferred_datetime);
  if (Number.isNaN(preferred.getTime())) {
    return { bookingId: null, error: "Invalid preferred date/time." };
  }

  const end = new Date(preferred.getTime() + 30 * 60 * 1000);
  const { createInternalBooking, InternalBookingError } = await import(
    "@/lib/booking/create-internal-booking"
  );

  try {
    const booking = await createInternalBooking({
      organizationId: ctx.organizationId,
      agent,
      conversation,
      lead,
      meetingTypeSlug: params.meeting_type ?? "sales_consultation",
      startIso: preferred.toISOString(),
      endIso: end.toISOString(),
      notes: params.notes ?? `Voice booking for ${params.customer_name}`,
    });
    await appendCallEvent({
      organizationId: ctx.organizationId,
      callId: ctx.callId,
      eventType: "booking.created",
      payload: { bookingId: booking.id },
    });

    const { getCallById } = await import("./call-data");
    const callRow = await getCallById(ctx.organizationId, ctx.callId);
    if (callRow) {
      await saveCall({
        ...callRow,
        metadata: { ...(callRow.metadata ?? {}), booking_id: booking.id },
        updated_at: new Date().toISOString(),
      });
    }

    return { bookingId: booking.id };
  } catch (e) {
    const msg =
      e instanceof InternalBookingError ? e.message : "Booking failed";
    return { bookingId: null, error: msg };
  }
}

export async function notifyHumanTeam(
  ctx: VoiceToolContext,
  params: { title: string; message: string }
): Promise<{ ok: boolean }> {
  await saveNotification({
    id: crypto.randomUUID(),
    organization_id: ctx.organizationId,
    type: "voice_handoff",
    title: params.title,
    message: params.message,
    status: "unread",
    metadata: { call_id: ctx.callId },
    created_at: new Date().toISOString(),
  });
  await appendCallEvent({
    organizationId: ctx.organizationId,
    callId: ctx.callId,
    eventType: "human.notified",
    payload: params,
  });
  return { ok: true };
}

export async function transferToHuman(
  ctx: VoiceToolContext,
  reason: string
): Promise<{ transferNumber: string | null }> {
  const { getVoiceIntegration } = await import("./settings-data");
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  const integration = await getVoiceIntegration(ctx.organizationId, appOrigin);

  const { getCallById } = await import("./call-data");
  const call = await getCallById(ctx.organizationId, ctx.callId);
  if (call) {
    await saveCall({
      ...call,
      status: "human_needed",
      handoff_required: true,
      recommended_next_action: reason,
      updated_at: new Date().toISOString(),
    });
  }

  await notifyHumanTeam(ctx, {
    title: "Voice call needs human",
    message: reason,
  });

  await appendCallEvent({
    organizationId: ctx.organizationId,
    callId: ctx.callId,
    eventType: "transfer.requested",
    payload: { reason },
  });

  return { transferNumber: integration.human_transfer_phone };
}

export async function saveCallSummary(
  ctx: VoiceToolContext,
  summary: {
    summary: string;
    intent?: string;
    lead_category?: string;
    next_action?: string;
    handoff_required?: boolean;
  }
): Promise<{ ok: boolean }> {
  const { getCallById } = await import("./call-data");
  const call = await getCallById(ctx.organizationId, ctx.callId);
  if (!call) return { ok: false };

  await saveCall({
    ...call,
    summary: summary.summary,
    detected_intent: summary.intent ?? call.detected_intent,
    lead_category: summary.lead_category ?? call.lead_category,
    recommended_next_action: summary.next_action ?? call.recommended_next_action,
    handoff_required: summary.handoff_required ?? call.handoff_required,
    updated_at: new Date().toISOString(),
  });

  if (ctx.leadId) {
    const lead = await getLead(ctx.leadId);
    if (lead) {
      await saveLead({
        ...lead,
        summary: summary.summary,
        next_action: summary.next_action ?? lead.next_action,
        updated_at: new Date().toISOString(),
      });
    }
  }

  return { ok: true };
}

export async function createFollowUp(
  ctx: VoiceToolContext,
  params: { follow_up_date: string; notes?: string }
): Promise<{ ok: boolean }> {
  if (!ctx.leadId) return { ok: false };
  const lead = await getLead(ctx.leadId);
  if (!lead) return { ok: false };
  await saveLead({
    ...lead,
    follow_up_date: params.follow_up_date,
    notes: params.notes ?? lead.notes,
    updated_at: new Date().toISOString(),
  });
  return { ok: true };
}

export const VOICE_TOOL_NAMES = [
  "searchKnowledgeBase",
  "createOrUpdateLead",
  "scoreLead",
  "checkAvailability",
  "createBooking",
  "notifyHumanTeam",
  "transferToHuman",
  "saveCallSummary",
  "createFollowUp",
] as const;
