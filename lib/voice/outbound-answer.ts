import { isLlmConfigured } from "@/lib/agent/llm-env";
import { getAgent } from "@/lib/platform/data";
import {
  appendCallEvent,
  getCallByPrimaryId,
  getCallByTwilioSid,
  saveCall,
} from "./call-data";
import { getVoiceIntegration } from "./settings-data";
import { shouldUseMediaStream } from "./stream-mode";
import {
  twimlConnectStream,
  twimlSayAndGather,
} from "./twiml";
import type { CallRecord } from "./types";

function statusCallbackUrl(
  integration: { status_callback_url?: string | null },
  appOrigin: string
): string | undefined {
  return (
    integration.status_callback_url?.trim() ||
    `${appOrigin.replace(/\/$/, "")}/api/voice/twilio/status`
  );
}

/**
 * TwiML when a campaign outbound call is answered (lead picked up).
 */
export async function handleOutboundAnswer(params: {
  callId: string;
  twilioParams: Record<string, string>;
  appOrigin: string;
}): Promise<string> {
  let record =
    (await getCallByPrimaryId(params.callId)) ??
    (params.twilioParams.CallSid
      ? await getCallByTwilioSid(params.twilioParams.CallSid)
      : null);

  if (!record) {
    const { twimlHangup } = await import("./twiml");
    return twimlHangup("We could not connect this call. Goodbye.");
  }

  const organizationId = record.organization_id;
  const integration = await getVoiceIntegration(organizationId, params.appOrigin);
  const callbackUrl = statusCallbackUrl(integration, params.appOrigin);
  const callSid = params.twilioParams.CallSid ?? record.twilio_call_sid;

  if (callSid && record.twilio_call_sid !== callSid) {
    record = await saveCall({
      ...record,
      twilio_call_sid: callSid,
      updated_at: new Date().toISOString(),
    });
  }

  if (record.status === "initiated" || record.status === "ringing") {
    record = await saveCall({
      ...record,
      status: "in_progress",
      started_at: record.started_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  await appendCallEvent({
    organizationId,
    callId: record.id,
    eventType: "outbound.answered",
    payload: { callSid },
  });

  const opening =
    (typeof record.metadata?.opening_script === "string"
      ? record.metadata.opening_script
      : null) ||
    (record.agent_id
      ? (await getAgent(record.agent_id))?.welcome_message?.trim()
      : null) ||
    "Hello, thanks for taking our call. I am your AI assistant — how can I help you today?";

  const streamUrl = integration.media_stream_ws_url?.trim();
  const streamWanted = shouldUseMediaStream(integration) && !!streamUrl;

  if (streamWanted && streamUrl && isLlmConfigured()) {
    const wsUrl = streamUrl.startsWith("ws")
      ? streamUrl
      : streamUrl.replace(/^http/, "ws");
    return twimlConnectStream({
      streamUrl: `${wsUrl}?callId=${encodeURIComponent(record.id)}&organizationId=${encodeURIComponent(organizationId)}`,
      callId: record.id,
      organizationId,
      statusCallbackUrl: callbackUrl,
    });
  }

  if (!isLlmConfigured()) {
    const { twimlHangup } = await import("./twiml");
    return twimlHangup("Our assistant is temporarily unavailable. Goodbye.");
  }

  return twimlSayAndGather({
    say: opening,
    actionUrl: `${params.appOrigin}/api/voice/twilio/outbound?callId=${encodeURIComponent(record.id)}`,
    statusCallbackUrl: callbackUrl,
    recordCall: integration.recording_enabled,
  });
}

/** Speech turn on outbound campaign call (Gather path). */
export async function handleOutboundSpeechTurn(params: {
  callId: string;
  twilioParams: Record<string, string>;
  appOrigin: string;
}): Promise<string> {
  let record =
    (await getCallByPrimaryId(params.callId)) ??
    (params.twilioParams.CallSid
      ? await getCallByTwilioSid(params.twilioParams.CallSid)
      : null);

  const speech = params.twilioParams.SpeechResult?.trim();
  const integration = record
    ? await getVoiceIntegration(record.organization_id, params.appOrigin)
    : null;
  const callbackUrl = integration
    ? statusCallbackUrl(integration, params.appOrigin)
    : undefined;

  if (!record?.conversation_id || !record.agent_id || !speech) {
    return twimlSayAndGather({
      say: "I did not catch that. Could you repeat?",
      actionUrl: `${params.appOrigin}/api/voice/twilio/outbound?callId=${encodeURIComponent(params.callId)}`,
      statusCallbackUrl: callbackUrl,
    });
  }

  const { processVoiceTurn } = await import("./voice-turn");
  const { twimlTransferDial } = await import("./twiml");

  try {
    const result = await processVoiceTurn({ call: record, speech });

    const transferPhone =
      (typeof record.metadata?.human_transfer_phone === "string"
        ? record.metadata.human_transfer_phone.trim()
        : null) ||
      integration?.human_transfer_phone?.trim() ||
      null;
    if (result.handoffRequired && transferPhone) {
      return twimlTransferDial(transferPhone);
    }

    return twimlSayAndGather({
      say: result.aiResponse,
      actionUrl: `${params.appOrigin}/api/voice/twilio/outbound?callId=${encodeURIComponent(record.id)}`,
      statusCallbackUrl: callbackUrl,
      recordCall: integration?.recording_enabled,
    });
  } catch {
    return twimlSayAndGather({
      say: "Sorry, I had trouble with that. Could you say it again?",
      actionUrl: `${params.appOrigin}/api/voice/twilio/outbound?callId=${encodeURIComponent(record.id)}`,
      statusCallbackUrl: callbackUrl,
    });
  }
}
