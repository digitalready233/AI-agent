import { syncLeadToCrm } from "../integrations/crm";
import { logEvent } from "../analytics";
import { getLeadBySession, upsertLead } from "../store";
import type { Channel, LeadRecord } from "../types";
import type { CustomerIntent } from "../orchestrator/types";
import { defaultLeadStatusForIntent } from "./types";

function newLeadId(): string {
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Ensure support/complaint sessions have a Support lead row in CRM. */
export async function ensureSupportLead(params: {
  sessionId: string;
  channel: Channel;
  intent: CustomerIntent;
}): Promise<LeadRecord | undefined> {
  if (params.intent !== "support_request" && params.intent !== "complaint") {
    return getLeadBySession(params.sessionId);
  }

  const existing = getLeadBySession(params.sessionId);
  const now = new Date().toISOString();
  const lead: LeadRecord = {
    ...existing,
    id: existing?.id ?? newLeadId(),
    sessionId: params.sessionId,
    channel: existing?.channel ?? params.channel,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    status: "Support",
    customerType:
      params.intent === "complaint" ? "complaint" : "support",
    notes: existing?.notes ?? `Support case — ${params.intent.replace(/_/g, " ")}`,
  };

  if (!existing || existing.status !== "Support") {
    upsertLead(lead);
    await syncLeadToCrm(lead).catch(() => undefined);
    if (!existing) {
      logEvent("lead_saved", params.sessionId, params.channel, {
        leadId: lead.id,
        status: "Support",
        source: "workflow_support",
      });
    }
    return lead;
  }

  return existing;
}

export function applyIntentDefaultStatus(
  lead: LeadRecord | undefined,
  intent: CustomerIntent
): LeadRecord | undefined {
  if (!lead) return undefined;
  const preferred = defaultLeadStatusForIntent(intent);
  if (lead.status === preferred) return lead;
  const updated = { ...lead, status: preferred, updatedAt: new Date().toISOString() };
  upsertLead(updated);
  return updated;
}
