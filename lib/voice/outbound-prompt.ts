import { getAgent } from "@/lib/platform/data";
import type { Lead } from "@/lib/platform/types";
import { buildVoiceAgentInstructions } from "./voice-prompt";

const OUTBOUND_SALES_RULES = `
OUTBOUND VOICE SALES CALL (mandatory)
You are placing an outbound sales call. Follow this structure:

1. INTRODUCTION — State your name clearly and the company you represent.
2. TIME CHECK — Politely ask if they have a moment to talk. If they are busy, offer to call back or book a time.
3. REASON — Briefly explain why you are calling (follow-up, service interest, or campaign context).
4. DISCOVERY — Ask one question at a time. Listen fully before the next question.
5. QUALIFY — Confirm need, budget range, timeline, and decision-maker when relevant.
6. BOOKING — When qualified and interested, use checkAvailability then createBooking. Do not push booking if they are not ready.
7. HUMAN — If they ask for a person, sound upset, or are a hot lead, use transferToHuman immediately.
8. OPT-OUT — If they ask not to be called again, acknowledge politely, use saveCallSummary with do-not-call intent, and end the call.
9. CLOSE — If not interested, thank them and end politely without pressure.

Style: conversational, respectful, never robotic. Keep responses short (1–3 sentences) unless explaining something specific.
`;

export async function buildOutboundVoiceInstructions(params: {
  organizationId: string;
  agentId: string;
  lead?: Lead | null;
  companyName: string;
  openingScript?: string | null;
}): Promise<string> {
  const base = await buildVoiceAgentInstructions({
    organizationId: params.organizationId,
    agentId: params.agentId,
  });

  const agent = await getAgent(params.agentId);
  const lead = params.lead;
  const leadContext = lead
    ? [
        `CALLER CONTEXT:`,
        `Name: ${lead.full_name ?? "Unknown"}`,
        lead.business_name ? `Business: ${lead.business_name}` : "",
        lead.service_interest ? `Interest: ${lead.service_interest}` : "",
        lead.source ? `Source: ${lead.source}` : "",
        lead.lead_status ? `CRM status: ${lead.lead_status}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const opening = params.openingScript?.trim()
    ? `OPENING LINE (say this first, then continue naturally):\n${params.openingScript}`
    : agent?.welcome_message?.trim()
      ? `OPENING LINE:\n${agent.welcome_message}`
      : `OPENING LINE:\nHi, this is ${agent?.nickname ?? agent?.name ?? "our team"} calling from ${params.companyName}.`;

  return [
    base,
    OUTBOUND_SALES_RULES,
    `COMPANY: ${params.companyName}`,
    opening,
    leadContext,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function defaultOutboundOpeningScript(
  companyName: string,
  leadName?: string | null
): string {
  const name = leadName?.trim() || "there";
  return `Hi ${name}, this is calling from ${companyName}. Do you have a quick moment? I'm reaching out about your recent inquiry.`;
}
