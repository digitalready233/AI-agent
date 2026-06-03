import { getBookingForConversation, saveBooking } from "@/lib/platform/data";
import type { Agent, Conversation, Lead } from "@/lib/platform/types";
import type { WorkflowAnalysis } from "./schemas";

/** Create a pending booking when the agent qualifies the customer for scheduling. */
export async function createBookingFromSuggestion(params: {
  organizationId: string;
  agent: Agent;
  conversation: Conversation;
  lead: Lead;
  analysis: WorkflowAnalysis;
}): Promise<string | null> {
  const { organizationId, agent, conversation, lead, analysis } = params;

  const existing = await getBookingForConversation(conversation.id);
  if (existing) return existing.id;

  const now = new Date().toISOString();
  const title =
    analysis.detected_intent === "booking_request"
      ? "Sales consultation"
      : lead.service_interest
        ? `Consultation — ${lead.service_interest}`
        : "Sales consultation";

  const booking = await saveBooking({
    id: crypto.randomUUID(),
    organization_id: organizationId,
    agent_id: agent.id,
    lead_id: lead.id,
    conversation_id: conversation.id,
    title,
    customer_name: lead.full_name ?? conversation.customer_name ?? null,
    customer_email: lead.email ?? conversation.customer_email ?? null,
    customer_phone: lead.phone ?? conversation.customer_phone ?? null,
    service_needed: lead.service_interest ?? null,
    meeting_date: null,
    meeting_time: null,
    duration_minutes: 30,
    assigned_to: conversation.assigned_to ?? null,
    meeting_link: null,
    status: "scheduled",
    notes: `Auto-created from chat (${analysis.conversation_stage}). ${analysis.recommended_next_action}`,
    created_at: now,
    updated_at: now,
  });

  return booking.id;
}
