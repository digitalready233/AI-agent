import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import { jsonStore } from "@/lib/platform/json-store";
import type { CallOutcome, OutboundCallQueueItem, OutboundQueueStatus } from "./types";

export async function listQueueForCampaign(
  campaignId: string
): Promise<OutboundCallQueueItem[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("outbound_call_queue")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("scheduled_at", { ascending: true });
    return (data as OutboundCallQueueItem[]) ?? [];
  }
  return jsonStore.listOutboundCallQueue(campaignId);
}

export async function listDueQueueItems(
  organizationId: string,
  limit = 10
): Promise<OutboundCallQueueItem[]> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("outbound_call_queue")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(limit * 3);
    const rows = (data as OutboundCallQueueItem[]) ?? [];
    return rows
      .filter((r) => !r.next_attempt_at || r.next_attempt_at <= now)
      .slice(0, limit);
  }
  const all = await jsonStore.listOutboundCallQueue(undefined, organizationId);
  return all
    .filter((r) => {
      if (r.status !== "pending") return false;
      if (r.scheduled_at > now) return false;
      if (r.next_attempt_at && r.next_attempt_at > now) return false;
      return true;
    })
    .slice(0, limit);
}

export async function getQueueItemById(
  id: string
): Promise<OutboundCallQueueItem | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("outbound_call_queue")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return (data as OutboundCallQueueItem) ?? null;
  }
  const all = await jsonStore.listOutboundCallQueue();
  return all.find((r) => r.id === id) ?? null;
}

export async function saveQueueItem(
  item: OutboundCallQueueItem
): Promise<OutboundCallQueueItem> {
  const row = { ...item, updated_at: new Date().toISOString() };
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("outbound_call_queue")
      .upsert(row)
      .select()
      .single();
    if (error) {
      await jsonStore.upsertOutboundCallQueueItem(row);
      return row;
    }
    return data as OutboundCallQueueItem;
  }
  return jsonStore.upsertOutboundCallQueueItem(row);
}

export async function deleteQueueForCampaign(campaignId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    await supabase
      .from("outbound_call_queue")
      .delete()
      .eq("campaign_id", campaignId);
  }
  await jsonStore.deleteOutboundCallQueueForCampaign(campaignId);
}

export async function updateQueueItem(
  id: string,
  patch: Partial<
    Pick<
      OutboundCallQueueItem,
      | "status"
      | "attempt_count"
      | "last_attempt_at"
      | "next_attempt_at"
      | "call_outcome"
      | "error_message"
      | "last_call_id"
    >
  >
): Promise<OutboundCallQueueItem | null> {
  const existing = await getQueueItemById(id);
  if (!existing) return null;
  return saveQueueItem({ ...existing, ...patch });
}

export function queueStatusFromOutcome(
  outcome: CallOutcome | null,
  attemptCount: number,
  maxAttempts: number
): OutboundQueueStatus {
  if (outcome === "do_not_call") return "completed";
  if (
    outcome &&
    !["no_answer", "busy", "failed"].includes(outcome)
  ) {
    return "completed";
  }
  if (attemptCount >= maxAttempts) return "exhausted";
  return "pending";
}
