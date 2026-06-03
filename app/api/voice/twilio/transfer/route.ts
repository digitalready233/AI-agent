import twilio from "twilio";
import { getTwilioAuthToken } from "@/lib/voice/credentials";
import { getCallByTwilioSid, saveCall, appendCallEvent } from "@/lib/voice/call-data";
import { getVoiceIntegration } from "@/lib/voice/settings-data";
import { verifyTwilioSignatureForOrg } from "@/lib/voice/twilio-verify";
import { appOriginFromRequest, parseTwilioForm, twimlResponse } from "@/lib/voice/parse-twilio";
import { twimlTransferDial, twimlHangup } from "@/lib/voice/twiml";

export async function POST(req: Request) {
  const params = await parseTwilioForm(req);
  const callSid = params.CallSid;
  if (!callSid) return twimlResponse(twimlHangup());

  const call = await getCallByTwilioSid(callSid);
  if (!call) return twimlResponse(twimlHangup());

  if (!(await verifyTwilioSignatureForOrg(req, params, call.organization_id))) {
    return new Response("Forbidden", { status: 403 });
  }

  const appOrigin = appOriginFromRequest(req);
  const integration = await getVoiceIntegration(call.organization_id, appOrigin);
  const transferTo = integration.human_transfer_phone?.trim();

  await saveCall({
    ...call,
    status: "transferred",
    handoff_required: true,
    updated_at: new Date().toISOString(),
  });

  await appendCallEvent({
    organizationId: call.organization_id,
    callId: call.id,
    eventType: "transfer.completed",
    payload: { transferTo },
  });

  if (!transferTo) {
    return twimlResponse(
      twimlHangup("A team member will call you back shortly. Thank you.")
    );
  }

  const accountSid =
    integration.twilio_account_sid?.trim() ||
    process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = await getTwilioAuthToken(call.organization_id);

  if (accountSid && authToken && callSid) {
    try {
      const client = twilio(accountSid, authToken);
      await client.calls(callSid).update({
        url: `${appOrigin}/api/voice/twilio/transfer`,
        method: "POST",
      });
    } catch (e) {
      console.error("[voice/transfer] Twilio update failed", e);
    }
  }

  return twimlResponse(twimlTransferDial(transferTo));
}
