import {
  findOrCreateConversationBySession,
  getAgent,
  getLead,
  saveConversation,
  saveLead,
} from "@/lib/platform/data";
import { saveDemoSession } from "./demo-data";
import { applyAvatarProviderToDemoSession } from "@/lib/avatar/apply-demo-avatar-selection";
import { setupMultiAgentDemoSession } from "@/lib/demo/multi-agent/session-setup";
import { getMultiAgentDemoSettings } from "@/lib/demo/multi-agent/settings";
import {
  applyMultiAgentFieldsToSession,
  type MultiAgentSessionConfig,
} from "@/lib/demo/multi-agent/apply-session-team";
import type { DemoSession } from "./types";

export type CreateDemoForLeadResult = {
  session: DemoSession;
  roomUrl: string;
  absoluteUrl?: string;
};

export async function createDemoSessionForLead(params: {
  organizationId: string;
  leadId: string;
  agentId: string;
  siteOrigin?: string;
  title?: string;
  multiAgent?: MultiAgentSessionConfig;
}): Promise<CreateDemoForLeadResult> {
  const lead = await getLead(params.leadId);
  if (!lead || lead.organization_id !== params.organizationId) {
    throw new Error("Lead not found");
  }

  const agent = await getAgent(params.agentId);
  if (!agent || agent.organization_id !== params.organizationId || !agent.enabled) {
    throw new Error("Agent not found");
  }

  const now = new Date().toISOString();
  const sessionId = crypto.randomUUID();
  const roomPath = `/demo-room/${sessionId}`;
  const title =
    params.title?.trim() ||
    `Demo${lead.full_name ? ` — ${lead.full_name}` : ""}`;

  let conversation = await findOrCreateConversationBySession({
    organizationId: params.organizationId,
    agentId: agent.id,
    sessionId,
    channel: "demo_call",
  });
  conversation = await saveConversation({
    ...conversation,
    lead_id: lead.id,
    customer_name: lead.full_name,
    customer_email: lead.email,
    customer_phone: lead.phone,
    updated_at: now,
  });

  const session: DemoSession = {
    id: sessionId,
    organization_id: params.organizationId,
    agent_id: agent.id,
    lead_id: lead.id,
    conversation_id: conversation.id,
    booking_id: null,
    title,
    demo_type: "product",
    status: "scheduled",
    current_demo_stage: "welcome",
    entry_mode: "scheduled",
    demo_path_id: null,
    current_demo_asset_id: null,
    objections: [],
    qualification_progress: { need: false, budget: false, authority: false, timeline: false },
    started_at: null,
    ended_at: null,
    duration_seconds: null,
    summary: null,
    transcript: null,
    detected_intent: lead.service_interest ?? null,
    lead_score: lead.lead_score ?? null,
    lead_category: lead.lead_category ?? null,
    handoff_required: false,
    booking_recommended: false,
    recommended_next_action: "Share demo link with prospect",
    recording_url: null,
    metadata: {
      room_url: roomPath,
      video_providers: ["livekit", "daily", "zoom", "agora"],
      created_from: "crm",
    },
    created_at: now,
    updated_at: now,
  };

  const sessionToSave = applyMultiAgentFieldsToSession(session, params.multiAgent);
  const saved = await saveDemoSession(sessionToSave);
  const multiSettings = await getMultiAgentDemoSettings(params.organizationId);
  const runMultiAgent =
    saved.multi_agent_enabled === true ||
    (saved.multi_agent_enabled !== false && multiSettings.enabled);
  const withMulti = runMultiAgent
    ? await setupMultiAgentDemoSession(saved, {
        enabled: saved.multi_agent_enabled ?? multiSettings.enabled,
        mode: saved.multi_agent_assignment_mode,
      })
    : saved;
  const withAvatar = await applyAvatarProviderToDemoSession(withMulti);

  const noteLine = `Demo link: ${roomPath}`;
  await saveLead({
    ...lead,
    notes: [lead.notes, noteLine].filter(Boolean).join("\n\n"),
    next_action: lead.next_action ?? "Complete browser demo",
    updated_at: now,
  });

  const absoluteUrl = params.siteOrigin
    ? `${params.siteOrigin.replace(/\/$/, "")}${roomPath}`
    : undefined;

  return {
    session: withAvatar,
    roomUrl: roomPath,
    absoluteUrl,
  };
}
