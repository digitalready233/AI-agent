import { getBookingForConversation, listConversations } from "./data";
import type { CampaignStopConditions } from "./campaign-types";
import { DEFAULT_STOP_CONDITIONS, parseStopConditions } from "./campaign-types";
import type { CampaignLead, Lead } from "./types";

export type StopReason =
  | "reply"
  | "booking"
  | "customer"
  | "disqualified"
  | "human_handoff"
  | "unsubscribe"
  | "keyword_stop"
  | "sequence_complete"
  | "voice_not_supported";

export function isUnsubscribeMessage(text: string, keywords: string[]): boolean {
  const lower = text.trim().toLowerCase();
  return keywords.some((k) => lower === k || lower.includes(k));
}

export async function evaluateCampaignStop(params: {
  lead: Lead;
  campaignLead: CampaignLead;
  rawStopConditions: unknown;
  inboundMessage?: string;
}): Promise<{ stop: boolean; reason?: StopReason }> {
  const rules: CampaignStopConditions = {
    ...DEFAULT_STOP_CONDITIONS,
    ...parseStopConditions(params.rawStopConditions),
  };

  if (params.campaignLead.status === "replied" && rules.stop_on_reply) {
    return { stop: true, reason: "reply" };
  }

  if (params.campaignLead.sequence_status === "stopped") {
    return { stop: true, reason: "reply" };
  }

  if (rules.stop_on_unsubscribe) {
    if (params.lead.unsubscribed_at) {
      return { stop: true, reason: "unsubscribe" };
    }
    if (
      params.inboundMessage &&
      isUnsubscribeMessage(params.inboundMessage, rules.stop_keywords ?? [])
    ) {
      return { stop: true, reason: "keyword_stop" };
    }
  }

  if (rules.stop_on_customer && params.lead.lead_status === "customer") {
    return { stop: true, reason: "customer" };
  }

  if (rules.stop_on_disqualified && params.lead.lead_status === "disqualified") {
    return { stop: true, reason: "disqualified" };
  }

  if (rules.stop_on_booking && params.lead.lead_status === "qualified") {
    const convs = await listConversations(params.lead.organization_id);
    const leadConvs = convs.filter((c) => c.lead_id === params.lead.id);
    for (const c of leadConvs) {
      const booking = await getBookingForConversation(c.id);
      if (booking && booking.status !== "cancelled") {
        return { stop: true, reason: "booking" };
      }
    }
  }

  if (rules.stop_on_human_handoff) {
    const convs = await listConversations(params.lead.organization_id);
    if (convs.some((c) => c.lead_id === params.lead.id && c.status === "human_needed")) {
      return { stop: true, reason: "human_handoff" };
    }
  }

  return { stop: false };
}
