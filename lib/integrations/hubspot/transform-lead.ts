import type { Lead } from "@/lib/platform/types";
import type { WorkflowAnalysis } from "@/lib/platform/workflow/schemas";
import { resolveHubSpotPropertyMap } from "./property-map";

export type HubSpotWebhookPayload = {
  /** For HubSpot workflows / private app subscriptions */
  subscriptionType: "contact.upsert";
  objectId: string | null;
  properties: Record<string, string | number | boolean | null>;
  /** Original platform lead id for deduplication in HubSpot workflow */
  platformLeadId: string;
  occurredAt: string;
};

function splitName(fullName: string | null | undefined): {
  firstname: string;
  lastname: string;
} {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstname: "", lastname: "" };
  if (parts.length === 1) return { firstname: parts[0], lastname: "" };
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}

export function leadToHubSpotWebhookPayload(params: {
  lead: Lead;
  extracted: WorkflowAnalysis["lead_extraction"];
  conversationId?: string | null;
  conversationStage?: string | null;
}): HubSpotWebhookPayload {
  const { lead, extracted } = params;
  const map = resolveHubSpotPropertyMap();
  const { firstname, lastname } = splitName(lead.full_name);

  const properties: Record<string, string | number | boolean | null> = {
    firstname: firstname || null,
    lastname: lastname || null,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    company: lead.business_name ?? null,
    [map.lead_intent]:
      extracted.growth_milestone ?? lead.service_interest ?? null,
    [map.current_stack]: extracted.current_stack ?? null,
    [map.budget_tier]: extracted.budget_tier ?? lead.budget ?? null,
    [map.timeline]: lead.timeline ?? extracted.timeline ?? null,
    [map.team_structure]: extracted.team_structure ?? null,
    [map.service_interest]: lead.service_interest ?? null,
    [map.lead_score]: lead.lead_score ?? null,
    [map.lead_category]: lead.lead_category ?? null,
    [map.lead_status]: lead.lead_status ?? null,
    [map.conversation_summary]: lead.summary ?? null,
    [map.next_action]: lead.next_action ?? null,
    [map.source_channel]: lead.source ?? null,
  };

  if (extracted.authority?.trim()) {
    properties[`${map.team_structure}_authority_note`] = extracted.authority;
  }

  if (params.conversationId) {
    properties.dr_conversation_id = params.conversationId;
  }
  if (params.conversationStage) {
    properties.dr_conversation_stage = params.conversationStage;
  }

  return {
    subscriptionType: "contact.upsert",
    objectId: null,
    properties: stripEmpty(properties),
    platformLeadId: lead.id,
    occurredAt: new Date().toISOString(),
  };
}

function stripEmpty(
  props: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === "") continue;
    out[k] = v;
  }
  return out;
}
