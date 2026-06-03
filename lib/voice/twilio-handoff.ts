import twilio from "twilio";
import { getTwilioAuthToken } from "./credentials";
import { getVoiceIntegration } from "./settings-data";

/**
 * Redirect an in-progress Twilio call to the transfer TwiML endpoint (media stream handoff).
 */
export async function redirectCallToTransfer(params: {
  organizationId: string;
  twilioCallSid: string;
  appOrigin: string;
}): Promise<boolean> {
  const integration = await getVoiceIntegration(
    params.organizationId,
    params.appOrigin
  );
  const accountSid =
    integration.twilio_account_sid?.trim() ||
    process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = await getTwilioAuthToken(params.organizationId);
  if (!accountSid || !authToken || !params.twilioCallSid) return false;

  const transferUrl = `${params.appOrigin.replace(/\/$/, "")}/api/voice/twilio/transfer`;

  try {
    const client = twilio(accountSid, authToken);
    await client.calls(params.twilioCallSid).update({
      url: transferUrl,
      method: "POST",
    });
    return true;
  } catch (e) {
    console.error("[voice] redirect to transfer failed", e);
    return false;
  }
}
