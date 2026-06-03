import { getCallByTwilioSid, saveCall, appendCallEvent } from "@/lib/voice/call-data";
import { finalizeCallSummary } from "@/lib/voice/call-summary";
import { verifyTwilioSignatureForOrg } from "@/lib/voice/twilio-verify";
import { parseTwilioForm, twimlResponse } from "@/lib/voice/parse-twilio";
import { twimlHangup } from "@/lib/voice/twiml";

export async function POST(req: Request) {
  const params = await parseTwilioForm(req);
  const callSid = params.CallSid;
  if (!callSid) return twimlResponse(twimlHangup());

  const call = await getCallByTwilioSid(callSid);
  if (!call) return twimlResponse(twimlHangup());

  if (!(await verifyTwilioSignatureForOrg(req, params, call.organization_id))) {
    return new Response("Forbidden", { status: 403 });
  }

  await saveCall({
    ...call,
    status: "completed",
    ended_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  await appendCallEvent({
    organizationId: call.organization_id,
    callId: call.id,
    eventType: "call.ended",
    payload: {},
  });

  await finalizeCallSummary({
    organizationId: call.organization_id,
    callId: call.id,
  });

  return twimlResponse(twimlHangup("Thank you for calling. Goodbye."));
}
