import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { listIntegrations, saveIntegration } from "@/lib/platform/data";
import {
  getVoiceIntegration,
  saveVoiceIntegration,
} from "@/lib/voice/settings-data";
import {
  hasTwilioAuthToken,
  saveTwilioAuthToken,
} from "@/lib/voice/credentials";
import { buildVoiceWebhookUrls } from "@/lib/voice/urls";
import type { IntegrationStatus } from "@/lib/platform/types";

const putSchema = z.object({
  twilio_account_sid: z.string().max(64).optional().nullable(),
  twilio_auth_token: z.string().max(256).optional(),
  twilio_phone_number: z.string().max(32).optional().nullable(),
  default_agent_id: z.string().uuid().optional().nullable(),
  default_voice: z.string().max(32).optional(),
  human_transfer_phone: z.string().max(32).optional().nullable(),
  recording_enabled: z.boolean().optional(),
  transcription_enabled: z.boolean().optional(),
  business_hours: z.record(z.unknown()).optional(),
  after_hours_behavior: z
    .enum(["voicemail", "message", "transfer", "ai_only"])
    .optional(),
  media_stream_ws_url: z.string().max(512).optional().nullable(),
  use_media_stream: z.boolean().optional(),
});

export async function GET(req: Request) {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");
  const origin = new URL(req.url).origin;
  const settings = await getVoiceIntegration(session.organization.id, origin);
  return Response.json({ settings });
}

export async function PUT(req: Request) {
  const session = await requireSession();
  requirePermission(session, "integrations.manage");

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const orgId = session.organization.id;
  const body = parsed.data;
  const origin = new URL(req.url).origin;
  const urls = buildVoiceWebhookUrls(origin);
  const current = await getVoiceIntegration(orgId, origin);

  if (body.twilio_auth_token?.trim()) {
    await saveTwilioAuthToken(orgId, body.twilio_auth_token);
  }

  const settings = await saveVoiceIntegration({
    ...current,
    organization_id: orgId,
    twilio_account_sid:
      body.twilio_account_sid?.trim() ?? current.twilio_account_sid,
    twilio_phone_number:
      body.twilio_phone_number?.trim() ?? current.twilio_phone_number,
    default_agent_id: body.default_agent_id ?? current.default_agent_id,
    default_voice: body.default_voice ?? current.default_voice,
    human_transfer_phone:
      body.human_transfer_phone?.trim() ?? current.human_transfer_phone,
    recording_enabled: body.recording_enabled ?? current.recording_enabled,
    transcription_enabled:
      body.transcription_enabled ?? current.transcription_enabled,
    business_hours: (body.business_hours as typeof current.business_hours) ??
      current.business_hours,
    after_hours_behavior:
      body.after_hours_behavior ?? current.after_hours_behavior,
    media_stream_ws_url:
      body.media_stream_ws_url?.trim() ??
      current.media_stream_ws_url ??
      urls.media_stream_ws_url,
    use_media_stream: body.use_media_stream ?? current.use_media_stream,
    inbound_webhook_url: urls.inbound_webhook_url,
    status_callback_url: urls.status_callback_url,
    connection_status: current.connection_status,
    last_tested_at: current.last_tested_at,
    updated_at: new Date().toISOString(),
  });

  const hasToken = await hasTwilioAuthToken(orgId);
  const connected = Boolean(
    settings.twilio_phone_number &&
      settings.twilio_account_sid &&
      hasToken
  );

  const all = await listIntegrations(orgId);
  const existing = all.find((i) => i.integration_type === "twilio_voice");
  const now = new Date().toISOString();

  await saveIntegration(
    existing
      ? {
          ...existing,
          status: (connected ? "connected" : "not_connected") as IntegrationStatus,
          updated_at: now,
        }
      : {
          id: crypto.randomUUID(),
          organization_id: orgId,
          integration_type: "twilio_voice",
          status: (connected ? "connected" : "not_connected") as IntegrationStatus,
          created_at: now,
          updated_at: now,
        }
  );

  const refreshed = await getVoiceIntegration(orgId, origin);
  return Response.json({ settings: refreshed });
}
