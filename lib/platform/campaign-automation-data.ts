import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import { jsonStore } from "./json-store";
import type { CampaignLog, CampaignStep, MessageTemplate } from "./campaign-types";

function normalizeTemplate(row: MessageTemplate): MessageTemplate {
  return {
    ...row,
    variables: Array.isArray(row.variables) ? row.variables : [],
  };
}

export async function listMessageTemplates(
  organizationId: string
): Promise<MessageTemplate[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("message_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false });
    return ((data ?? []) as MessageTemplate[]).map(normalizeTemplate);
  }
  return jsonStore.getMessageTemplates(organizationId);
}

export async function getMessageTemplate(id: string): Promise<MessageTemplate | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("message_templates")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return data ? normalizeTemplate(data as MessageTemplate) : null;
  }
  return jsonStore.getMessageTemplate(id);
}

export async function saveMessageTemplate(
  template: MessageTemplate
): Promise<MessageTemplate> {
  const row = normalizeTemplate({
    ...template,
    updated_at: new Date().toISOString(),
  });
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("message_templates")
      .upsert(row)
      .select()
      .single();
    if (error) throw error;
    return normalizeTemplate(data as MessageTemplate);
  }
  return jsonStore.upsertMessageTemplate(row);
}

export async function deleteMessageTemplate(
  id: string,
  organizationId: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    await supabase
      .from("message_templates")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    return;
  }
  await jsonStore.deleteMessageTemplate(id, organizationId);
}

export async function listCampaignSteps(campaignId: string): Promise<CampaignStep[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("campaign_steps")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("step_order", { ascending: true });
    return (data ?? []) as CampaignStep[];
  }
  return jsonStore.getCampaignSteps(campaignId);
}

export async function replaceCampaignSteps(
  campaignId: string,
  organizationId: string,
  steps: Omit<CampaignStep, "created_at" | "updated_at">[]
): Promise<CampaignStep[]> {
  const now = new Date().toISOString();
  const rows: CampaignStep[] = steps.map((s) => ({
    ...s,
    campaign_id: campaignId,
    organization_id: organizationId,
    created_at: now,
    updated_at: now,
  }));

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    await supabase.from("campaign_steps").delete().eq("campaign_id", campaignId);
    if (rows.length) {
      const { data, error } = await supabase.from("campaign_steps").insert(rows).select();
      if (error) throw error;
      return (data ?? []) as CampaignStep[];
    }
    return [];
  }
  return jsonStore.replaceCampaignSteps(campaignId, organizationId, rows);
}

export async function saveCampaignLog(log: CampaignLog): Promise<CampaignLog> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("campaign_logs")
      .insert(log)
      .select()
      .single();
    if (error) throw error;
    return data as CampaignLog;
  }
  return jsonStore.addCampaignLog(log);
}

export async function listCampaignLogs(
  campaignId: string,
  limit = 100
): Promise<CampaignLog[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("campaign_logs")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("sent_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as CampaignLog[];
  }
  return jsonStore.getCampaignLogs(campaignId, limit);
}

export async function listDueCampaignLeads(
  organizationId?: string
): Promise<
  Array<{
    campaign_lead_id: string;
    campaign_id: string;
    lead_id: string;
    organization_id: string;
    current_step_index: number;
    next_step_at: string;
  }>
> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    let q = supabase
      .from("campaign_leads")
      .select(
        "id, campaign_id, lead_id, organization_id, current_step_index, next_step_at, status"
      )
      .eq("sequence_status", "active")
      .lte("next_step_at", now);

    if (organizationId) q = q.eq("organization_id", organizationId);

    const { data } = await q.limit(200);
    return (data ?? [])
      .filter((r) => r.status !== "replied" && r.status !== "skipped")
      .map((r) => ({
      campaign_lead_id: r.id as string,
      campaign_id: r.campaign_id as string,
      lead_id: r.lead_id as string,
      organization_id: r.organization_id as string,
      current_step_index: (r.current_step_index as number) ?? 0,
      next_step_at: r.next_step_at as string,
    }));
  }
  return jsonStore.listDueCampaignLeads(organizationId, now);
}

export async function listLiveCampaigns(organizationId?: string) {
  const { listCampaigns } = await import("./data");
  if (organizationId) {
    const all = await listCampaigns(organizationId);
    return all.filter((c) => c.status === "live" || c.status === "scheduled");
  }
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .in("status", ["live", "scheduled"]);
    return data ?? [];
  }
  return jsonStore.listLiveCampaigns();
}

export async function getCampaignMetrics(organizationId: string) {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString();

    const { data: logs } = await supabase
      .from("campaign_logs")
      .select("status, campaign_id, sent_at")
      .eq("organization_id", organizationId)
      .gte("sent_at", sinceIso);

    const rows = logs ?? [];
    const sent = rows.filter((r) => r.status === "sent" || r.status === "delivered").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    const replies = rows.filter((r) => r.status === "replied").length;

    const byCampaign: Record<string, number> = {};
    for (const r of rows) {
      if (r.status === "sent" || r.status === "delivered") {
        const cid = r.campaign_id as string;
        byCampaign[cid] = (byCampaign[cid] ?? 0) + 1;
      }
    }
    let topCampaignId: string | null = null;
    let topCount = 0;
    for (const [cid, count] of Object.entries(byCampaign)) {
      if (count > topCount) {
        topCount = count;
        topCampaignId = cid;
      }
    }

    const { listCampaigns } = await import("./data");
    const campaigns = await listCampaigns(organizationId);
    const topName = topCampaignId
      ? campaigns.find((c) => c.id === topCampaignId)?.name ?? null
      : null;

    const rulesSum = campaigns.reduce((acc, c) => {
      const r = c.follow_up_rules as Record<string, unknown> | undefined;
      return acc + (typeof r?.booking_conversions === "number" ? r.booking_conversions : 0);
    }, 0);

    return {
      messagesSent: sent,
      replies,
      failed,
      bookingConversions: rulesSum,
      topCampaignName: topName,
    };
  }

  return jsonStore.getCampaignMetrics(organizationId);
}
