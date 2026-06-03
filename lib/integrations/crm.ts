import { logEvent } from "../analytics";
import { crm } from "../config";
import { readJsonFile, writeJsonFile } from "../persistence/json-db";
import type { LeadRecord } from "../types";

const CRM_LEADS_FILE = "crm-leads.json";
const CRM_SYNC_LOG_FILE = "crm-sync-log.json";

export interface CrmSyncLogEntry {
  id: string;
  leadId: string;
  sessionId: string;
  at: string;
  localSaved: boolean;
  webhookDelivered: boolean;
  webhookError?: string;
}

export interface CrmSaveResult {
  localSaved: boolean;
  webhookDelivered: boolean;
  webhookSkipped: boolean;
  error?: string;
}

async function appendSyncLog(entry: Omit<CrmSyncLogEntry, "id" | "at">): Promise<void> {
  const log = await readJsonFile<CrmSyncLogEntry[]>(CRM_SYNC_LOG_FILE, []);
  log.push({
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    ...entry,
  });
  const trimmed = log.slice(-500);
  await writeJsonFile(CRM_SYNC_LOG_FILE, trimmed);
}

/** Persist lead to local CRM database file (always). Optionally POST to CRM_WEBHOOK_URL. */
export async function saveLeadToCrm(lead: LeadRecord): Promise<CrmSaveResult> {
  let localSaved = false;
  let webhookDelivered = false;
  let webhookSkipped = !crm.webhookUrl?.trim();
  let error: string | undefined;

  try {
    const all = await readJsonFile<Record<string, LeadRecord>>(CRM_LEADS_FILE, {});
    all[lead.id] = { ...lead, updatedAt: new Date().toISOString() };
    await writeJsonFile(CRM_LEADS_FILE, all);
    localSaved = true;
  } catch (e) {
    error = e instanceof Error ? e.message : "Local CRM save failed";
  }

  if (crm.webhookUrl?.trim()) {
    try {
      const res = await fetch(crm.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "lead.upsert",
          lead,
          syncedAt: new Date().toISOString(),
        }),
      });
      webhookDelivered = res.ok;
      if (!res.ok) {
        error = `Webhook HTTP ${res.status}`;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Webhook request failed";
    }
  }

  await appendSyncLog({
    leadId: lead.id,
    sessionId: lead.sessionId,
    localSaved,
    webhookDelivered,
    webhookError: error,
  });

  logEvent("crm_synced", lead.sessionId, lead.channel, {
    leadId: lead.id,
    localSaved,
    webhookDelivered,
    webhookSkipped,
    error,
  });

  return { localSaved, webhookDelivered, webhookSkipped, error };
}

/** @deprecated Use saveLeadToCrm */
export async function syncLeadToCrm(lead: LeadRecord): Promise<void> {
  await saveLeadToCrm(lead);
}

export async function listCrmLeads(): Promise<LeadRecord[]> {
  const all = await readJsonFile<Record<string, LeadRecord>>(CRM_LEADS_FILE, {});
  return Object.values(all).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
