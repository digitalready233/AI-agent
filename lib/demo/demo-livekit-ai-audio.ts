import type { DemoSession } from "./types";
import { isLiveKitAiBridgeEnabled } from "./livekit-ai-bridge-client";

export const DEMO_AI_AUDIO_MODES = [
  "fallback_tts",
  "livekit_track",
  "realtime_agent",
] as const;

export type DemoAiAudioMode = (typeof DEMO_AI_AUDIO_MODES)[number];

export const DEMO_AI_AUDIO_STATUSES = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "paused",
  "failed",
] as const;

export type DemoAiAudioStatus = (typeof DEMO_AI_AUDIO_STATUSES)[number];

export function resolveDemoAiAudioMode(): DemoAiAudioMode {
  if (process.env.LIVEKIT_AI_REALTIME_ENABLED === "true") {
    return "realtime_agent";
  }
  if (isLiveKitAiBridgeEnabled()) {
    return "livekit_track";
  }
  return "fallback_tts";
}

export function shouldUseBrowserTts(
  session: DemoSession,
  turn?: { published_to_livekit?: boolean }
): boolean {
  if (turn?.published_to_livekit) return false;
  if (usesNativeLiveKitAudio(session)) return false;
  const mode = (session.ai_audio_mode as DemoAiAudioMode) ?? resolveDemoAiAudioMode();
  return mode === "fallback_tts";
}

export function usesNativeLiveKitAudio(session: DemoSession): boolean {
  const mode = (session.ai_audio_mode as DemoAiAudioMode) ?? "fallback_tts";
  return (
    (mode === "livekit_track" || mode === "realtime_agent") &&
    session.ai_audio_track_published === true
  );
}

export function demoAiAudioModeLabel(mode: string | null | undefined): string {
  switch (mode) {
    case "livekit_track":
      return "Native LiveKit audio";
    case "realtime_agent":
      return "OpenAI Realtime agent";
    case "fallback_tts":
    default:
      return "Browser TTS fallback";
  }
}

export function demoAiAudioStatusLabel(status: string | null | undefined): string {
  if (!status || status === "idle") return "Idle";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export type DemoAiRoomSyncPayload = {
  type: "ai_sync";
  demo_session_id: string;
  aiState: DemoAiAudioStatus | string;
  ai_audio_mode: DemoAiAudioMode | string;
  ai_audio_status: DemoAiAudioStatus | string;
  ai_paused: boolean;
  selectedDemoPathId?: string | null;
  currentDemoAssetId?: string | null;
  leadScore?: number | null;
  leadCategory?: string | null;
  bookingRecommended?: boolean;
  handoffRequired?: boolean;
  recommendedNextAction?: string | null;
  demoStage?: string | null;
  presentationControlMode?: string | null;
  screenShareActive?: boolean;
  currentPresenterType?: string | null;
  currentPresenterId?: string | null;
  currentAssetIndex?: number | null;
  pendingPresentationAction?: Record<string, unknown> | null;
  aiPresenterState?: string | null;
  ts: string;
};

export function buildDemoAiRoomSyncPayload(
  session: DemoSession,
  overrides?: Partial<DemoAiRoomSyncPayload>
): DemoAiRoomSyncPayload {
  return {
    type: "ai_sync",
    demo_session_id: session.id,
    aiState:
      (overrides?.aiState as DemoAiAudioStatus) ??
      (session.ai_audio_status as DemoAiAudioStatus) ??
      "idle",
    ai_audio_mode:
      (session.ai_audio_mode as DemoAiAudioMode) ?? resolveDemoAiAudioMode(),
    ai_audio_status:
      (session.ai_audio_status as DemoAiAudioStatus) ?? "idle",
    ai_paused: session.ai_paused === true,
    selectedDemoPathId: session.demo_path_id ?? null,
    currentDemoAssetId: session.current_demo_asset_id ?? null,
    leadScore: session.lead_score ?? null,
    leadCategory: session.lead_category ?? null,
    bookingRecommended: session.booking_recommended ?? false,
    handoffRequired: session.handoff_required ?? false,
    recommendedNextAction: session.recommended_next_action ?? null,
    demoStage: session.current_demo_stage ?? null,
    presentationControlMode: session.presentation_control_mode ?? "ai_controlled",
    screenShareActive: session.screen_share_active === true,
    currentPresenterType: session.current_presenter_type ?? null,
    currentPresenterId: session.current_presenter_id ?? null,
    currentAssetIndex:
      typeof session.metadata?.current_asset_index === "number"
        ? (session.metadata.current_asset_index as number)
        : null,
    pendingPresentationAction:
      (session.metadata?.pending_presentation_action as Record<string, unknown>) ??
      null,
    aiPresenterState: session.ai_presenter_state ?? "idle",
    ts: new Date().toISOString(),
    ...overrides,
  };
}
