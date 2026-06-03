import twilio from "twilio";
import { twilio as envTwilio } from "@/lib/config";
import { findOrCreateConversationBySession } from "@/lib/platform/data";
import type { Lead } from "@/lib/platform/types";
import { appendCallEvent, listCalls, saveCall } from "./call-data";
import { getTwilioAuthToken } from "./credentials";
import { getVoiceIntegration, isWithinBusinessHours } from "./settings-data";
import type { CallRecord } from "./types";

function normalizeE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return null;
  if (phone.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function countActiveOutboundCalls(
  organizationId: string
): Promise<number> {
  const calls = await listCalls(organizationId, { direction: "outbound" });
  return calls.filter((c) =>
    ["initiated", "ringing", "in_progress"].includes(c.status)
  ).length;
}

export type DialCampaignLeadParams = {
  organizationId: string;
  campaignId: string;
  campaignLeadId: string;
  campaignStepId?: string | null;
  agentId: string;
  lead: Lead;
  appOrigin: string;
  openingScript?: string | null;
  maxConcurrent?: number;
  queueItemId?: string;
  humanTransferPhone?: string | null;
};

export type DialCampaignLeadResult = {
  ok: boolean;
  callId?: string;
  twilioCallSid?: string;
  error?: string;
};

/**
 * Place an outbound Twilio call to a lead for a voice campaign.
 * Twilio will POST to /api/voice/twilio/outbound?callId=… when the lead answers.
 */
export async function dialCampaignLead(
  params: DialCampaignLeadParams
): Promise<DialCampaignLeadResult> {
  const integration = await getVoiceIntegration(
    params.organizationId,
    params.appOrigin
  );

  if (!isWithinBusinessHours(integration.business_hours)) {
    return { ok: false, error: "Outside business hours for voice dialing" };
  }

  const accountSid =
    integration.twilio_account_sid?.trim() ||
    envTwilio.accountSid?.trim() ||
    null;
  const fromNumber = integration.twilio_phone_number?.trim();
  const authToken = await getTwilioAuthToken(params.organizationId);

  if (!accountSid || !authToken || !fromNumber) {
    return {
      ok: false,
      error: "Voice integration incomplete (account SID, auth token, or phone number)",
    };
  }

  const to = normalizeE164(params.lead.phone ?? "");
  if (!to) {
    return { ok: false, error: "Lead has no valid phone number" };
  }

  if (params.lead.do_not_call) {
    return { ok: false, error: "Lead is on do-not-call list" };
  }

  if (params.lead.marketing_opt_in === false || params.lead.unsubscribed_at) {
    return { ok: false, error: "Lead has opted out of outreach" };
  }

  const maxConcurrent = params.maxConcurrent ?? 2;
  const active = await countActiveOutboundCalls(params.organizationId);
  if (active >= maxConcurrent) {
    return {
      ok: false,
      error: `Max concurrent outbound calls (${maxConcurrent}) reached — try again shortly`,
    };
  }

  const sessionId = `campaign:${params.campaignId}:${params.lead.id}`;
  const conversation = await findOrCreateConversationBySession({
    organizationId: params.organizationId,
    agentId: params.agentId,
    sessionId,
    channel: "voice",
  });

  const now = new Date().toISOString();
  const callId = crypto.randomUUID();

  const call: CallRecord = {
    id: callId,
    organization_id: params.organizationId,
    agent_id: params.agentId,
    lead_id: params.lead.id,
    conversation_id: conversation.id,
    provider: "twilio",
    twilio_call_sid: null,
    from_number: fromNumber,
    to_number: to,
    direction: "outbound",
    status: "initiated",
    call_type: "campaign",
    started_at: now,
    ended_at: null,
    duration_seconds: null,
    recording_url: null,
    transcript: null,
    summary: null,
    detected_intent: null,
    lead_score: null,
    lead_category: null,
    handoff_required: false,
    recommended_next_action: null,
    failure_reason: null,
    metadata: {
      campaign_id: params.campaignId,
      campaign_lead_id: params.campaignLeadId,
      campaign_step_id: params.campaignStepId ?? null,
      opening_script: params.openingScript?.trim() || null,
      queue_item_id: params.queueItemId ?? null,
      human_transfer_phone: params.humanTransferPhone?.trim() || null,
    },
    created_at: now,
    updated_at: now,
  };

  await saveCall(call);

  const callbackUrl =
    integration.status_callback_url?.trim() ||
    `${params.appOrigin.replace(/\/$/, "")}/api/voice/twilio/status`;

  const answerUrl = `${params.appOrigin.replace(/\/$/, "")}/api/voice/twilio/outbound?callId=${encodeURIComponent(callId)}`;

  try {
    const client = twilio(accountSid, authToken);
    const twilioCall = await client.calls.create({
      to,
      from: fromNumber,
      url: answerUrl,
      method: "POST",
      statusCallback: callbackUrl,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
      machineDetection: "Enable",
      asyncAmd: "true",
      asyncAmdStatusCallback: callbackUrl,
      asyncAmdStatusCallbackMethod: "POST",
    });

    await saveCall({
      ...call,
      twilio_call_sid: twilioCall.sid,
      status: "ringing",
      updated_at: new Date().toISOString(),
    });

    await appendCallEvent({
      organizationId: params.organizationId,
      callId,
      eventType: "outbound.dial",
      payload: {
        campaignId: params.campaignId,
        leadId: params.lead.id,
        twilioCallSid: twilioCall.sid,
      },
    });

    return { ok: true, callId, twilioCallSid: twilioCall.sid };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Twilio dial failed";
    await saveCall({
      ...call,
      status: "failed",
      failure_reason: msg,
      updated_at: new Date().toISOString(),
    });
    return { ok: false, callId, error: msg };
  }
}
