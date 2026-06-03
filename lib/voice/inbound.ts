import { isLlmConfigured } from "@/lib/agent/llm-env";
import { getFirstMessage } from "@/lib/greetings";
import {
  findOrCreateConversationBySession,
  getAgent,
  listAgents,
  saveLead,
} from "@/lib/platform/data";
import {
  appendCallEvent,
  getCallByTwilioSid,
  saveCall,
} from "./call-data";
import {
  findOrganizationByTwilioNumber,
  getVoiceIntegration,
  isWithinBusinessHours,
} from "./settings-data";
import { shouldUseMediaStream } from "./stream-mode";
import {
  twimlConnectStream,
  twimlHangup,
  twimlSayAndGather,
  twimlTransferDial,
} from "./twiml";
import type { CallRecord } from "./types";
import { processVoiceTurn } from "./voice-turn";

function sessionIdForCall(callSid: string): string {
  return `voice_${callSid}`;
}

function normalizePhone(p: string): string {
  return p.replace(/\s/g, "");
}

function statusCallbackUrl(
  integration: { status_callback_url?: string | null },
  appOrigin: string
): string | undefined {
  return (
    integration.status_callback_url?.trim() ||
    `${appOrigin.replace(/\/$/, "")}/api/voice/twilio/status`
  );
}

export async function resolveVoiceAgentId(
  organizationId: string,
  preferredAgentId: string | null
): Promise<string | null> {
  if (preferredAgentId) {
    const agent = await getAgent(preferredAgentId);
    if (agent?.enabled && agent.organization_id === organizationId) {
      return agent.id;
    }
  }

  const agents = await listAgents(organizationId);
  const voiceAgent = agents.find(
    (a) => a.enabled && a.channels?.includes("voice")
  );
  if (voiceAgent) return voiceAgent.id;

  return agents.find((a) => a.enabled)?.id ?? null;
}

export async function handleIncomingCall(params: {
  twilioParams: Record<string, string>;
  appOrigin: string;
}): Promise<{ twiml: string; call: CallRecord }> {
  const callSid = params.twilioParams.CallSid ?? `call_${Date.now()}`;
  const from = normalizePhone(params.twilioParams.From ?? "");
  const to = normalizePhone(params.twilioParams.To ?? "");

  let integration = await findOrganizationByTwilioNumber(to);
  if (!integration?.organization_id) {
    throw new Error("unknown_twilio_number");
  }

  const organizationId = integration.organization_id;
  integration = await getVoiceIntegration(organizationId, params.appOrigin);
  const callbackUrl = statusCallbackUrl(integration, params.appOrigin);

  const agentId = await resolveVoiceAgentId(
    organizationId,
    integration.default_agent_id
  );
  if (!agentId) {
    throw new Error("no_agent");
  }

  let call = await getCallByTwilioSid(callSid);
  const now = new Date().toISOString();

  if (!call) {
    const sessionId = sessionIdForCall(callSid);
    const conversation = await findOrCreateConversationBySession({
      organizationId,
      agentId,
      sessionId,
      channel: "voice",
    });

    let leadId: string | null = null;
    if (from) {
      const lead = await saveLead({
        id: crypto.randomUUID(),
        organization_id: organizationId,
        full_name: null,
        phone: from,
        email: null,
        source: "voice",
        lead_status: "created",
        lead_category: null,
        created_at: now,
        updated_at: now,
      });
      leadId = lead.id;
    }

    call = await saveCall({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      agent_id: agentId,
      lead_id: leadId,
      conversation_id: conversation.id,
      provider: "twilio",
      twilio_call_sid: callSid,
      from_number: from,
      to_number: to,
      direction: "inbound",
      status: "ringing",
      call_type: "inbound",
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
      created_at: now,
      updated_at: now,
    });

    await appendCallEvent({
      organizationId,
      callId: call.id,
      eventType: "call.started",
      payload: { callSid, from, to },
    });
  }

  const afterHours = !isWithinBusinessHours(integration.business_hours);
  if (afterHours) {
    if (integration.after_hours_behavior === "voicemail") {
      const twiml = twimlSayAndGather({
        say: "Thanks for calling. We are currently closed. Please leave a message after the tone.",
        actionUrl: `${params.appOrigin}/api/voice/twilio/incoming`,
        statusCallbackUrl: callbackUrl,
        recordCall: integration.recording_enabled,
      });
      return { twiml, call };
    }
    if (
      integration.after_hours_behavior === "transfer" &&
      integration.human_transfer_phone
    ) {
      return {
        twiml: twimlTransferDial(integration.human_transfer_phone),
        call,
      };
    }
    if (integration.after_hours_behavior === "message") {
      const msg =
        integration.after_hours_message?.trim() ||
        "We are currently closed. Please call back during business hours.";
      return { twiml: twimlHangup(msg), call };
    }
  }

  const streamUrl = integration.media_stream_ws_url?.trim();
  const streamWanted = shouldUseMediaStream(integration) && !!streamUrl;

  if (streamWanted && streamUrl) {
    const wsUrl = streamUrl.startsWith("ws")
      ? streamUrl
      : streamUrl.replace(/^http/, "ws");
    const twiml = twimlConnectStream({
      streamUrl: `${wsUrl}?callId=${encodeURIComponent(call.id)}&organizationId=${encodeURIComponent(organizationId)}`,
      callId: call.id,
      organizationId,
      statusCallbackUrl: callbackUrl,
    });
    await appendCallEvent({
      organizationId,
      callId: call.id,
      eventType: "media_stream.connect",
      payload: { streamUrl: wsUrl },
    });
    return { twiml, call };
  }

  const agent = await getAgent(agentId);
  const greeting =
    agent?.welcome_message?.trim() ||
    getFirstMessage("voice", "sales");

  if (!isLlmConfigured()) {
    const twiml = twimlSayAndGather({
      say: "Our assistant is temporarily unavailable. Please try again later.",
      actionUrl: `${params.appOrigin}/api/voice/twilio/incoming`,
      statusCallbackUrl: callbackUrl,
    });
    return { twiml, call };
  }

  const twiml = twimlSayAndGather({
    say: greeting,
    actionUrl: `${params.appOrigin}/api/voice/twilio/incoming`,
    statusCallbackUrl: callbackUrl,
    recordCall: integration.recording_enabled,
  });

  await appendCallEvent({
    organizationId,
    callId: call.id,
    eventType: "gather.started",
    payload: {
      reason: streamWanted ? "stream_unavailable" : "gather_primary",
    },
  });

  return { twiml, call };
}

export async function handleIncomingSpeechTurn(params: {
  twilioParams: Record<string, string>;
  appOrigin: string;
}): Promise<string> {
  const callSid = params.twilioParams.CallSid ?? "";
  const speech = params.twilioParams.SpeechResult?.trim();
  const call = await getCallByTwilioSid(callSid);
  const integration = call
    ? await getVoiceIntegration(call.organization_id, params.appOrigin)
    : null;
  const callbackUrl = integration
    ? statusCallbackUrl(integration, params.appOrigin)
    : undefined;

  if (!call?.conversation_id || !call.agent_id || !speech) {
    return twimlSayAndGather({
      say: "I did not catch that. Could you repeat?",
      actionUrl: `${params.appOrigin}/api/voice/twilio/incoming`,
      statusCallbackUrl: callbackUrl,
    });
  }

  try {
    const result = await processVoiceTurn({ call, speech });

    if (result.handoffRequired) {
      if (integration?.human_transfer_phone) {
        return twimlTransferDial(integration.human_transfer_phone);
      }
    }

    return twimlSayAndGather({
      say: result.aiResponse,
      actionUrl: `${params.appOrigin}/api/voice/twilio/incoming`,
      statusCallbackUrl: callbackUrl,
      recordCall: integration?.recording_enabled,
    });
  } catch {
    return twimlSayAndGather({
      say: "Sorry, I had trouble processing that. Please try again.",
      actionUrl: `${params.appOrigin}/api/voice/twilio/incoming`,
      statusCallbackUrl: callbackUrl,
    });
  }
}
