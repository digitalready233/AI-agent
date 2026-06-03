import { getLead, listProfiles, saveLead } from "./data";
import type { Lead } from "./types";

/** CRM side-effects after campaign touch or reply. */
export async function touchLeadFromCampaign(params: {
  leadId: string;
  note: string;
  nextAction?: string | null;
  leadStatus?: Lead["lead_status"];
  unsubscribed?: boolean;
}): Promise<Lead | null> {
  const lead = await getLead(params.leadId);
  if (!lead) return null;

  const now = new Date().toISOString();
  const existingNotes = lead.notes?.trim() ?? "";
  const stamp = new Date().toLocaleString();
  const line = `[Campaign ${stamp}] ${params.note}`;
  const notes = existingNotes ? `${existingNotes}\n${line}` : line;

  return saveLead({
    ...lead,
    last_contacted_at: now,
    notes,
    next_action: params.nextAction !== undefined ? params.nextAction : lead.next_action,
    lead_status: params.leadStatus ?? lead.lead_status,
    unsubscribed_at: params.unsubscribed ? now : lead.unsubscribed_at,
    marketing_opt_in: params.unsubscribed ? false : lead.marketing_opt_in,
    updated_at: now,
  });
}

export async function resolveAssignedStaffName(
  organizationId: string,
  assignedTo: string | null | undefined
): Promise<string | null> {
  if (!assignedTo) return null;
  const profiles = await listProfiles(organizationId);
  return profiles.find((p) => p.id === assignedTo || p.user_id === assignedTo)?.full_name ?? null;
}
