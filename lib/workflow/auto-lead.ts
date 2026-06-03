import { syncLeadToCrm } from "../integrations/crm";
import { logEvent } from "../analytics";
import { getLeadBySession, upsertLead } from "../store";
import type { Channel, LeadRecord } from "../types";
import type { CustomerIntent } from "../orchestrator/types";
import { defaultLeadStatusForIntent } from "./types";

function newLeadId(): string {
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create or refresh a draft lead when sales intent is detected (deterministic CRM capture).
 */
export async function ensureDraftLeadForIntent(params: {
  sessionId: string;
  channel: Channel;
  intent: CustomerIntent;
  inferredService?: string;
}): Promise<LeadRecord | undefined> {
  const salesIntents: CustomerIntent[] = [
    "sales_enquiry",
    "pricing_question",
    "booking_request",
  ];
  if (!salesIntents.includes(params.intent)) {
    return getLeadBySession(params.sessionId);
  }

  const existing = getLeadBySession(params.sessionId);
  const now = new Date().toISOString();
  const status = existing?.status ?? defaultLeadStatusForIntent(params.intent);

  if (existing && !params.inferredService) {
    return existing;
  }

  const lead: LeadRecord = {
    ...existing,
    id: existing?.id ?? newLeadId(),
    sessionId: params.sessionId,
    channel: existing?.channel ?? params.channel,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    status,
    customerType: existing?.customerType ?? "new_prospect",
    serviceNeeded: params.inferredService ?? existing?.serviceNeeded,
    notes:
      existing?.notes ??
      `Draft lead — ${params.intent.replace(/_/g, " ")} (workflow auto-create)`,
  };

  const isNew = !existing;
  upsertLead(lead);
  await syncLeadToCrm(lead).catch(() => undefined);

  if (isNew) {
    logEvent("lead_saved", params.sessionId, params.channel, {
      leadId: lead.id,
      status: lead.status,
      source: "workflow_draft",
    });
  }

  return lead;
}
