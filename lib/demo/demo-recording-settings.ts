import type { DemoProviderSettings } from "@/lib/platform/settings-types";

export function isLiveKitEgressConfigured(): boolean {
  return (
    Boolean(process.env.LIVEKIT_API_KEY?.trim()) &&
    Boolean(process.env.LIVEKIT_API_SECRET?.trim()) &&
    Boolean(process.env.LIVEKIT_URL?.trim()) &&
    (process.env.LIVEKIT_EGRESS_ENABLED === "true" ||
      Boolean(process.env.LIVEKIT_EGRESS_TEMPLATE?.trim()))
  );
}

export function resolveDemoRecordingSettings(settings: DemoProviderSettings) {
  const enableRecording =
    settings.enable_recording ?? settings.enable_recording_placeholder ?? false;
  const provider =
    settings.recording_provider ??
    (isLiveKitEgressConfigured() ? "livekit_egress" : "none");

  return {
    enableRecording,
    autoRecordDemos: settings.auto_record_demos ?? false,
    recordOnlyWithConsent:
      settings.require_recording_consent ??
      settings.record_only_with_consent ??
      true,
    provider,
    storageLocation: settings.recording_storage_location ?? "livekit_cloud",
    retentionDays: settings.recording_retention_days ?? 90,
    consentMessage:
      settings.recording_consent_message?.trim() ||
      "This demo may be recorded for quality, training, and follow-up purposes. Do you agree to continue?",
    autoSendFollowUp: settings.auto_send_follow_up ?? false,
    egressReady: provider === "livekit_egress" && isLiveKitEgressConfigured(),
  };
}
