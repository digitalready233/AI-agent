import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import { jsonStore } from "@/lib/platform/json-store";
import { hasTwilioAuthToken } from "./credentials";
import { buildVoiceWebhookUrls } from "./urls";
import type {
  AfterHoursBehavior,
  VoiceBusinessHours,
  VoiceConnectionStatus,
  VoiceIntegration,
} from "./types";

function defaultSettings(organizationId: string, appOrigin: string): VoiceIntegration {
  const urls = buildVoiceWebhookUrls(appOrigin);
  return {
    organization_id: organizationId,
    provider: "twilio",
    twilio_account_sid: null,
    twilio_phone_number: null,
    default_agent_id: null,
    default_voice: "alloy",
    human_transfer_phone: null,
    recording_enabled: true,
    transcription_enabled: true,
    business_hours: { timezone: "UTC", days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" },
    after_hours_behavior: "ai_only",
    connection_status: "not_connected",
    last_tested_at: null,
    inbound_webhook_url: urls.inbound_webhook_url,
    status_callback_url: urls.status_callback_url,
    media_stream_ws_url: urls.media_stream_ws_url,
    use_media_stream: true,
    updated_at: new Date().toISOString(),
  };
}

function normalize(raw: VoiceIntegration): VoiceIntegration {
  const status = raw.connection_status ?? "not_connected";
  return {
    ...raw,
    provider: "twilio",
    default_voice: raw.default_voice ?? "alloy",
    recording_enabled: raw.recording_enabled ?? true,
    transcription_enabled: raw.transcription_enabled ?? true,
    business_hours: (raw.business_hours ?? {}) as VoiceBusinessHours,
    after_hours_behavior: (raw.after_hours_behavior ?? "ai_only") as AfterHoursBehavior,
    connection_status:
      status === "connected" || status === "error" ? status : "not_connected",
    use_media_stream: raw.use_media_stream ?? true,
  };
}

export async function getVoiceIntegration(
  organizationId: string,
  appOrigin: string
): Promise<VoiceIntegration> {
  const urls = buildVoiceWebhookUrls(appOrigin);

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("voice_integrations")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      const fallback = await jsonStore.getVoiceIntegration(organizationId);
      const base = fallback ?? defaultSettings(organizationId, appOrigin);
      return enrichPublic(base, urls, organizationId);
    }
    if (!data) {
      return enrichPublic(defaultSettings(organizationId, appOrigin), urls, organizationId);
    }
    return enrichPublic(normalize(data as VoiceIntegration), urls, organizationId);
  }

  const stored = await jsonStore.getVoiceIntegration(organizationId);
  const base = stored
    ? normalize(stored)
    : defaultSettings(organizationId, appOrigin);
  return enrichPublic(base, urls, organizationId);
}

async function enrichPublic(
  settings: VoiceIntegration,
  urls: ReturnType<typeof buildVoiceWebhookUrls>,
  organizationId: string
): Promise<VoiceIntegration> {
  const hasToken = await hasTwilioAuthToken(organizationId);
  return {
    ...settings,
    inbound_webhook_url: urls.inbound_webhook_url,
    status_callback_url: urls.status_callback_url,
    media_stream_ws_url: settings.media_stream_ws_url ?? urls.media_stream_ws_url,
    has_auth_token: hasToken,
  };
}

export async function saveVoiceIntegration(
  settings: VoiceIntegration
): Promise<VoiceIntegration> {
  const normalized = normalize({
    ...settings,
    updated_at: new Date().toISOString(),
  });

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("voice_integrations")
      .upsert({
        organization_id: normalized.organization_id,
        provider: normalized.provider,
        twilio_account_sid: normalized.twilio_account_sid,
        twilio_phone_number: normalized.twilio_phone_number,
        default_agent_id: normalized.default_agent_id,
        default_voice: normalized.default_voice,
        human_transfer_phone: normalized.human_transfer_phone,
        recording_enabled: normalized.recording_enabled,
        transcription_enabled: normalized.transcription_enabled,
        business_hours: normalized.business_hours,
        after_hours_behavior: normalized.after_hours_behavior,
        connection_status: normalized.connection_status,
        last_tested_at: normalized.last_tested_at,
        inbound_webhook_url: normalized.inbound_webhook_url,
        status_callback_url: normalized.status_callback_url,
        media_stream_ws_url: normalized.media_stream_ws_url,
        use_media_stream: normalized.use_media_stream,
        updated_at: normalized.updated_at,
      })
      .select()
      .single();

    if (error) {
      await jsonStore.setVoiceIntegration(normalized);
      return normalized;
    }
    return normalize(data as VoiceIntegration);
  }

  await jsonStore.setVoiceIntegration(normalized);
  return normalized;
}

export async function findOrganizationByTwilioNumber(
  phone: string
): Promise<VoiceIntegration | null> {
  const normalized = phone.replace(/\s/g, "");
  if (!normalized) return null;

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("voice_integrations")
      .select("*")
      .eq("twilio_phone_number", normalized)
      .maybeSingle();

    if (error) {
      const all = await jsonStore.listAllVoiceIntegrations();
      return (
        all.find((s) => s.twilio_phone_number === normalized) ?? null
      );
    }
    return data ? normalize(data as VoiceIntegration) : null;
  }

  const all = await jsonStore.listAllVoiceIntegrations();
  return all.find((s) => s.twilio_phone_number === normalized) ?? null;
}

export function isWithinBusinessHours(
  hours: VoiceBusinessHours,
  now = new Date()
): boolean {
  const days = hours.days ?? [1, 2, 3, 4, 5];
  const day = now.getUTCDay();
  if (!days.includes(day)) return false;

  const start = hours.start ?? "09:00";
  const end = hours.end ?? "17:00";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startMins = sh * 60 + (sm || 0);
  const endMins = eh * 60 + (em || 0);
  return mins >= startMins && mins < endMins;
}
