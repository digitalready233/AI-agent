import { z } from "zod";
import {
  findOrCreateConversationBySession,
  getAgent,
  getConversation,
  getLead,
} from "@/lib/platform/data";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import {
  CalendarBookingError,
  createCalendarBooking,
} from "@/lib/calendar/create-booking";

const bodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  agentId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  meetingTypeKey: z.string().min(1),
  startIso: z.string().min(10),
  endIso: z.string().min(10),
  customerEmail: z.string().email().optional(),
  customerName: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
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
        throw new CalendarBookingError("Agent not found.", "INVALID_SLOT");
      }

      const conversation = parsed.data.conversationId
        ? await getConversation(parsed.data.conversationId)
        : await findOrCreateConversationBySession({
            organizationId: agent.organization_id,
            agentId: agent.id,
            sessionId: parsed.data.sessionId,
            channel: "live_agent",
          });

      if (!conversation || conversation.organization_id !== agent.organization_id) {
        throw new CalendarBookingError("Conversation not found.", "INVALID_SLOT");
      }

      let lead = conversation.lead_id
        ? await getLead(conversation.lead_id)
        : null;

      if (!lead) {
        throw new CalendarBookingError(
          "Start a conversation before booking.",
          "INVALID_SLOT"
        );
      }

      if (parsed.data.customerEmail) {
        lead = { ...lead, email: parsed.data.customerEmail };
      }
      if (parsed.data.customerName) {
        lead = { ...lead, full_name: parsed.data.customerName };
      }

      const booking = await createCalendarBooking({
        organizationId: agent.organization_id,
        agent,
        conversation,
        lead,
        meetingTypeKey: parsed.data.meetingTypeKey,
        startIso: parsed.data.startIso,
        endIso: parsed.data.endIso,
        notes: parsed.data.notes,
      });

      return {
        booking,
        message: `Your ${booking.title} is confirmed.`,
      };
    });

    return Response.json(result);
  } catch (err) {
    if (err instanceof CalendarBookingError) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: err.code === "NOT_CONNECTED" ? 503 : 400 }
      );
    }
    console.error("[POST /api/platform/calendar/book]", err);
    return Response.json({ error: "Booking failed." }, { status: 500 });
  }
}
