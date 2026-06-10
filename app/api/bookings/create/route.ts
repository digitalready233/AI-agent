import { z } from "zod";
import {
  findOrCreateConversationBySession,
  getAgent,
  getConversation,
  getLead,
  saveConversation,
  saveLead,
} from "@/lib/platform/data";
import type { Lead } from "@/lib/platform/types";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import {
  createInternalBooking,
  InternalBookingError,
} from "@/lib/booking/create-internal-booking";

const bodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  agentId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  meetingType: z.string().min(1),
  startIso: z.string().min(10),
  endIso: z.string().min(10),
  customerEmail: z.string().email().optional(),
  customerName: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  demoSessionId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  if (!hasServiceRoleKey()) {
    return Response.json(
      { error: "Booking requires server configuration." },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await withPlatformAdmin(async () => {
      const agent = await getAgent(parsed.data.agentId);
      if (!agent?.enabled) {
        throw new InternalBookingError("Agent not found.", "INVALID_SLOT");
      }

      const channel = parsed.data.demoSessionId ? "demo_call" : "live_agent";

      const conversation = parsed.data.conversationId
        ? await getConversation(parsed.data.conversationId)
        : await findOrCreateConversationBySession({
            organizationId: agent.organization_id,
            agentId: agent.id,
            sessionId: parsed.data.sessionId,
            channel,
          });

      if (!conversation || conversation.organization_id !== agent.organization_id) {
        throw new InternalBookingError("Conversation not found.", "INVALID_SLOT");
      }

      let lead = conversation.lead_id ? await getLead(conversation.lead_id) : null;
      if (!lead) {
        const now = new Date().toISOString();
        const draft: Lead = {
          id: crypto.randomUUID(),
          organization_id: agent.organization_id,
          full_name:
            parsed.data.customerName?.trim() ||
            conversation.customer_name?.trim() ||
            "Website visitor",
          email: parsed.data.customerEmail ?? null,
          phone: null,
          business_name: null,
          service_interest: null,
          budget: null,
          timeline: null,
          source: channel,
          lead_score: 0,
          lead_category: "cold",
          lead_status: "created",
          assigned_to: null,
          summary: null,
          next_action: null,
          follow_up_date: null,
          notes: null,
          created_at: now,
          updated_at: now,
        };
        lead = await saveLead(draft);
        await saveConversation({
          ...conversation,
          lead_id: lead.id,
          updated_at: now,
        });
      } else {
        if (parsed.data.customerEmail) {
          lead = { ...lead, email: parsed.data.customerEmail };
        }
        if (parsed.data.customerName) {
          lead = { ...lead, full_name: parsed.data.customerName };
        }
      }

      const booking = await createInternalBooking({
        organizationId: agent.organization_id,
        agent,
        conversation,
        lead,
        meetingTypeSlug: parsed.data.meetingType,
        startIso: parsed.data.startIso,
        endIso: parsed.data.endIso,
        notes: parsed.data.notes,
      });

      if (parsed.data.demoSessionId) {
        const { linkBookingToDemoSession } = await import("@/lib/demo/link-demo-booking");
        await linkBookingToDemoSession({
          demoSessionId: parsed.data.demoSessionId,
          bookingId: booking.id,
          organizationId: agent.organization_id,
        });
      }

      return {
        booking,
        demo_session_id: parsed.data.demoSessionId ?? null,
        message: `Your ${booking.title} is confirmed for ${booking.meeting_date} at ${booking.meeting_time?.slice(0, 5) ?? ""}.`,
      };
    });

    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof InternalBookingError) {
      return Response.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("[POST /api/bookings/create]", err);
    return Response.json({ error: "Booking failed." }, { status: 500 });
  }
}
