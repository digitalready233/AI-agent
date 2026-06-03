/**
 * Local JSON persistence when Supabase is not configured (dev/demo).
 * Data lives in data/platform/*.json
 */
import { readJsonFile, writeJsonFile } from "../persistence/json-db";
import type { OrganizationSettingsRecord } from "./settings-types";
import type { CalendarSettings } from "../calendar/types";
import type { WhatsAppSettings } from "../whatsapp/types";
import type {
  CallEvent,
  CallRecord,
  CallTranscriptSegment,
  OutboundCallQueueItem,
  VoiceIntegration,
} from "../voice/types";
import type { CampaignLog, CampaignStep, MessageTemplate } from "./campaign-types";
import type {
  Agent,
  AgentTask,
  Booking,
  Campaign,
  CampaignLead,
  Conversation,
  Integration,
  KnowledgeBase,
  KnowledgeEntry,
  Lead,
  Message,
  Notification,
  Organization,
  Profile,
} from "./types";

const FILES = {
  org: "platform/organization.json",
  profiles: "platform/profiles.json",
  agents: "platform/agents.json",
  knowledgeBases: "platform/knowledge-bases.json",
  knowledgeEntries: "platform/knowledge-entries.json",
  agentKb: "platform/agent-knowledge.json",
  leads: "platform/leads.json",
  conversations: "platform/conversations.json",
  messages: "platform/messages.json",
  bookings: "platform/bookings.json",
  campaigns: "platform/campaigns.json",
  campaignLeads: "platform/campaign-leads.json",
  messageTemplates: "platform/message-templates.json",
  campaignSteps: "platform/campaign-steps.json",
  campaignLogs: "platform/campaign-logs.json",
  agentTasks: "platform/agent-tasks.json",
  integrations: "platform/integrations.json",
  notifications: "platform/notifications.json",
  orgSettings: "platform/organization-settings.json",
  orgSecrets: "platform/organization-secrets.json",
  calendarSettings: "platform/calendar-settings.json",
  whatsappSettings: "platform/whatsapp-settings.json",
  voiceIntegrations: "platform/voice-integrations.json",
  calls: "platform/calls.json",
  callEvents: "platform/call-events.json",
  callTranscripts: "platform/call-transcripts.json",
  outboundCallQueue: "platform/outbound-call-queue.json",
} as const;

type OrgSecretRow = {
  organization_id: string;
  secret_key: string;
  encrypted_value: string;
};

type StoreMap = {
  org: Organization | null;
  profiles: Profile[];
  agents: Agent[];
  knowledgeBases: KnowledgeBase[];
  knowledgeEntries: KnowledgeEntry[];
  agentKb: { id: string; agent_id: string; knowledge_base_id: string; created_at: string }[];
  leads: Lead[];
  conversations: Conversation[];
  messages: Message[];
  bookings: Booking[];
  campaigns: Campaign[];
  campaignLeads: CampaignLead[];
  messageTemplates: MessageTemplate[];
  campaignSteps: CampaignStep[];
  campaignLogs: CampaignLog[];
  agentTasks: AgentTask[];
  integrations: Integration[];
  notifications: Notification[];
  orgSettings: OrganizationSettingsRecord[];
  orgSecrets: OrgSecretRow[];
  calendarSettings: CalendarSettings[];
  whatsappSettings: WhatsAppSettings[];
  voiceIntegrations: VoiceIntegration[];
  calls: CallRecord[];
  callEvents: CallEvent[];
  callTranscripts: CallTranscriptSegment[];
  outboundCallQueue: OutboundCallQueueItem[];
};

const cache: Partial<StoreMap> = {};
let hydrated = false;

async function load<K extends keyof StoreMap>(
  key: K,
  fallback: StoreMap[K]
): Promise<StoreMap[K]> {
  if (!hydrated) {
    cache.org = await readJsonFile(FILES.org, null as Organization | null);
    cache.profiles = await readJsonFile(FILES.profiles, []);
    cache.agents = await readJsonFile(FILES.agents, []);
    cache.knowledgeBases = await readJsonFile(FILES.knowledgeBases, []);
    cache.knowledgeEntries = await readJsonFile(FILES.knowledgeEntries, []);
    cache.agentKb = await readJsonFile(FILES.agentKb, []);
    cache.leads = await readJsonFile(FILES.leads, []);
    cache.conversations = await readJsonFile(FILES.conversations, []);
    cache.messages = await readJsonFile(FILES.messages, []);
    cache.bookings = await readJsonFile(FILES.bookings, []);
    cache.campaigns = await readJsonFile(FILES.campaigns, []);
    cache.campaignLeads = await readJsonFile(FILES.campaignLeads, []);
    cache.messageTemplates = await readJsonFile(FILES.messageTemplates, []);
    cache.campaignSteps = await readJsonFile(FILES.campaignSteps, []);
    cache.campaignLogs = await readJsonFile(FILES.campaignLogs, []);
    cache.agentTasks = await readJsonFile(FILES.agentTasks, []);
    cache.integrations = await readJsonFile(FILES.integrations, []);
    cache.notifications = await readJsonFile(FILES.notifications, []);
    cache.orgSettings = await readJsonFile(FILES.orgSettings, []);
    cache.orgSecrets = await readJsonFile(FILES.orgSecrets, []);
    cache.calendarSettings = await readJsonFile(FILES.calendarSettings, []);
    cache.whatsappSettings = await readJsonFile(FILES.whatsappSettings, []);
    hydrated = true;
  }
  return (cache[key] ?? fallback) as StoreMap[K];
}

async function save<K extends keyof typeof FILES>(key: K, data: StoreMap[K]): Promise<void> {
  cache[key] = data;
  await writeJsonFile(FILES[key], data);
}

export const jsonStore = {
  async getOrg() {
    return load("org", null);
  },
  async setOrg(org: Organization) {
    await save("org", org);
  },
  async getProfiles() {
    return load("profiles", []);
  },
  async saveProfiles(profiles: Profile[]) {
    await save("profiles", profiles);
  },
  async getAgents(orgId: string) {
    const all = await load("agents", []);
    return all.filter((a) => a.organization_id === orgId);
  },
  async getAgent(id: string) {
    const all = await load("agents", []);
    return all.find((a) => a.id === id);
  },
  async upsertAgent(agent: Agent) {
    const all = await load("agents", []);
    const idx = all.findIndex((a) => a.id === agent.id);
    if (idx >= 0) all[idx] = agent;
    else all.push(agent);
    await save("agents", all);
    return agent;
  },
  async deleteAgent(id: string) {
    const all = (await load("agents", [])).filter((a) => a.id !== id);
    await save("agents", all);
    const agentKb = (await load("agentKb", [])).filter((x) => x.agent_id !== id);
    await save("agentKb", agentKb);
  },
  async getKnowledgeBases(orgId: string) {
    return (await load("knowledgeBases", [])).filter((k) => k.organization_id === orgId);
  },
  async getKnowledgeEntries(orgId: string, kbId?: string) {
    let entries = (await load("knowledgeEntries", [])).filter(
      (e) => e.organization_id === orgId
    );
    if (kbId) entries = entries.filter((e) => e.knowledge_base_id === kbId);
    return entries;
  },
  async upsertKnowledgeBase(kb: KnowledgeBase) {
    const all = await load("knowledgeBases", []);
    const idx = all.findIndex((k) => k.id === kb.id);
    if (idx >= 0) all[idx] = kb;
    else all.push(kb);
    await save("knowledgeBases", all);
    return kb;
  },
  async upsertKnowledgeEntry(entry: KnowledgeEntry) {
    const all = await load("knowledgeEntries", []);
    const idx = all.findIndex((e) => e.id === entry.id);
    if (idx >= 0) all[idx] = entry;
    else all.push(entry);
    await save("knowledgeEntries", all);
    return entry;
  },
  async getLeads(orgId: string) {
    return (await load("leads", [])).filter((l) => l.organization_id === orgId);
  },
  async upsertLead(lead: Lead) {
    const all = await load("leads", []);
    const idx = all.findIndex((l) => l.id === lead.id);
    if (idx >= 0) all[idx] = lead;
    else all.push(lead);
    await save("leads", all);
    return lead;
  },
  async deleteLead(id: string) {
    await save(
      "leads",
      (await load("leads", [])).filter((l) => l.id !== id)
    );
  },
  async getConversations(orgId: string) {
    return (await load("conversations", [])).filter((c) => c.organization_id === orgId);
  },
  async getConversation(id: string) {
    return (await load("conversations", [])).find((c) => c.id === id);
  },
  async upsertConversation(c: Conversation) {
    const all = await load("conversations", []);
    const idx = all.findIndex((x) => x.id === c.id);
    if (idx >= 0) all[idx] = c;
    else all.push(c);
    await save("conversations", all);
    return c;
  },
  async getMessages(conversationId: string) {
    return (await load("messages", [])).filter((m) => m.conversation_id === conversationId);
  },
  async addMessage(msg: Message) {
    const all = await load("messages", []);
    all.push(msg);
    await save("messages", all);
    return msg;
  },
  async getLastMessagePreviews(conversationIds: string[]) {
    const idSet = new Set(conversationIds);
    const all = await load("messages", []);
    const latest = new Map<string, Message>();
    for (const m of all) {
      if (!idSet.has(m.conversation_id)) continue;
      const prev = latest.get(m.conversation_id);
      if (!prev || m.created_at > prev.created_at) {
        latest.set(m.conversation_id, m);
      }
    }
    const out = new Map<string, { content: string; created_at: string }>();
    for (const [id, m] of latest) {
      out.set(id, { content: m.content, created_at: m.created_at });
    }
    return out;
  },
  async getNotifications() {
    return load("notifications", []);
  },
  async addNotification(n: Notification) {
    const all = await load("notifications", []);
    all.push(n);
    await save("notifications", all);
    return n;
  },
  async markNotificationRead(id: string) {
    const all = await load("notifications", []);
    const idx = all.findIndex((n) => n.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], status: "read" };
      await save("notifications", all);
    }
  },
  async getBookings(orgId: string) {
    return (await load("bookings", [])).filter((b) => b.organization_id === orgId);
  },
  async upsertBooking(b: Booking) {
    const all = await load("bookings", []);
    const idx = all.findIndex((x) => x.id === b.id);
    if (idx >= 0) all[idx] = b;
    else all.push(b);
    await save("bookings", all);
    return b;
  },
  async getCampaigns(orgId: string) {
    return (await load("campaigns", [])).filter((c) => c.organization_id === orgId);
  },
  async getCampaign(id: string) {
    const all = await load("campaigns", []);
    return all.find((c) => c.id === id) ?? null;
  },
  async upsertCampaign(c: Campaign) {
    const all = await load("campaigns", []);
    const idx = all.findIndex((x) => x.id === c.id);
    if (idx >= 0) all[idx] = c;
    else all.push(c);
    await save("campaigns", all);
    return c;
  },
  async deleteCampaign(id: string, orgId: string) {
    await save(
      "campaigns",
      (await load("campaigns", [])).filter((c) => c.id !== id)
    );
    await save(
      "campaignLeads",
      (await load("campaignLeads", [])).filter((cl) => cl.campaign_id !== id)
    );
    await save(
      "campaignSteps",
      (await load("campaignSteps", [])).filter((s) => s.campaign_id !== id)
    );
    await save(
      "campaignLogs",
      (await load("campaignLogs", [])).filter((l) => l.campaign_id !== id)
    );
  },
  async getCampaignLeads(campaignId: string) {
    return (await load("campaignLeads", [])).filter((cl) => cl.campaign_id === campaignId);
  },
  async upsertCampaignLead(row: CampaignLead) {
    const all = await load("campaignLeads", []);
    const idx = all.findIndex((cl) => cl.id === row.id);
    if (idx >= 0) all[idx] = row;
    else all.push(row);
    await save("campaignLeads", all);
    return row;
  },
  async getCampaignLeadIds(campaignId: string) {
    return (await this.getCampaignLeads(campaignId)).map((cl) => cl.lead_id);
  },
  async setCampaignLeads(campaignId: string, orgId: string, leadIds: string[]) {
    const rest = (await load("campaignLeads", [])).filter((cl) => cl.campaign_id !== campaignId);
    const now = new Date().toISOString();
    for (const lead_id of leadIds) {
      rest.push({
        id: crypto.randomUUID(),
        campaign_id: campaignId,
        lead_id,
        organization_id: orgId,
        status: "pending",
        attempts: 0,
        channels_sent: [],
        current_step_index: 0,
        next_step_at: now,
        sequence_status: "active",
        created_at: now,
      });
    }
    await save("campaignLeads", rest);
  },
  async countLeadsByCampaign(orgId: string) {
    const counts: Record<string, number> = {};
    for (const cl of await load("campaignLeads", [])) {
      if (cl.organization_id !== orgId) continue;
      counts[cl.campaign_id] = (counts[cl.campaign_id] ?? 0) + 1;
    }
    return counts;
  },
  async getBookingForConversation(conversationId: string) {
    const all = await load("bookings", []);
    return (
      all
        .filter((b) => b.conversation_id === conversationId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
    );
  },
  async getAgentTasks(orgId: string) {
    return (await load("agentTasks", [])).filter((t) => t.organization_id === orgId);
  },
  async upsertAgentTask(t: AgentTask) {
    const all = await load("agentTasks", []);
    const idx = all.findIndex((x) => x.id === t.id);
    if (idx >= 0) all[idx] = t;
    else all.push(t);
    await save("agentTasks", all);
    return t;
  },
  async getIntegrations(orgId: string) {
    return (await load("integrations", [])).filter((i) => i.organization_id === orgId);
  },
  async upsertIntegration(i: Integration) {
    const all = await load("integrations", []);
    const idx = all.findIndex((x) => x.id === i.id);
    if (idx >= 0) all[idx] = i;
    else all.push(i);
    await save("integrations", all);
    return i;
  },
  async getAgentKnowledge(agentId: string) {
    return (await load("agentKb", [])).filter((x) => x.agent_id === agentId);
  },
  async linkAgentKnowledge(agentId: string, knowledgeBaseId: string) {
    const all = await load("agentKb", []);
    if (!all.some((x) => x.agent_id === agentId && x.knowledge_base_id === knowledgeBaseId)) {
      all.push({
        id: crypto.randomUUID(),
        agent_id: agentId,
        knowledge_base_id: knowledgeBaseId,
        created_at: new Date().toISOString(),
      });
      await save("agentKb", all);
    }
  },
  async setAgentKnowledgeLinks(agentId: string, knowledgeBaseIds: string[]) {
    const all = (await load("agentKb", [])).filter((x) => x.agent_id !== agentId);
    const now = new Date().toISOString();
    for (const knowledgeBaseId of knowledgeBaseIds) {
      all.push({
        id: crypto.randomUUID(),
        agent_id: agentId,
        knowledge_base_id: knowledgeBaseId,
        created_at: now,
      });
    }
    await save("agentKb", all);
  },
  async deleteKnowledgeBase(id: string) {
    await save(
      "knowledgeBases",
      (await load("knowledgeBases", [])).filter((k) => k.id !== id)
    );
    await save(
      "knowledgeEntries",
      (await load("knowledgeEntries", [])).filter((e) => e.knowledge_base_id !== id)
    );
    const agentKb = (await load("agentKb", [])).filter((x) => x.knowledge_base_id !== id);
    await save("agentKb", agentKb);
  },
  async deleteKnowledgeEntry(id: string) {
    await save(
      "knowledgeEntries",
      (await load("knowledgeEntries", [])).filter((e) => e.id !== id)
    );
  },
  async deleteBooking(id: string) {
    await save(
      "bookings",
      (await load("bookings", [])).filter((b) => b.id !== id)
    );
  },
  async deleteAgentTask(id: string) {
    await save(
      "agentTasks",
      (await load("agentTasks", [])).filter((t) => t.id !== id)
    );
  },
  async getOrganizationSettings(organizationId: string) {
    const all = await load("orgSettings", []);
    return all.find((s) => s.organization_id === organizationId) ?? null;
  },
  async setOrganizationSettings(settings: OrganizationSettingsRecord) {
    const all = await load("orgSettings", []);
    const idx = all.findIndex((s) => s.organization_id === settings.organization_id);
    if (idx >= 0) all[idx] = settings;
    else all.push(settings);
    await save("orgSettings", all);
    return settings;
  },
  async getOrganizationSecret(organizationId: string, secretKey: string) {
    const all = await load("orgSecrets", []);
    return (
      all.find(
        (s) => s.organization_id === organizationId && s.secret_key === secretKey
      )?.encrypted_value ?? null
    );
  },
  async setOrganizationSecret(
    organizationId: string,
    secretKey: string,
    encrypted_value: string
  ) {
    const all = await load("orgSecrets", []);
    const idx = all.findIndex(
      (s) => s.organization_id === organizationId && s.secret_key === secretKey
    );
    const row: OrgSecretRow = { organization_id: organizationId, secret_key: secretKey, encrypted_value };
    if (idx >= 0) all[idx] = row;
    else all.push(row);
    await save("orgSecrets", all);
  },
  async deleteOrganizationSecret(organizationId: string, secretKey: string) {
    await save(
      "orgSecrets",
      (await load("orgSecrets", [])).filter(
        (s) =>
          !(
            s.organization_id === organizationId && s.secret_key === secretKey
          )
      )
    );
  },
  async getCalendarSettings(organizationId: string) {
    const all = await load("calendarSettings", []);
    return all.find((s) => s.organization_id === organizationId) ?? null;
  },
  async setCalendarSettings(settings: CalendarSettings) {
    const all = await load("calendarSettings", []);
    const idx = all.findIndex((s) => s.organization_id === settings.organization_id);
    if (idx >= 0) all[idx] = settings;
    else all.push(settings);
    await save("calendarSettings", all);
    return settings;
  },
  async getWhatsAppSettings(organizationId: string) {
    const all = await load("whatsappSettings", []);
    return all.find((s) => s.organization_id === organizationId) ?? null;
  },
  async listAllWhatsAppSettings() {
    return load("whatsappSettings", []);
  },
  async setWhatsAppSettings(settings: WhatsAppSettings) {
    const all = await load("whatsappSettings", []);
    const idx = all.findIndex((s) => s.organization_id === settings.organization_id);
    if (idx >= 0) all[idx] = settings;
    else all.push(settings);
    await save("whatsappSettings", all);
    return settings;
  },
  async messageExistsByWhatsAppId(whatsappMessageId: string) {
    const all = await load("messages", []);
    return all.some(
      (m) =>
        m.metadata &&
        typeof m.metadata === "object" &&
        (m.metadata as { whatsapp_message_id?: string }).whatsapp_message_id ===
          whatsappMessageId
    );
  },
  async getMessageTemplates(orgId: string) {
    return (await load("messageTemplates", [])).filter((t) => t.organization_id === orgId);
  },
  async getMessageTemplate(id: string) {
    return (await load("messageTemplates", [])).find((t) => t.id === id) ?? null;
  },
  async upsertMessageTemplate(t: MessageTemplate) {
    const all = await load("messageTemplates", []);
    const idx = all.findIndex((x) => x.id === t.id);
    if (idx >= 0) all[idx] = t;
    else all.push(t);
    await save("messageTemplates", all);
    return t;
  },
  async deleteMessageTemplate(id: string, orgId: string) {
    await save(
      "messageTemplates",
      (await load("messageTemplates", [])).filter(
        (t) => !(t.id === id && t.organization_id === orgId)
      )
    );
  },
  async getCampaignSteps(campaignId: string) {
    return (await load("campaignSteps", []))
      .filter((s) => s.campaign_id === campaignId)
      .sort((a, b) => a.step_order - b.step_order);
  },
  async replaceCampaignSteps(
    campaignId: string,
    organizationId: string,
    steps: CampaignStep[]
  ) {
    const rest = (await load("campaignSteps", [])).filter((s) => s.campaign_id !== campaignId);
    await save("campaignSteps", [...rest, ...steps]);
    return steps;
  },
  async addCampaignLog(log: CampaignLog) {
    const all = await load("campaignLogs", []);
    all.push(log);
    await save("campaignLogs", all);
    return log;
  },
  async getCampaignLogs(campaignId: string, limit: number) {
    return (await load("campaignLogs", []))
      .filter((l) => l.campaign_id === campaignId)
      .sort((a, b) => b.sent_at.localeCompare(a.sent_at))
      .slice(0, limit);
  },
  async listDueCampaignLeads(organizationId: string | undefined, nowIso: string) {
    return (await load("campaignLeads", []))
      .filter((cl) => {
        if (cl.sequence_status !== "active") return false;
        if (cl.status === "replied" || cl.status === "skipped") return false;
        if (!cl.next_step_at) return false;
        if (new Date(cl.next_step_at) > new Date(nowIso)) return false;
        if (organizationId && cl.organization_id !== organizationId) return false;
        return true;
      })
      .map((cl) => ({
        campaign_lead_id: cl.id,
        campaign_id: cl.campaign_id,
        lead_id: cl.lead_id,
        organization_id: cl.organization_id,
        current_step_index: cl.current_step_index ?? 0,
        next_step_at: cl.next_step_at!,
      }));
  },
  async listLiveCampaigns() {
    return (await load("campaigns", [])).filter(
      (c) => c.status === "live" || c.status === "scheduled"
    );
  },
  async getActiveCampaignLeadsForLead(organizationId: string, leadId: string) {
    return (await load("campaignLeads", [])).filter(
      (cl) =>
        cl.organization_id === organizationId &&
        cl.lead_id === leadId &&
        cl.sequence_status === "active"
    );
  },
  async getCampaignMetrics(organizationId: string) {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString();
    const logs = (await load("campaignLogs", [])).filter(
      (l) => l.organization_id === organizationId && l.sent_at >= sinceIso
    );
    const sent = logs.filter((r) => r.status === "sent" || r.status === "delivered").length;
    const failed = logs.filter((r) => r.status === "failed").length;
    const replies = logs.filter((r) => r.status === "replied").length;
    const byCampaign: Record<string, number> = {};
    for (const r of logs) {
      if (r.status === "sent" || r.status === "delivered") {
        byCampaign[r.campaign_id] = (byCampaign[r.campaign_id] ?? 0) + 1;
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
    const campaigns = (await load("campaigns", [])).filter(
      (c) => c.organization_id === organizationId
    );
    const topName = topCampaignId
      ? campaigns.find((c) => c.id === topCampaignId)?.name ?? null
      : null;
    const bookingConversions = campaigns.reduce((acc, c) => {
      const r = c.follow_up_rules as Record<string, unknown> | undefined;
      return acc + (typeof r?.booking_conversions === "number" ? r.booking_conversions : 0);
    }, 0);
    return {
      messagesSent: sent,
      replies,
      failed,
      bookingConversions,
      topCampaignName: topName,
    };
  },
  async getVoiceIntegration(organizationId: string) {
    return (
      (await load("voiceIntegrations", [])).find(
        (v) => v.organization_id === organizationId
      ) ?? null
    );
  },
  async setVoiceIntegration(settings: VoiceIntegration) {
    const all = await load("voiceIntegrations", []);
    const idx = all.findIndex((v) => v.organization_id === settings.organization_id);
    if (idx >= 0) all[idx] = settings;
    else all.push(settings);
    await save("voiceIntegrations", all);
    return settings;
  },
  async listAllVoiceIntegrations() {
    return load("voiceIntegrations", []);
  },
  async getCalls(organizationId: string) {
    return (await load("calls", []))
      .filter((c) => c.organization_id === organizationId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async listAllCalls() {
    return load("calls", []);
  },
  async upsertCall(call: CallRecord) {
    const all = await load("calls", []);
    const idx = all.findIndex((c) => c.id === call.id);
    if (idx >= 0) all[idx] = call;
    else all.push(call);
    await save("calls", all);
    return call;
  },
  async appendCallEvent(event: CallEvent) {
    const all = await load("callEvents", []);
    all.push(event);
    await save("callEvents", all);
    return event;
  },
  async getCallEvents(callId: string) {
    return (await load("callEvents", []))
      .filter((e) => e.call_id === callId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  },
  async appendCallTranscript(segment: CallTranscriptSegment) {
    const all = await load("callTranscripts", []);
    all.push(segment);
    await save("callTranscripts", all);
  },
  async getCallTranscripts(callId: string) {
    return (await load("callTranscripts", []))
      .filter((t) => t.call_id === callId)
      .sort((a, b) => a.sequence_num - b.sequence_num);
  },
  async listOutboundCallQueue(campaignId?: string, organizationId?: string) {
    let rows = await load("outboundCallQueue", []);
    if (campaignId) rows = rows.filter((r) => r.campaign_id === campaignId);
    if (organizationId) {
      rows = rows.filter((r) => r.organization_id === organizationId);
    }
    return rows;
  },
  async upsertOutboundCallQueueItem(item: OutboundCallQueueItem) {
    const all = await load("outboundCallQueue", []);
    const idx = all.findIndex((r) => r.id === item.id);
    if (idx >= 0) all[idx] = item;
    else all.push(item);
    await save("outboundCallQueue", all);
    return item;
  },
  async deleteOutboundCallQueueForCampaign(campaignId: string) {
    const all = await load("outboundCallQueue", []);
    await save(
      "outboundCallQueue",
      all.filter((r) => r.campaign_id !== campaignId)
    );
  },
};
