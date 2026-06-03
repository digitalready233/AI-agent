import twilio from "twilio";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getTwilioAuthToken } from "@/lib/voice/credentials";
import { getVoiceIntegration, saveVoiceIntegration } from "@/lib/voice/settings-data";

export async function POST(req: Request) {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  const orgId = session.organization.id;
  const origin = new URL(req.url).origin;
  const settings = await getVoiceIntegration(orgId, origin);
  const accountSid =
    settings.twilio_account_sid?.trim() ||
    process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = await getTwilioAuthToken(orgId);
  const phone = settings.twilio_phone_number?.trim();

  if (!accountSid || !authToken) {
    await saveVoiceIntegration({
      ...settings,
      connection_status: "error",
      last_tested_at: new Date().toISOString(),
    });
    return Response.json(
      { ok: false, error: "Missing Twilio Account SID or Auth Token." },
      { status: 400 }
    );
  }

  try {
    const client = twilio(accountSid, authToken);
    const account = await client.api.accounts(accountSid).fetch();
    let numberOk = true;
    if (phone) {
      const incoming = await client.incomingPhoneNumbers.list({ phoneNumber: phone, limit: 1 });
      numberOk = incoming.length > 0;
    }

    await saveVoiceIntegration({
      ...settings,
      connection_status: numberOk ? "connected" : "error",
      last_tested_at: new Date().toISOString(),
    });

    return Response.json({
      ok: true,
      account: account.friendlyName,
      phone_configured: Boolean(phone),
      phone_found: numberOk,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Twilio test failed";
    await saveVoiceIntegration({
      ...settings,
      connection_status: "error",
      last_tested_at: new Date().toISOString(),
    });
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
