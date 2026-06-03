import { readJsonFile, writeJsonFile } from "./persistence/json-db";
import type {
  AppointmentRequest,
  CrmSummaryRecord,
  EscalationPayload,
  LeadRecord,
} from "./types";
import type { Channel, CustomerType, LeadStatus } from "./types";

const LEADS_FILE = "leads.json";

const leads = new Map<string, LeadRecord>();
const escalations = new Map<string, EscalationPayload>();
const appointments = new Map<string, AppointmentRequest>();
const crmSummaries = new Map<string, CrmSummaryRecord>();

let leadsHydrated = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function newLeadId(): string {
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function schedulePersistLeads(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void writeJsonFile(LEADS_FILE, [...leads.values()]).catch(() => undefined);
  }, 80);
}

export async function ensureLeadsHydrated(): Promise<void> {
  if (leadsHydrated) return;
  const list = await readJsonFile<LeadRecord[]>(LEADS_FILE, []);
  for (const lead of list) {
    leads.set(lead.id, lead);
  }
  leadsHydrated = true;
}

export function upsertLead(lead: LeadRecord): LeadRecord {
  leads.set(lead.id, lead);
  schedulePersistLeads();
  return lead;
}

export function mergeLeadRecord(
  sessionId: string,
  channel: Channel,
  partial: Partial<LeadRecord> & {
    status?: LeadStatus;
    customerType?: CustomerType;
  }
): LeadRecord {
  const existing = getLeadBySession(sessionId);
  const now = new Date().toISOString();
  const lead: LeadRecord = {
    id: existing?.id ?? newLeadId(),
    sessionId,
    channel: existing?.channel ?? channel,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    status: partial.status ?? existing?.status ?? "Warm",
    customerType: partial.customerType ?? existing?.customerType ?? "unknown",
    leadScore: partial.leadScore ?? existing?.leadScore,
    leadCategory: partial.leadCategory ?? existing?.leadCategory,
    nbat: partial.nbat ?? existing?.nbat,
    sentiment: partial.sentiment ?? existing?.sentiment,
    objections: partial.objections ?? existing?.objections,
    followUpDate: partial.followUpDate ?? existing?.followUpDate,
    assignedTeam: partial.assignedTeam ?? existing?.assignedTeam,
    fullName: partial.fullName ?? existing?.fullName,
    phone: partial.phone ?? existing?.phone,
    email: partial.email ?? existing?.email,
    businessName: partial.businessName ?? existing?.businessName,
    location: partial.location ?? existing?.location,
    serviceNeeded: partial.serviceNeeded ?? existing?.serviceNeeded,
    mainChallenge: partial.mainChallenge ?? existing?.mainChallenge,
    budgetRange: partial.budgetRange ?? existing?.budgetRange,
    timeline: partial.timeline ?? existing?.timeline,
    preferredContact: partial.preferredContact ?? existing?.preferredContact,
    bestTimeToReach: partial.bestTimeToReach ?? existing?.bestTimeToReach,
    notes: partial.notes ?? existing?.notes,
    conversationSummary:
      partial.conversationSummary ?? existing?.conversationSummary,
    crmSummary: partial.crmSummary ?? existing?.crmSummary,
    conversationStage:
      partial.conversationStage ?? existing?.conversationStage,
    lastIntent: partial.lastIntent ?? existing?.lastIntent,
  };
  return upsertLead(lead);
}

export function getLead(id: string): LeadRecord | undefined {
  return leads.get(id);
}

export function getLeadBySession(sessionId: string): LeadRecord | undefined {
  return [...leads.values()].find((l) => l.sessionId === sessionId);
}

export function saveEscalation(payload: EscalationPayload): EscalationPayload {
  escalations.set(payload.id, payload);
  return payload;
}

export function saveAppointment(req: AppointmentRequest): AppointmentRequest {
  appointments.set(req.id, req);
  return req;
}

export function saveCrmSummary(record: CrmSummaryRecord): CrmSummaryRecord {
  crmSummaries.set(record.id, record);
  return record;
}

export function listLeads(): LeadRecord[] {
  return [...leads.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function listAppointments(): AppointmentRequest[] {
  return [...appointments.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function listEscalations(): EscalationPayload[] {
  return [...escalations.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function listCrmSummaries(): CrmSummaryRecord[] {
  return [...crmSummaries.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
