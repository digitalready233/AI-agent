import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey, platformDb } from "@/lib/platform/db";
import { jsonStore } from "./json-store";
import { isUuid } from "./uuid";
import type {
  Agent,
  AgentTask,
  Booking,
  Campaign,
  CampaignLead,
  Conversation,
  DashboardStats,
  Integration,
  KnowledgeBase,
  KnowledgeEntry,
  Lead,
  Message,
  Notification,
  Profile,
} from "./types";

export {
  groupConversationsByDate,
  groupLeadsBySource,
  sortConversationsRecent,
  sortLeadsRecent,
  type DashboardPeriod,
  parseDashboardPeriod,
} from "./dashboard-period";

export const listAgents = cache(async (organizationId: string): Promise<Agent[]> => {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("agents")
      .select("*")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false });
    return (data ?? []) as Agent[];
  }
  return jsonStore.getAgents(organizationId);
});

/** First active agent for the org, or creates a default sales agent if none exist. */
export async function ensurePrimaryAgent(organizationId: string, orgName?: string): Promise<Agent> {
  const agents = await listAgents(organizationId);
  const active = agents.find((a) => a.enabled && a.status === "active");
  if (active) return active;
  if (agents.length > 0) return agents[0];

  const now = new Date().toISOString();
  const agent: Agent = {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    name: "AI Sales Assistant",
    nickname: "Assistant",
    company_product_name: orgName ?? "Your Company",
    agent_type: "sales",
    position: "Sales Consultant",
    language: "en",
    tone: "professional",
    timezone: "Africa/Accra",
    voice: "alloy",
    voice_speed: 1,
    welcome_message:
      "Hello! I'm your AI sales assistant. How can I help you grow your business today?",
    system_prompt:
      "You are a helpful AI sales agent. Qualify leads, answer product questions using the knowledge base, and guide customers toward booking a consultation.",
    qualification_prompt: null,
    objection_prompt: null,
    handoff_rules: "Escalate when the customer asks for a human or expresses anger.",
    lead_scoring_rules: null,
    fallback_response: "Let me connect you with our team for the best answer.",
    channels: ["website"],
    status: "active",
    enabled: true,
    created_at: now,
    updated_at: now,
  };
  return saveAgent(agent);
}

export async function getAgent(id: string): Promise<Agent | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase.from("agents").select("*").eq("id", id).single();
    return (data as Agent) ?? null;
  }
  return (await jsonStore.getAgent(id)) ?? null;
}

export async function saveAgent(agent: Agent): Promise<Agent> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase.from("agents").upsert(agent).select().single();
    if (error) throw error;
    return data as Agent;
  }
  return jsonStore.upsertAgent(agent);
}

/** Hard-delete an agent and its knowledge-base links. Returns false if no row matched. */
export async function deleteAgent(
  id: string,
  organizationId: string
): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const supabase = hasServiceRoleKey() ? createAdminClient() : await platformDb();

    const { data: existing, error: lookupError } = await supabase
      .from("agents")
      .select("id")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return false;

    const { error: linkError } = await supabase
      .from("agent_knowledge_bases")
      .delete()
      .eq("agent_id", id);
    if (linkError) throw linkError;

    const { data: deleted, error: deleteError } = await supabase
      .from("agents")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("id");
    if (deleteError) throw deleteError;
    const ok = (deleted?.length ?? 0) > 0;
    if (ok) {
      await jsonStore.deleteAgent(id).catch(() => undefined);
    }
    return ok;
  }

  const agents = await jsonStore.getAgents(organizationId);
  if (!agents.some((a) => a.id === id)) return false;
  await jsonStore.deleteAgent(id);
  return true;
}

export async function getAgentKnowledgeBaseIds(agentId: string): Promise<string[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("agent_knowledge_bases")
      .select("knowledge_base_id")
      .eq("agent_id", agentId);
    return (data ?? []).map((r) => r.knowledge_base_id as string);
  }
  const links = await jsonStore.getAgentKnowledge(agentId);
  return links.map((l) => l.knowledge_base_id);
}

export async function linkAgentKnowledgeBases(
  agentId: string,
  knowledgeBaseIds: string[],
  organizationId?: string
): Promise<void> {
  const id = agentId?.trim();
  if (!isUuid(id)) {
    throw new Error("Invalid agent id — cannot update knowledge links.");
  }

  const uniqueIds = [
    ...new Set(knowledgeBaseIds.map((kbId) => kbId.trim()).filter(Boolean)),
  ];
  for (const kbId of uniqueIds) {
    if (!isUuid(kbId)) {
      throw new Error(`Invalid knowledge base id: ${kbId}`);
    }
  }

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();

    if (organizationId) {
      const { data: agent, error: agentError } = await supabase
        .from("agents")
        .select("id")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (agentError) throw agentError;
      if (!agent) throw new Error("Agent not found");
    }

    const { error: deleteError } = await supabase
      .from("agent_knowledge_bases")
      .delete()
      .eq("agent_id", id);
    if (deleteError) throw deleteError;

    if (uniqueIds.length > 0) {
      const { error } = await supabase.from("agent_knowledge_bases").insert(
        uniqueIds.map((knowledge_base_id) => ({
          agent_id: id,
          knowledge_base_id,
        }))
      );
      if (error) throw error;
    }

    await jsonStore.setAgentKnowledgeLinks(id, uniqueIds).catch(() => undefined);
    return;
  }
  await jsonStore.setAgentKnowledgeLinks(id, uniqueIds);
}

export const listLeads = cache(async (organizationId: string): Promise<Lead[]> => {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false });
    return (data ?? []) as Lead[];
  }
  return jsonStore.getLeads(organizationId);
});

export async function getLead(id: string): Promise<Lead | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase.from("leads").select("*").eq("id", id).single();
    return (data as Lead) ?? null;
  }
  const org = await jsonStore.getOrg();
  if (!org) return null;
  const all = await jsonStore.getLeads(org.id);
  return all.find((l) => l.id === id) ?? null;
}

export async function saveLead(lead: Lead): Promise<Lead> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase.from("leads").upsert(lead).select().single();
    if (error) throw error;
    return data as Lead;
  }
  return jsonStore.upsertLead(lead);
}

export async function deleteLead(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  await jsonStore.deleteLead(id);
}

export const listConversations = cache(
  async (organizationId: string): Promise<Conversation[]> => {
    if (isSupabaseConfigured()) {
      const supabase = await platformDb();
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("organization_id", organizationId)
        .order("updated_at", { ascending: false });
      return (data ?? []) as Conversation[];
    }
    return jsonStore.getConversations(organizationId);
  }
);

export async function getConversation(id: string): Promise<Conversation | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase.from("conversations").select("*").eq("id", id).single();
    return (data as Conversation) ?? null;
  }
  return (await jsonStore.getConversation(id)) ?? null;
}

export async function saveConversation(conversation: Conversation): Promise<Conversation> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("conversations")
      .upsert(conversation)
      .select()
      .single();
    if (error) throw error;
    return data as Conversation;
  }
  return jsonStore.upsertConversation(conversation);
}

export async function messageExistsByWhatsAppId(
  whatsappMessageId: string
): Promise<boolean> {
  if (!whatsappMessageId.trim()) return false;
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data: rows } = await supabase
      .from("messages")
      .select("id")
      .filter("metadata->>whatsapp_message_id", "eq", whatsappMessageId)
      .limit(1);
    return (rows?.length ?? 0) > 0;
  }
  return jsonStore.messageExistsByWhatsAppId(whatsappMessageId);
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    return (data ?? []) as Message[];
  }
  return jsonStore.getMessages(conversationId);
}

/** Latest message per conversation (for inbox previews). */
export async function getLastMessagePreviews(
  conversationIds: string[]
): Promise<Map<string, { content: string; created_at: string }>> {
  if (conversationIds.length === 0) return new Map();

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("messages")
      .select("conversation_id, content, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });

    const map = new Map<string, { content: string; created_at: string }>();
    for (const row of data ?? []) {
      const cid = row.conversation_id as string;
      if (!map.has(cid)) {
        map.set(cid, {
          content: String(row.content ?? ""),
          created_at: String(row.created_at),
        });
      }
    }
    return map;
  }

  return jsonStore.getLastMessagePreviews(conversationIds);
}

export async function saveMessage(message: Message): Promise<Message> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase.from("messages").insert(message).select().single();
    if (error) throw error;
    return data as Message;
  }
  return jsonStore.addMessage(message);
}

export async function saveNotification(notification: Notification): Promise<Notification> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("notifications")
      .insert(notification)
      .select()
      .single();
    if (error) throw error;
    return data as Notification;
  }
  return jsonStore.addNotification(notification);
}

export async function saveKnowledgeBase(kb: KnowledgeBase): Promise<KnowledgeBase> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase.from("knowledge_bases").upsert(kb).select().single();
    if (error) throw error;
    return data as KnowledgeBase;
  }
  return jsonStore.upsertKnowledgeBase(kb);
}

export async function saveKnowledgeEntry(entry: KnowledgeEntry): Promise<KnowledgeEntry> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("knowledge_entries")
      .upsert(entry)
      .select()
      .single();
    if (error) throw error;
    return data as KnowledgeEntry;
  }
  return jsonStore.upsertKnowledgeEntry(entry);
}

export async function deleteKnowledgeBase(id: string): Promise<void> {
  const kbId = id?.trim();
  if (!isUuid(kbId)) {
    throw new Error("Invalid knowledge base id.");
  }

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { error: entriesError } = await supabase
      .from("knowledge_entries")
      .delete()
      .eq("knowledge_base_id", kbId);
    if (entriesError) throw entriesError;

    const { error: linksError } = await supabase
      .from("agent_knowledge_bases")
      .delete()
      .eq("knowledge_base_id", kbId);
    if (linksError) throw linksError;

    const { error } = await supabase.from("knowledge_bases").delete().eq("id", kbId);
    if (error) throw error;

    await jsonStore.deleteKnowledgeBase(kbId).catch(() => undefined);
    return;
  }
  await jsonStore.deleteKnowledgeBase(kbId);
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { error } = await supabase.from("knowledge_entries").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  await jsonStore.deleteKnowledgeEntry(id);
}

export async function saveBooking(booking: Booking): Promise<Booking> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase.from("bookings").upsert(booking).select().single();
    if (error) throw error;
    return data as Booking;
  }
  return jsonStore.upsertBooking(booking);
}

export async function deleteBooking(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  await jsonStore.deleteBooking(id);
}

export async function saveAgentTask(task: AgentTask): Promise<AgentTask> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase.from("agent_tasks").upsert(task).select().single();
    if (error) throw error;
    return data as AgentTask;
  }
  return jsonStore.upsertAgentTask(task);
}

export async function deleteAgentTask(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { error } = await supabase.from("agent_tasks").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  await jsonStore.deleteAgentTask(id);
}

export async function saveIntegration(integration: Integration): Promise<Integration> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("integrations")
      .upsert(integration)
      .select()
      .single();
    if (error) throw error;
    return data as Integration;
  }
  return jsonStore.upsertIntegration(integration);
}

export const listBookings = cache(async (organizationId: string): Promise<Booking[]> => {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("organization_id", organizationId)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .order("meeting_date", { ascending: true });
    return (data ?? []) as Booking[];
  }
  return jsonStore.getBookings(organizationId);
});

export async function listKnowledgeBases(organizationId: string): Promise<KnowledgeBase[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("knowledge_bases")
      .select("*")
      .eq("organization_id", organizationId);
    return (data ?? []) as KnowledgeBase[];
  }
  return jsonStore.getKnowledgeBases(organizationId);
}

export async function getKnowledgeBase(
  id: string,
  organizationId?: string
): Promise<KnowledgeBase | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    let q = supabase.from("knowledge_bases").select("*").eq("id", id);
    if (organizationId) q = q.eq("organization_id", organizationId);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return (data as KnowledgeBase | null) ?? null;
  }
  const bases = await jsonStore.getKnowledgeBases(organizationId ?? "");
  return bases.find((k) => k.id === id) ?? null;
}

export async function listKnowledgeEntries(
  organizationId: string,
  kbId?: string
): Promise<KnowledgeEntry[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    let q = supabase.from("knowledge_entries").select("*").eq("organization_id", organizationId);
    if (kbId) q = q.eq("knowledge_base_id", kbId);
    const { data } = await q;
    return (data ?? []) as KnowledgeEntry[];
  }
  return jsonStore.getKnowledgeEntries(organizationId, kbId);
}

export const listCampaigns = cache(async (organizationId: string): Promise<Campaign[]> => {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .eq("organization_id", organizationId);
    return (data ?? []) as Campaign[];
  }
  return jsonStore.getCampaigns(organizationId);
});

export async function getCampaign(id: string): Promise<Campaign | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase.from("campaigns").select("*").eq("id", id).single();
    return (data as Campaign) ?? null;
  }
  return jsonStore.getCampaign(id);
}

export async function saveCampaign(campaign: Campaign): Promise<Campaign> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase.from("campaigns").upsert(campaign).select().single();
    if (error) throw error;
    return data as Campaign;
  }
  return jsonStore.upsertCampaign(campaign);
}

export async function deleteCampaign(id: string, organizationId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    await supabase.from("campaign_leads").delete().eq("campaign_id", id);
    await supabase.from("campaign_steps").delete().eq("campaign_id", id);
    await supabase.from("campaign_logs").delete().eq("campaign_id", id);
    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (error) throw error;
    return;
  }
  await jsonStore.deleteCampaign(id, organizationId);
}

export async function listCampaignLeads(campaignId: string): Promise<CampaignLead[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("campaign_leads")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });
    return (data ?? []) as CampaignLead[];
  }
  return jsonStore.getCampaignLeads(campaignId);
}

export async function saveCampaignLead(row: CampaignLead): Promise<CampaignLead> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("campaign_leads")
      .upsert(row)
      .select()
      .single();
    if (error) throw error;
    return data as CampaignLead;
  }
  return jsonStore.upsertCampaignLead(row);
}

export async function getCampaignLeadIds(campaignId: string): Promise<string[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("campaign_leads")
      .select("lead_id")
      .eq("campaign_id", campaignId);
    return (data ?? []).map((r) => r.lead_id as string);
  }
  return jsonStore.getCampaignLeadIds(campaignId);
}

export async function setCampaignLeads(
  campaignId: string,
  organizationId: string,
  leadIds: string[]
): Promise<void> {
  const unique = [...new Set(leadIds.filter(Boolean))];
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    await supabase.from("campaign_leads").delete().eq("campaign_id", campaignId);
    if (unique.length > 0) {
      const now = new Date().toISOString();
      const rows = unique.map((lead_id) => ({
        id: crypto.randomUUID(),
        campaign_id: campaignId,
        lead_id,
        organization_id: organizationId,
        status: "pending" as const,
        attempts: 0,
        channels_sent: [],
        current_step_index: 0,
        next_step_at: now,
        sequence_status: "active" as const,
        created_at: now,
      }));
      const { error } = await supabase.from("campaign_leads").insert(rows);
      if (error) throw error;
    }
    await syncVoiceCampaignQueueIfNeeded(campaignId);
    return;
  }
  await jsonStore.setCampaignLeads(campaignId, organizationId, unique);
  await syncVoiceCampaignQueueIfNeeded(campaignId);
}

async function syncVoiceCampaignQueueIfNeeded(campaignId: string): Promise<void> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return;
  const { isOutboundVoiceCampaign } = await import("./campaign-types");
  if (!isOutboundVoiceCampaign(campaign)) return;
  const { syncOutboundQueueForCampaign } = await import(
    "@/lib/voice/outbound-queue"
  );
  await syncOutboundQueueForCampaign(campaignId);
}

export async function countLeadsByCampaign(
  organizationId: string
): Promise<Record<string, number>> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("campaign_leads")
      .select("campaign_id")
      .eq("organization_id", organizationId);
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const cid = row.campaign_id as string;
      counts[cid] = (counts[cid] ?? 0) + 1;
    }
    return counts;
  }
  return jsonStore.countLeadsByCampaign(organizationId);
}

export async function getBookingForConversation(conversationId: string): Promise<Booking | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("bookings")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as Booking) ?? null;
  }
  return jsonStore.getBookingForConversation(conversationId);
}

export async function listAgentTasks(organizationId: string): Promise<AgentTask[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase.from("agent_tasks").select("*").eq("organization_id", organizationId);
    return (data ?? []) as AgentTask[];
  }
  return jsonStore.getAgentTasks(organizationId);
}

export async function listIntegrations(organizationId: string): Promise<Integration[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("integrations")
      .select("*")
      .eq("organization_id", organizationId);
    const rows = (data ?? []) as Integration[];
    if (rows.length === 0) {
      const { ensureDefaultIntegrations } = await import("./default-integrations");
      return ensureDefaultIntegrations(organizationId);
    }
    return rows;
  }
  const rows = await jsonStore.getIntegrations(organizationId);
  if (rows.length === 0) {
    const { ensureDefaultIntegrations } = await import("./default-integrations");
    return ensureDefaultIntegrations(organizationId);
  }
  return rows;
}

export async function listProfiles(organizationId: string): Promise<Profile[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase.from("profiles").select("*").eq("organization_id", organizationId);
    return (data ?? []) as Profile[];
  }
  const all = await jsonStore.getProfiles();
  return all.filter((p) => p.organization_id === organizationId);
}

export async function saveProfile(profile: Profile): Promise<Profile> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        role: profile.role,
        department: profile.department,
        status: profile.status,
        booking_email: profile.booking_email ?? null,
      })
      .eq("id", profile.id)
      .select()
      .single();
    if (error) throw error;
    return data as Profile;
  }
  const all = await jsonStore.getProfiles();
  const idx = all.findIndex((p) => p.id === profile.id);
  if (idx >= 0) all[idx] = profile;
  else all.push(profile);
  await jsonStore.saveProfiles(all);
  return profile;
}

export async function getDashboardStats(
  organizationId: string,
  period: import("./dashboard-period").DashboardPeriod = "30d"
): Promise<DashboardStats> {
  const { computeDashboardStatsFromRows } = await import("./dashboard-period");
  const { getCampaignMetrics } = await import("./campaign-automation-data");
  const { getVoiceMetrics } = await import("@/lib/voice/metrics");
  const { getDemoMetrics } = await import("@/lib/demo/metrics");
  const [leads, conversations, bookings, campaigns, campaignMetrics, voiceMetrics, demoMetrics] =
    await Promise.all([
      listLeads(organizationId),
      listConversations(organizationId),
      listBookings(organizationId),
      listCampaigns(organizationId),
      getCampaignMetrics(organizationId),
      getVoiceMetrics(organizationId, period),
      getDemoMetrics(organizationId, period),
    ]);

  return computeDashboardStatsFromRows(
    leads,
    conversations,
    bookings,
    period,
    campaigns,
    campaignMetrics,
    voiceMetrics,
    demoMetrics
  );
}

export async function getKnowledgeContextForAgent(
  agentId: string,
  organizationId?: string,
  options?: {
    strict?: boolean;
    userMessage?: string;
    workflowStage?: string | null;
    readybotStep?: import("./workflow/readybot-stage-engine").ReadybotPipelineStep | null;
  }
): Promise<string> {
  const strict = options?.strict ?? false;
  const kbIds = await getAgentKnowledgeBaseIds(agentId);
  let entries: KnowledgeEntry[] = [];

  if (kbIds.length > 0) {
    if (isSupabaseConfigured()) {
      const supabase = await platformDb();
      const { data } = await supabase
        .from("knowledge_entries")
        .select("*")
        .in("knowledge_base_id", kbIds)
        .in("status", ["active", "published"]);
      entries = (data ?? []) as KnowledgeEntry[];
      if (!entries.length) {
        const { data: allEntries } = await supabase
          .from("knowledge_entries")
          .select("*")
          .in("knowledge_base_id", kbIds);
        entries = (allEntries ?? []) as KnowledgeEntry[];
      }
    } else if (organizationId) {
      const all = await jsonStore.getKnowledgeEntries(organizationId);
      entries = all.filter((e) => kbIds.includes(e.knowledge_base_id));
    }
  }

  if (!entries.length) {
    if (strict) return "";
    try {
      const { loadKnowledgeBase } = await import("../knowledge");
      return await loadKnowledgeBase();
    } catch {
      return "";
    }
  }

  const { partitionKnowledgeEntries, retrieveReadybotPlaybookContext, formatCoreKnowledgeEntries } =
    await import("./knowledge/readybot-playbook-retrieval");

  const { playbook, core } = partitionKnowledgeEntries(entries);
  const coreBlock = formatCoreKnowledgeEntries(core);

  if (playbook.length > 0 && options?.userMessage?.trim()) {
    const playbookBlock = retrieveReadybotPlaybookContext(
      playbook,
      options.userMessage,
      {
        workflowStage: options.workflowStage,
        readybotStep: options.readybotStep,
      }
    );
    return [coreBlock, playbookBlock].filter(Boolean).join("\n\n");
  }

  if (playbook.length > 0 && playbook.length <= 12) {
    return formatCoreKnowledgeEntries(entries);
  }

  if (playbook.length > 0) {
    const stageOnly = retrieveReadybotPlaybookContext(playbook, "", {
      workflowStage: options?.workflowStage,
      readybotStep: options?.readybotStep,
    });
    return [coreBlock, stageOnly].filter(Boolean).join("\n\n");
  }

  return coreBlock;
}

export async function getConversationBySession(
  organizationId: string,
  agentId: string,
  sessionId: string
): Promise<Conversation | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("agent_id", agentId)
      .eq("session_id", sessionId)
      .maybeSingle();
    return (data as Conversation) ?? null;
  }
  const all = await jsonStore.getConversations(organizationId);
  return (
    all.find(
      (c) => c.agent_id === agentId && c.session_id === sessionId
    ) ?? null
  );
}

export async function findOrCreateConversationBySession(params: {
  organizationId: string;
  agentId: string;
  sessionId: string;
  channel: string;
}): Promise<Conversation> {
  const existing = await getConversationBySession(
    params.organizationId,
    params.agentId,
    params.sessionId
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  return saveConversation({
    id: crypto.randomUUID(),
    organization_id: params.organizationId,
    agent_id: params.agentId,
    session_id: params.sessionId,
    channel: params.channel,
    status: "ai_handling",
    created_at: now,
    updated_at: now,
  });
}

export async function listNotifications(
  organizationId: string,
  limit = 30
): Promise<Notification[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as Notification[];
  }
  const all = await jsonStore.getNotifications();
  return all
    .filter((n) => n.organization_id === organizationId)
    .slice(0, limit);
}

export async function markNotificationRead(
  organizationId: string,
  notificationId: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { error } = await supabase
      .from("notifications")
      .update({ status: "read" })
      .eq("id", notificationId)
      .eq("organization_id", organizationId);
    if (error) throw error;
    return;
  }
  await jsonStore.markNotificationRead(notificationId);
}
