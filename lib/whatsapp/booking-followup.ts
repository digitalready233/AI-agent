import { parsePreferredDateTime } from "@/lib/booking/parse-preferred-datetime";
import { createInternalBooking, InternalBookingError } from "@/lib/booking/create-internal-booking";
import { getInternalAvailableSlots } from "@/lib/booking/internal-slots";
import type { AvailableSlot } from "@/lib/booking/types";
import {
  getAgent,
  getBookingForConversation,
  getLead,
} from "@/lib/platform/data";
import type { Agent, Conversation } from "@/lib/platform/types";
import type { RunAgentWorkflowResult } from "@/lib/platform/workflow/types";

const MAX_SLOT_LINES = 5;
const MAX_DAYS_AHEAD = 7;

function datePart(pref: string): string {
  if (pref.includes("T")) return pref.split("T")[0]!;
  return pref.slice(0, 10);
}

function pickSlotForPreferred(
  slots: AvailableSlot[],
  preferredDateTime: string
): AvailableSlot | null {
  if (slots.length === 0) return null;
  if (slots.length === 1) return slots[0];

  const hasTime = preferredDateTime.includes("T");
  const target = new Date(
    hasTime ? preferredDateTime : `${preferredDateTime}T09:00:00`
  );
  if (Number.isNaN(target.getTime())) return slots[0];

  let best = slots[0]!;
  let bestDiff = Math.abs(new Date(best.start).getTime() - target.getTime());
  for (const slot of slots.slice(1)) {
    const diff = Math.abs(new Date(slot.start).getTime() - target.getTime());
    if (diff < bestDiff) {
      best = slot;
      bestDiff = diff;
    }
  }

  if (hasTime && bestDiff > 90 * 60 * 1000) {
    return null;
  }

  return best;
}

async function formatUpcomingSlotsMessage(params: {
  organizationId: string;
  meetingTypeSlug: string;
  timezone: string;
}): Promise<string | null> {
  const today = new Date();
  const lines: string[] = [];

  for (let i = 0; i < MAX_DAYS_AHEAD && lines.length < MAX_SLOT_LINES; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dateIso = d.toISOString().slice(0, 10);
    try {
      const { slots, timezone } = await getInternalAvailableSlots({
        organizationId: params.organizationId,
        dateIso,
        meetingTypeSlug: params.meetingTypeSlug,
      });
      for (const slot of slots) {
        if (lines.length >= MAX_SLOT_LINES) break;
        const when = new Date(slot.start);
        lines.push(
          `• ${when.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            timeZone: timezone,
          })} ${slot.label}`
        );
      }
    } catch {
      continue;
    }
  }

  if (lines.length === 0) return null;
  return `Here are some available times (${params.timezone}):\n${lines.join("\n")}\n\nReply with a date and time (e.g. tomorrow at 2pm) to confirm.`;
}

function formatBookingConfirmation(booking: {
  meeting_date?: string | null;
  meeting_time?: string | null;
  title: string;
}): string {
  const date = booking.meeting_date ?? "";
  const time = booking.meeting_time?.slice(0, 5) ?? "";
  return `\n\n✅ Booking confirmed: ${booking.title} on ${date}${time ? ` at ${time}` : ""}. We look forward to speaking with you!`;
}

/**
 * After workflow: auto-book when customer gave a date/time, or suggest slots when booking is recommended.
 */
export async function tryWhatsAppBookingFollowUp(params: {
  organizationId: string;
  agentId: string;
  conversation: Conversation;
  customerMessage: string;
  workflow: RunAgentWorkflowResult;
}): Promise<string | null> {
  const { organizationId, agentId, conversation, customerMessage, workflow } =
    params;

  if (workflow.handoffRequired) return null;

  const existing = await getBookingForConversation(conversation.id);
  if (existing && existing.status !== "cancelled") return null;

  const preferred =
    workflow.preferredDateTime?.trim() ||
    parsePreferredDateTime(customerMessage);
  const meetingSlug =
    workflow.suggestedMeetingType ?? workflow.meetingTypeKey ?? "sales_consultation";

  const shouldTryBook =
    Boolean(preferred) ||
    workflow.bookingRecommended ||
    workflow.detectedIntent === "booking_request";

  if (!shouldTryBook) return null;

  const agent = await getAgent(agentId);
  if (!agent?.enabled || agent.organization_id !== organizationId) return null;

  const leadId = workflow.leadId ?? conversation.lead_id;
  if (!leadId) return null;
  const lead = await getLead(leadId);
  if (!lead) return null;

  if (preferred) {
    const dateIso = datePart(preferred);
    try {
      const { slots, timezone } = await getInternalAvailableSlots({
        organizationId,
        dateIso,
        meetingTypeSlug: meetingSlug,
      });

      const slot = pickSlotForPreferred(slots, preferred);
      if (slot) {
        const booking = await createInternalBooking({
          organizationId,
          agent: agent as Agent,
          conversation,
          lead,
          meetingTypeSlug: meetingSlug,
          startIso: slot.start,
          endIso: slot.end,
          notes: `Booked via WhatsApp. Customer message: ${customerMessage.slice(0, 500)}`,
        });
        return formatBookingConfirmation(booking);
      }

      const alt = await formatUpcomingSlotsMessage({
        organizationId,
        meetingTypeSlug: meetingSlug,
        timezone,
      });
      if (alt) {
        return `\n\nI couldn't find an exact match for that time. ${alt}`;
      }
    } catch (err) {
      if (err instanceof InternalBookingError) {
        console.warn("[whatsapp] booking follow-up failed", {
          code: err.code,
          message: err.message,
          conversationId: conversation.id,
        });
      } else {
        console.error("[whatsapp] booking follow-up error", err);
      }
    }
    return null;
  }

  if (workflow.bookingRecommended || workflow.detectedIntent === "booking_request") {
    try {
      const { timezone } = await getInternalAvailableSlots({
        organizationId,
        dateIso: new Date().toISOString().slice(0, 10),
        meetingTypeSlug: meetingSlug,
      });
      const slotsMsg = await formatUpcomingSlotsMessage({
        organizationId,
        meetingTypeSlug: meetingSlug,
        timezone,
      });
      return slotsMsg ? `\n\n${slotsMsg}` : null;
    } catch {
      return null;
    }
  }

  return null;
}
