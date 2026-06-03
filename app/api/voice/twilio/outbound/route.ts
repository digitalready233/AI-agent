import { verifyTwilioSignatureForOrg } from "@/lib/voice/twilio-verify";
import { getCallByPrimaryId } from "@/lib/voice/call-data";
import {
  handleOutboundAnswer,
  handleOutboundSpeechTurn,
} from "@/lib/voice/outbound-answer";
import { parseTwilioForm, twimlResponse } from "@/lib/voice/parse-twilio";
import { twimlHangup } from "@/lib/voice/twiml";

function appOrigin(req: Request): string {
  return (
    process.env.TWILIO_WEBHOOK_PUBLIC_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    new URL(req.url).origin
  );
}

/** Outbound campaign answer URL + Gather speech turns. */
export async function POST(req: Request) {
  const params = await parseTwilioForm(req);
  const url = new URL(req.url);
  const callId = url.searchParams.get("callId")?.trim();

  if (!callId) {
    return twimlResponse(
      twimlHangup("This outbound line is not configured. Goodbye.")
    );
  }

  const call = await getCallByPrimaryId(callId);
  if (call) {
    const ok = await verifyTwilioSignatureForOrg(
      req,
      params,
      call.organization_id
    );
    if (!ok) return new Response("Forbidden", { status: 403 });
  }

  const origin = appOrigin(req);
  const speech = params.SpeechResult?.trim();

  if (speech) {
    const twiml = await handleOutboundSpeechTurn({
      callId,
      twilioParams: params,
      appOrigin: origin,
    });
    return twimlResponse(twiml);
  }

  const twiml = await handleOutboundAnswer({
    callId,
    twilioParams: params,
    appOrigin: origin,
  });
  return twimlResponse(twiml);
}
