import { verifyTwilioSignatureForOrg } from "@/lib/voice/twilio-verify";

import {

  appendCallEvent,

  getCallByTwilioSid,

  mapTwilioCallStatus,

  saveCall,

} from "@/lib/voice/call-data";

import { syncCampaignFromCompletedCall } from "@/lib/voice/campaign-hooks";

import { finalizeCallSummary } from "@/lib/voice/call-summary";

import { mapTwilioToCallOutcome } from "@/lib/voice/outbound-retry";

import { parseTwilioForm } from "@/lib/voice/parse-twilio";

import type { CallOutcome } from "@/lib/voice/types";



const TERMINAL = new Set([

  "completed",

  "failed",

  "no_answer",

  "busy",

  "canceled",

]);



export async function POST(req: Request) {

  const params = await parseTwilioForm(req);

  const callSid = params.CallSid;

  if (!callSid) return new Response("OK");



  const call = await getCallByTwilioSid(callSid);

  if (!call) return new Response("OK");



  if (!(await verifyTwilioSignatureForOrg(req, params, call.organization_id))) {

    return new Response("Forbidden", { status: 403 });

  }



  const answeredBy =

    params.AnsweredBy ?? params.MachineDetectionResult ?? null;

  const status = mapTwilioCallStatus(params.CallStatus ?? "in-progress");

  const duration = params.CallDuration

    ? parseInt(params.CallDuration, 10)

    : call.duration_seconds;



  const bookingId =

    typeof call.metadata?.booking_id === "string"

      ? call.metadata.booking_id

      : null;



  let callOutcome: CallOutcome | null = call.call_outcome ?? null;

  if (TERMINAL.has(status) || answeredBy) {

    callOutcome = mapTwilioToCallOutcome({

      callStatus: params.CallStatus ?? status,

      answeredBy,

      durationSeconds: Number.isFinite(duration) ? duration : null,

      handoffRequired: call.handoff_required,

      bookingId,

      leadCategory: call.lead_category,

      detectedIntent: call.detected_intent,

    });

  }



  const updated = await saveCall({

    ...call,

    status,

    call_outcome: callOutcome,

    duration_seconds: Number.isFinite(duration) ? duration : call.duration_seconds,

    started_at: call.started_at ?? params.Timestamp ?? call.started_at,

    ended_at: TERMINAL.has(status)

      ? new Date().toISOString()

      : call.ended_at,

    failure_reason: params.ErrorMessage ?? call.failure_reason,

    recording_url: params.RecordingUrl ?? call.recording_url,

    metadata: {

      ...call.metadata,

      answered_by: answeredBy ?? call.metadata?.answered_by,

    },

    updated_at: new Date().toISOString(),

  });



  await appendCallEvent({

    organizationId: call.organization_id,

    callId: call.id,

    eventType: answeredBy

      ? `amd.${answeredBy}`

      : `status.${params.CallStatus ?? "unknown"}`,

    payload: params,

  });



  let finalCall = updated;



  if (status === "completed") {

    const summarized = await finalizeCallSummary({

      organizationId: call.organization_id,

      callId: call.id,

    });

    finalCall = summarized ?? updated;

    if (finalCall.call_outcome == null && callOutcome) {

      finalCall = await saveCall({ ...finalCall, call_outcome: callOutcome });

    }

  }



  if (

    finalCall.call_type === "campaign" &&

    TERMINAL.has(status)

  ) {

    await syncCampaignFromCompletedCall(finalCall);

  }



  return new Response("OK");

}

