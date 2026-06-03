import { getOrganizationSettings } from "@/lib/platform/settings-data";
import type { DemoProviderSettings, DemoProviderType } from "@/lib/platform/settings-types";
import { DEFAULT_MULTI_AGENT_DEMO_SETTINGS } from "@/lib/demo/multi-agent/types";

export function isLiveKitEnvConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_API_KEY?.trim() &&
      process.env.LIVEKIT_API_SECRET?.trim() &&
      process.env.LIVEKIT_URL?.trim()
  );
}

export function resolveDemoConnectionStatus(
  settings: DemoProviderSettings
): DemoProviderSettings["connection_status"] {
  if (settings.provider === "internal") {
    return "ready";
  }
  if (settings.provider === "livekit_future" || settings.enable_voice_demo) {
    return isLiveKitEnvConfigured() ? "ready" : "not_configured";
  }
  return "not_configured";
}

export async function getDemoProviderSettings(
  organizationId: string
): Promise<DemoProviderSettings> {
  const org = await getOrganizationSettings(organizationId);
  const raw = org.api_settings.demo_room;
  const base: DemoProviderSettings = {
    provider: raw?.provider ?? "internal",
    default_demo_provider: raw?.default_demo_provider ?? "internal",
    enable_voice_demo: raw?.enable_voice_demo ?? true,
    enable_human_takeover: raw?.enable_human_takeover ?? true,
    enable_recording_placeholder: raw?.enable_recording_placeholder ?? false,
    enable_recording: raw?.enable_recording ?? raw?.enable_recording_placeholder ?? false,
    auto_record_demos: raw?.auto_record_demos ?? false,
    record_only_with_consent: raw?.record_only_with_consent ?? true,
    require_recording_consent:
      raw?.require_recording_consent ?? raw?.record_only_with_consent ?? true,
    recording_provider: raw?.recording_provider ?? "none",
    recording_storage_location: raw?.recording_storage_location ?? "livekit_cloud",
    recording_retention_days: raw?.recording_retention_days ?? 90,
    recording_consent_message:
      raw?.recording_consent_message ??
      "This demo may be recorded for quality, training, and follow-up purposes. Do you agree to continue?",
    auto_send_follow_up: raw?.auto_send_follow_up ?? false,
    enable_transcript: raw?.enable_transcript ?? true,
    enable_ai_auto_join: raw?.enable_ai_auto_join ?? true,
    default_demo_agent_id: raw?.default_demo_agent_id ?? null,
    demo_session_timeout_minutes: raw?.demo_session_timeout_minutes ?? 90,
    demo_room_branding: raw?.demo_room_branding ?? {},
    ai_presenter: raw?.ai_presenter,
    avatar: raw?.avatar,
    multi_agent: {
      ...DEFAULT_MULTI_AGENT_DEMO_SETTINGS,
      ...raw?.multi_agent,
      default_team: {
        ...DEFAULT_MULTI_AGENT_DEMO_SETTINGS.default_team,
        ...(raw?.multi_agent?.default_team ?? {}),
      },
    },
    connection_status: "not_configured",
  };
  return {
    ...base,
    connection_status: resolveDemoConnectionStatus(base),
  };
}

export function effectiveDemoProvider(
  settings: DemoProviderSettings
): DemoProviderType {
  if (
    settings.provider === "livekit_future" &&
    isLiveKitEnvConfigured()
  ) {
    return "livekit_future";
  }
  return settings.provider === "internal" ? "internal" : settings.provider;
}

/** True when org settings + env support LiveKit video for new sessions */
export function orgLiveKitVideoEnabled(settings: DemoProviderSettings): boolean {
  return (
    isLiveKitEnvConfigured() &&
    (settings.provider === "livekit_future" ||
      settings.default_demo_provider === "livekit_future" ||
      settings.enable_voice_demo === true)
  );
}

export function isDemoSessionExpired(params: {
  startedAt: string | null;
  createdAt: string;
  timeoutMinutes: number;
}): boolean {
  const anchor = params.startedAt ?? params.createdAt;
  const ms = params.timeoutMinutes * 60 * 1000;
  return Date.now() - new Date(anchor).getTime() > ms;
}
