import {
  findOrganizationByTwilioNumber,
} from "@/lib/voice/settings-data";
import { verifyTwilioSignatureForOrg } from "@/lib/voice/twilio-verify";
import {
  handleIncomingCall,
  handleIncomingSpeechTurn,
} from "@/lib/voice/inbound";
import { appendCallEvent, getCallByTwilioSid } from "@/lib/voice/call-data";
import { appOriginFromRequest, parseTwilioForm, twimlResponse } from "@/lib/voice/parse-twilio";
import { twimlSayAndGather } from "@/lib/voice/twiml";

export const maxDuration = 60;

export async function POST(req: Request) {
  const params = await parseTwilioForm(req);
  const appOrigin = appOriginFromRequest(req);
  const to = params.To?.replace(/\s/g, "") ?? "";
  const integration = await findOrganizationByTwilioNumber(to);
  const orgId = integration?.organization_id ?? null;

  if (!(await verifyTwilioSignatureForOrg(req, params, orgId))) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    if (params.SpeechResult?.trim()) {
      const twiml = await handleIncomingSpeechTurn({
        twilioParams: params,
        appOrigin,
      });
      return twimlResponse(twiml);
    }

    const { twiml, call } = await handleIncomingCall({
      twilioParams: params,
      appOrigin,
    });
    return twimlResponse(twiml);
  } catch (err) {
    const message = err instanceof Error ? err.message : "error";
    console.error("[voice/incoming]", message, params);

    const callSid = params.CallSid;
    if (callSid) {
      const call = await getCallByTwilioSid(callSid);
      if (call) {
        await appendCallEvent({
          organizationId: call.organization_id,
          callId: call.id,
          eventType: "call.error",
          payload: { message },
        });
      }
    }

    return twimlResponse(
      twimlSayAndGather({
        say: "We could not connect your call right now. Please try again later.",
        actionUrl: `${appOrigin}/api/voice/twilio/incoming`,
      })
    );
  }
}
