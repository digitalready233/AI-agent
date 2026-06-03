import { brand } from "@/lib/config";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { sendCampaignEmail, campaignEmailConfigured } from "@/lib/integrations/campaign-email";
import {
  sendCampaignWhatsApp,
  whatsappCampaignConfigured,
} from "@/lib/integrations/campaign-whatsapp";
import {
  getMessageTemplate,
  listCampaignSteps,
  saveCampaignLog,
} from "./campaign-automation-data";
import { touchLeadFromCampaign, resolveAssignedStaffName } from "./campaign-crm";
import { evaluateCampaignStop } from "./campaign-stop";
import {
  addDelay,
  isVoiceCampaignChannel,
  parseFollowUpRules,
  parseStopConditions,
  type CampaignFollowUpRules,
  type CampaignStep,
  type DelayUnit,
} from "./campaign-types";
import { defaultCampaignTemplate, renderCampaignMessage } from "./campaign-message";
import {
  findOrCreateConversationBySession,
  getAgent,
  getCampaign,
  getLead,
  listCampaignLeads,
  saveCampaign,
  saveCampaignLead,
  saveMessage,
} from "./data";
import type {
  Campaign,
  CampaignChannelMode,
  CampaignLead,
  CampaignRunResult,
  Conversation,
  Lead,
} from "./types";

function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return null;
  return digits;
}

function campaignChannelToMode(
  channel: string | null | undefined,
  rules: CampaignFollowUpRules
): CampaignChannelMode | undefined {
  if (isVoiceCampaignChannel(channel)) return undefined;
  if (channel === "whatsapp") return "whatsapp";
  if (channel === "email") return "email";
  return (rules.channel ?? "auto") as CampaignChannelMode;
}

function resolveChannels(
  mode: CampaignChannelMode | undefined,
  lead: Lead
): Array<"whatsapp" | "email"> {
  const hasPhone = Boolean(normalizePhone(lead.phone ?? ""));
  const hasEmail = Boolean(lead.email?.trim());

  if (mode === "whatsapp") return hasPhone ? ["whatsapp"] : [];
  if (mode === "email") return hasEmail ? ["email"] : [];
  if (mode === "both") {
    const ch: Array<"whatsapp" | "email"> = [];
    if (hasPhone) ch.push("whatsapp");
    if (hasEmail) ch.push("email");
    return ch;
  }
  if (hasPhone) return ["whatsapp"];
  if (hasEmail) return ["email"];
  return [];
}

function isDueForSend(
  cl: CampaignLead,
  delayHours: number,
  maxAttempts: number
): boolean {
  if (cl.status === "replied" || cl.status === "skipped") return false;
  if (cl.sequence_status === "paused" || cl.sequence_status === "stopped") return false;
  const attempts = cl.attempts ?? 0;
  if (attempts >= maxAttempts) return false;
  if (cl.status === "pending" && attempts === 0) return true;
  if (!cl.last_sent_at) return cl.status === "failed";
  const next = new Date(cl.last_sent_at);
  next.setHours(next.getHours() + delayHours);
  return new Date() >= next;
}

async function recordOutboundConversation(params: {
  organizationId: string;
  agentId: string;
  campaignId: string;
  lead: Lead;
  channel: "whatsapp" | "email";
  body: string;
}): Promise<void> {
  const sessionId = `campaign:${params.campaignId}:${params.lead.id}`;
  const conversation = await findOrCreateConversationBySession({
    organizationId: params.organizationId,
    agentId: params.agentId,
    sessionId,
    channel: params.channel,
  });

  const now = new Date().toISOString();
  await saveMessage({
    id: crypto.randomUUID(),
    conversation_id: conversation.id,
    sender_type: "assistant",
    content: params.body,
    metadata: {
      source: "campaign",
      campaign_id: params.campaignId,
      lead_id: params.lead.id,
      channel: params.channel,
      organization_id: params.organizationId,
    },
    created_at: now,
  });

  await saveConversationPatch(conversation.id, {
    customer_name: params.lead.full_name ?? conversation.customer_name,
    customer_email: params.lead.email ?? conversation.customer_email,
    customer_phone: params.lead.phone ?? conversation.customer_phone,
    lead_id: params.lead.id,
    conversation_stage: "follow_up",
    summary: `Campaign outreach (${params.channel})`,
    updated_at: now,
  });
}

async function saveConversationPatch(
  id: string,
  patch: Partial<Conversation>
): Promise<void> {
  const { getConversation, saveConversation } = await import("./data");
  const existing = await getConversation(id);
  if (!existing) return;
  await saveConversation({ ...existing, ...patch });
}

async function resolveStepBody(
  step: CampaignStep,
  campaign: Campaign,
  lead: Lead,
  orgName: string,
  staffName: string | null
): Promise<string> {
  if (step.message_body?.trim()) {
    return renderCampaignMessage(step.message_body, lead, {
      companyName: orgName,
      assignedStaffName: staffName,
    });
  }
  if (step.message_template_id) {
    const tpl = await getMessageTemplate(step.message_template_id);
    if (tpl?.body) {
      return renderCampaignMessage(tpl.body, lead, {
        companyName: orgName,
        assignedStaffName: staffName,
      });
    }
  }
  const rules = parseFollowUpRules(campaign.follow_up_rules);
  const fallback =
    rules.message_template?.trim() || defaultCampaignTemplate(orgName);
  return renderCampaignMessage(fallback, lead, {
    companyName: orgName,
    assignedStaffName: staffName,
  });
}

async function sendCampaignVoice(params: {
  campaign: Campaign;
  campaignLeadId: string;
  campaignStepId?: string | null;
  lead: Lead;
  body: string;
  followUpRules: CampaignFollowUpRules;
}): Promise<{ ok: boolean; channels: string[]; error?: string; callId?: string }> {
  const appOrigin =
    process.env.TWILIO_WEBHOOK_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";

  const { dialCampaignLead } = await import("@/lib/voice/outbound-dial");
  const { getVoiceIntegration } = await import("@/lib/voice/settings-data");
  const { hasTwilioAuthToken } = await import("@/lib/voice/credentials");

  const integration = await getVoiceIntegration(
    params.campaign.organization_id,
    appOrigin
  );
  const tokenOk = await hasTwilioAuthToken(params.campaign.organization_id);
  if (!tokenOk || !integration.twilio_phone_number?.trim()) {
    return {
      ok: false,
      channels: [],
      error: "Connect Twilio voice in Integrations → Voice before running voice campaigns",
    };
  }

  const { getOutboundVoiceSettings } = await import(
    "@/lib/voice/campaign-voice-settings"
  );
  const voiceSettings = getOutboundVoiceSettings(params.campaign);

  const dial = await dialCampaignLead({
    organizationId: params.campaign.organization_id,
    campaignId: params.campaign.id,
    campaignLeadId: params.campaignLeadId,
    campaignStepId: params.campaignStepId,
    agentId: params.campaign.agent_id!,
    lead: params.lead,
    appOrigin,
    openingScript: params.body,
    maxConcurrent: voiceSettings.max_concurrent_calls,
    humanTransferPhone: voiceSettings.human_transfer_phone,
  });

  if (!dial.ok) {
    return { ok: false, channels: [], error: dial.error };
  }
  return { ok: true, channels: ["voice"], callId: dial.callId };
}

async function sendToLead(params: {
  campaign: Campaign;
  campaignLeadId: string;
  campaignStepId?: string | null;
  lead: Lead;
  body: string;
  channelMode: CampaignChannelMode | undefined;
  orgName: string;
  followUpRules: CampaignFollowUpRules;
}): Promise<{ ok: boolean; channels: string[]; error?: string; callId?: string }> {
  if (isVoiceCampaignChannel(params.campaign.channel)) {
    return sendCampaignVoice({
      campaign: params.campaign,
      campaignLeadId: params.campaignLeadId,
      campaignStepId: params.campaignStepId,
      lead: params.lead,
      body: params.body,
      followUpRules: params.followUpRules,
    });
  }

  const channels = resolveChannels(params.channelMode, params.lead);
  if (channels.length === 0) {
    return { ok: false, channels: [], error: "Lead has no phone or email for selected channel" };
  }

  const sent: string[] = [];
  const errors: string[] = [];
  const agentId = params.campaign.agent_id!;

  for (const ch of channels) {
    if (ch === "whatsapp") {
      const phone = normalizePhone(params.lead.phone!);
      if (!phone) {
        errors.push("Invalid phone number");
        continue;
      }
      const res = await sendCampaignWhatsApp(
        phone,
        params.body,
        params.campaign.organization_id,
        {
          lead: params.lead,
          followUpRules: params.followUpRules,
          companyName: params.orgName,
        }
      );
      if (res.ok) {
        sent.push("whatsapp");
        await recordOutboundConversation({
          organizationId: params.campaign.organization_id,
          agentId,
          campaignId: params.campaign.id,
          lead: params.lead,
          channel: "whatsapp",
          body: params.body,
        });
      } else {
        errors.push(res.error ?? "WhatsApp send failed");
      }
    }

    if (ch === "email") {
      const to = params.lead.email!.trim();
      const subject = `${params.orgName} — following up`;
      const text = params.body;
      const html = `<p>${text.replace(/\n/g, "<br/>")}</p>`;
      const res = await sendCampaignEmail({
        to,
        subject,
        text,
        html,
        replyTo: process.env.CAMPAIGN_EMAIL_REPLY_TO?.trim(),
      });
      if (res.ok) {
        sent.push("email");
        await recordOutboundConversation({
          organizationId: params.campaign.organization_id,
          agentId,
          campaignId: params.campaign.id,
          lead: params.lead,
          channel: "email",
          body: params.body,
        });
      } else {
        errors.push(res.error ?? "Email send failed");
      }
    }
  }

  if (sent.length > 0) {
    return { ok: true, channels: sent, error: errors.length ? errors.join("; ") : undefined };
  }
  return { ok: false, channels: [], error: errors.join("; ") || "Send failed" };
}

export async function getCampaignChannelStatus(organizationId: string): Promise<{
  whatsapp: boolean;
  email: boolean;
  voice: boolean;
}> {
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  const { getVoiceIntegration } = await import("@/lib/voice/settings-data");
  const { hasTwilioAuthToken } = await import("@/lib/voice/credentials");
  const voice = await getVoiceIntegration(organizationId, appOrigin);
  const tokenOk = await hasTwilioAuthToken(organizationId);
  return {
    whatsapp: await whatsappCampaignConfigured(organizationId),
    email: campaignEmailConfigured(),
    voice: Boolean(tokenOk && voice.twilio_phone_number?.trim()),
  };
}

/** Flip scheduled campaigns to live when schedule time passed. */
export async function activateScheduledCampaigns(
  organizationId?: string
): Promise<number> {
  const { listCampaigns } = await import("./data");
  let campaigns: Campaign[] = [];
  if (organizationId) {
    campaigns = await listCampaigns(organizationId);
  } else if (isSupabaseConfigured()) {
    const supabase = await (await import("./db")).platformDb();
    const { data } = await supabase.from("campaigns").select("*");
    campaigns = (data ?? []) as Campaign[];
  } else {
    const { readJsonFile } = await import("../persistence/json-db");
    campaigns = (await readJsonFile("platform/campaigns.json", [])) as Campaign[];
  }

  const now = new Date();
  let count = 0;
  for (const c of campaigns) {
    if (c.status !== "scheduled") continue;
    if (organizationId && c.organization_id !== organizationId) continue;
    if (c.scheduled_at && new Date(c.scheduled_at) > now) continue;

    await saveCampaign({
      ...c,
      status: "live",
      updated_at: new Date().toISOString(),
    });
    await bootstrapCampaignLeadSchedule(c.id, c.organization_id);
    count += 1;
  }
  return count;
}

/** Set next_step_at for all pending leads when campaign goes live. */
export async function bootstrapCampaignLeadSchedule(
  campaignId: string,
  organizationId: string
): Promise<void> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return;

  const steps = campaign.use_sequence ? await listCampaignSteps(campaignId) : [];
  const rows = await listCampaignLeads(campaignId);
  const base = campaign.scheduled_at ?? new Date().toISOString();

  for (const cl of rows) {
    if (cl.sequence_status === "stopped" || cl.status === "replied") continue;

    let nextAt = base;
    if (steps.length > 0) {
      const step = steps[0];
      nextAt = addDelay(base, step.delay_amount, step.delay_unit as DelayUnit);
    }

    await saveCampaignLead({
      ...cl,
      current_step_index: cl.current_step_index ?? 0,
      next_step_at: nextAt,
      sequence_status: "active",
    });
  }

  const { isOutboundVoiceCampaign } = await import("./campaign-types");
  if (campaign && isOutboundVoiceCampaign(campaign)) {
    const { syncOutboundQueueForCampaign } = await import(
      "@/lib/voice/outbound-queue"
    );
    await syncOutboundQueueForCampaign(campaignId);
  }
}

export type StepProcessResult = {
  sent: boolean;
  failed: boolean;
  skipped: boolean;
  error?: string;
};

/** Process one due campaign_lead row (multi-step sequence). */
export async function processDueCampaignLead(row: {
  campaign_lead_id: string;
  campaign_id: string;
  lead_id: string;
  organization_id: string;
  current_step_index: number;
}): Promise<StepProcessResult> {
  const campaign = await getCampaign(row.campaign_id);
  if (!campaign || !campaign.agent_id) {
    return { sent: false, failed: true, skipped: false, error: "Campaign or agent missing" };
  }
  if (campaign.status !== "live") {
    return { sent: false, failed: false, skipped: true };
  }

  const agent = await getAgent(campaign.agent_id);
  if (!agent) return { sent: false, failed: true, skipped: false, error: "Agent not found" };

  const leads = await listCampaignLeads(row.campaign_id);
  const cl = leads.find((x) => x.id === row.campaign_lead_id);
  if (!cl) return { sent: false, failed: false, skipped: true };

  const lead = await getLead(row.lead_id);
  if (!lead) return { sent: false, failed: false, skipped: true };

  const stop = await evaluateCampaignStop({
    lead,
    campaignLead: cl,
    rawStopConditions: campaign.stop_conditions,
  });
  if (stop.stop) {
    await saveCampaignLead({
      ...cl,
      sequence_status: "stopped",
      paused_reason: stop.reason ?? "stop_condition",
      next_step_at: null,
    });
    return { sent: false, failed: false, skipped: true };
  }

  const steps = await listCampaignSteps(row.campaign_id);
  const stepIndex = row.current_step_index ?? 0;
  const step = steps[stepIndex];
  if (!step) {
    await saveCampaignLead({
      ...cl,
      sequence_status: "completed",
      next_step_at: null,
    });
    return { sent: false, failed: false, skipped: true };
  }

  const orgName = agent.company_product_name ?? brand.name;
  const staffName = await resolveAssignedStaffName(
    campaign.organization_id,
    lead.assigned_to
  );
  const body = await resolveStepBody(step, campaign, lead, orgName, staffName);
  const rules = parseFollowUpRules(campaign.follow_up_rules);
  const channelMode = campaignChannelToMode(campaign.channel, rules);

  const send = await sendToLead({
    campaign,
    campaignLeadId: cl.id,
    campaignStepId: step.id,
    lead,
    body,
    channelMode,
    orgName,
    followUpRules: rules,
  });

  const now = new Date().toISOString();
  const channel = isVoiceCampaignChannel(campaign.channel)
    ? "voice"
    : campaign.channel === "email"
      ? "email"
      : "whatsapp";

  await saveCampaignLog({
    id: crypto.randomUUID(),
    organization_id: campaign.organization_id,
    campaign_id: campaign.id,
    lead_id: lead.id,
    campaign_step_id: step.id,
    channel,
    message_sent: send.callId
      ? `${body}\n(call_id: ${send.callId})`
      : body,
    status: send.ok ? "sent" : "failed",
    error_message: send.ok ? null : send.error ?? "Send failed",
    sent_at: now,
    replied_at: null,
  });

  if (send.ok) {
    await touchLeadFromCampaign({
      leadId: lead.id,
      note: `Step ${stepIndex + 1} ${channel === "voice" ? "dialed" : "sent"} via ${channel}`,
      nextAction: step.stop_on_reply ? "Wait for reply" : "Sequence in progress",
    });

    const rulesNext = { ...rules, sent_count: (rules.sent_count ?? 0) + 1 };
    await saveCampaign({
      ...campaign,
      follow_up_rules: rulesNext,
      updated_at: now,
    });

    const nextIndex = stepIndex + 1;
    const nextStep = steps[nextIndex];

    if (step.mark_no_response && !nextStep) {
      await saveCampaignLead({
        ...cl,
        status: "sent",
        attempts: (cl.attempts ?? 0) + 1,
        last_sent_at: now,
        channels_sent: [...new Set([...(cl.channels_sent ?? []), ...send.channels])],
        sequence_status: "completed",
        next_step_at: null,
        current_step_index: nextIndex,
      });
      await touchLeadFromCampaign({
        leadId: lead.id,
        note: "Marked no response after final campaign step",
        leadStatus: lead.lead_status === "created" ? "working" : lead.lead_status,
        nextAction: "Manual follow-up or re-engage",
      });
    } else if (nextStep) {
      const nextAt = addDelay(now, nextStep.delay_amount, nextStep.delay_unit as DelayUnit);
      await saveCampaignLead({
        ...cl,
        status: "sent",
        attempts: (cl.attempts ?? 0) + 1,
        last_sent_at: now,
        last_error: send.error ?? null,
        channels_sent: [...new Set([...(cl.channels_sent ?? []), ...send.channels])],
        current_step_index: nextIndex,
        next_step_at: nextAt,
        sequence_status: "active",
      });
    } else {
      await saveCampaignLead({
        ...cl,
        status: "sent",
        attempts: (cl.attempts ?? 0) + 1,
        last_sent_at: now,
        channels_sent: [...new Set([...(cl.channels_sent ?? []), ...send.channels])],
        sequence_status: "completed",
        next_step_at: null,
        current_step_index: nextIndex,
      });
    }

    return { sent: true, failed: false, skipped: false };
  }

  const rulesFail = {
    ...rules,
    failed_count: (rules.failed_count ?? 0) + 1,
  };
  await saveCampaign({
    ...campaign,
    follow_up_rules: rulesFail,
    updated_at: now,
  });

  await saveCampaignLead({
    ...cl,
    status: "failed",
    attempts: (cl.attempts ?? 0) + 1,
    last_sent_at: now,
    last_error: send.error ?? "Send failed",
  });

  return { sent: false, failed: true, skipped: false, error: send.error };
}

/** Run pending / due follow-ups for one campaign (legacy single-template mode). */
export async function runCampaign(
  campaignId: string,
  organizationId: string,
  options?: { force?: boolean }
): Promise<CampaignRunResult> {
  const campaign = await getCampaign(campaignId);
  if (!campaign || campaign.organization_id !== organizationId) {
    throw new Error("Campaign not found");
  }

  if (!campaign.agent_id) {
    throw new Error("Campaign has no agent assigned");
  }

  const agent = await getAgent(campaign.agent_id);
  if (!agent) throw new Error("Agent not found");

  if (!options?.force && campaign.status !== "live" && campaign.status !== "scheduled") {
    throw new Error('Set campaign status to "live" or "scheduled" before running, or use force');
  }

  const { isOutboundVoiceCampaign } = await import("./campaign-types");
  if (isOutboundVoiceCampaign(campaign)) {
    const { syncOutboundQueueForCampaign, processOutboundCallQueue } =
      await import("@/lib/voice/outbound-queue");
    await syncOutboundQueueForCampaign(campaignId);
    const q = await processOutboundCallQueue(organizationId, {
      campaignId,
      limit: 20,
    });
    return {
      campaignId,
      processed: q.dialed + q.failed + q.skipped,
      sent: q.dialed,
      failed: q.failed,
      skipped: q.skipped,
      errors: q.errors.map((e) => ({ leadId: "", error: e })),
    };
  }

  if (
    !options?.force &&
    campaign.scheduled_at &&
    new Date(campaign.scheduled_at) > new Date()
  ) {
    throw new Error("Campaign is scheduled for a future time");
  }

  if (campaign.use_sequence) {
    const due = (await listCampaignLeads(campaignId)).filter((cl) => {
      if (!cl.next_step_at) return false;
      return new Date(cl.next_step_at) <= new Date();
    });
    const result: CampaignRunResult = {
      campaignId,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };
    for (const cl of due) {
      result.processed += 1;
      const r = await processDueCampaignLead({
        campaign_lead_id: cl.id,
        campaign_id: campaignId,
        lead_id: cl.lead_id,
        organization_id: organizationId,
        current_step_index: cl.current_step_index ?? 0,
      });
      if (r.sent) result.sent += 1;
      else if (r.failed) {
        result.failed += 1;
        if (r.error) result.errors.push({ leadId: cl.lead_id, error: r.error });
      } else result.skipped += 1;
    }
    return result;
  }

  const rules = parseFollowUpRules(campaign.follow_up_rules);
  const delayHours = rules.delay_hours ?? 24;
  const maxAttempts = rules.max_attempts ?? 3;
  const channelMode = campaignChannelToMode(campaign.channel, rules);
  const template =
    rules.message_template?.trim() ||
    defaultCampaignTemplate(agent.company_product_name ?? brand.name);

  const orgName = agent.company_product_name ?? brand.name;
  const rows = await listCampaignLeads(campaignId);
  const result: CampaignRunResult = {
    campaignId,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  let sentCount = rules.sent_count ?? 0;

  for (const cl of rows) {
    if (!options?.force && !isDueForSend(cl, delayHours, maxAttempts)) {
      result.skipped += 1;
      continue;
    }

    const lead = await getLead(cl.lead_id);
    if (!lead) {
      result.skipped += 1;
      continue;
    }

    const stop = await evaluateCampaignStop({
      lead,
      campaignLead: cl,
      rawStopConditions: campaign.stop_conditions,
    });
    if (stop.stop) {
      result.skipped += 1;
      continue;
    }

    result.processed += 1;
    const staffName = await resolveAssignedStaffName(organizationId, lead.assigned_to);
    const body = renderCampaignMessage(template, lead, {
      companyName: orgName,
      assignedStaffName: staffName,
    });
    const send = await sendToLead({
      campaign,
      campaignLeadId: cl.id,
      lead,
      body,
      channelMode,
      orgName,
      followUpRules: rules,
    });

    const now = new Date().toISOString();
    const attempts = (cl.attempts ?? 0) + 1;
    const channel = isVoiceCampaignChannel(campaign.channel)
      ? "voice"
      : campaign.channel === "email"
        ? "email"
        : "whatsapp";

    await saveCampaignLog({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      campaign_id: campaignId,
      lead_id: lead.id,
      channel,
      message_sent: send.callId ? `${body}\n(call_id: ${send.callId})` : body,
      status: send.ok ? "sent" : "failed",
      error_message: send.ok ? null : send.error ?? null,
      sent_at: now,
    });

    if (send.ok) {
      result.sent += 1;
      sentCount += 1;
      await touchLeadFromCampaign({
        leadId: lead.id,
        note: `Campaign ${channel === "voice" ? "call placed" : "message sent"} (${channel})`,
      });
      await saveCampaignLead({
        ...cl,
        status: "sent",
        attempts,
        last_sent_at: now,
        last_error: send.error ?? null,
        channels_sent: [...new Set([...(cl.channels_sent ?? []), ...send.channels])],
      });
    } else {
      result.failed += 1;
      result.errors.push({ leadId: lead.id, error: send.error ?? "Unknown error" });
      await saveCampaignLead({
        ...cl,
        status: attempts >= maxAttempts ? "failed" : "pending",
        attempts,
        last_sent_at: now,
        last_error: send.error ?? "Send failed",
      });
    }
  }

  await saveCampaign({
    ...campaign,
    status: campaign.status === "scheduled" ? "live" : campaign.status,
    follow_up_rules: {
      ...rules,
      sent_count: sentCount,
    },
    updated_at: new Date().toISOString(),
  });

  return result;
}
