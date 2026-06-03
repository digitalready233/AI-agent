import { logEvent } from "../analytics";
import { saveLeadToCrm, type CrmSaveResult } from "../integrations/crm";
import { ensureLeadsHydrated, getLeadBySession, mergeLeadRecord } from "../store";
import type { Channel, CustomerType, LeadRecord, LeadStatus } from "../types";

export interface CaptureLeadInput {
  sessionId: string;
  channel: Channel;
  status?: LeadStatus;
  customerType?: CustomerType;
  fullName?: string;
  phone?: string;
  email?: string;
  businessName?: string;
  location?: string;
  serviceNeeded?: string;
  mainChallenge?: string;
  budgetRange?: string;
  timeline?: string;
  preferredContact?: string;
  bestTimeToReach?: string;
  notes?: string;
  conversationSummary?: string;
  conversationStage?: string;
  lastIntent?: string;
  sentiment?: string;
  objections?: string;
  followUpDate?: string;
  assignedTeam?: string;
  leadScore?: number;
  leadCategory?: string;
  source?: string;
}

export interface CaptureLeadResult {
  lead: LeadRecord;
  crm: CrmSaveResult;
  created: boolean;
}

/**
 * Single entry point for lead capture: validate merge → persist to database file → CRM sync.
 */
export async function captureLead(
  input: CaptureLeadInput
): Promise<CaptureLeadResult> {
  await ensureLeadsHydrated();

  const existing = getLeadBySession(input.sessionId);
  const created = !existing;

  const lead = mergeLeadRecord(input.sessionId, input.channel, {
    status: input.status,
    customerType: input.customerType,
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    businessName: input.businessName,
    location: input.location,
    serviceNeeded: input.serviceNeeded,
    mainChallenge: input.mainChallenge,
    budgetRange: input.budgetRange,
    timeline: input.timeline,
    preferredContact: input.preferredContact,
    bestTimeToReach: input.bestTimeToReach,
    notes: input.notes,
    conversationSummary: input.conversationSummary,
    conversationStage: input.conversationStage,
    lastIntent: input.lastIntent,
    sentiment: input.sentiment,
    objections: input.objections,
    followUpDate: input.followUpDate,
    assignedTeam: input.assignedTeam,
    leadScore: input.leadScore,
    leadCategory: input.leadCategory,
  });

  const crm = await saveLeadToCrm(lead);

  logEvent("lead_saved", input.sessionId, input.channel, {
    leadId: lead.id,
    status: lead.status,
    source: input.source ?? "capture",
    crmLocal: crm.localSaved,
    crmWebhook: crm.webhookDelivered,
  });

  return { lead, crm, created };
}
