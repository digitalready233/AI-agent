import type { LiveKitAiPhase } from "@/hooks/use-demo-livekit-ai";
import type { DemoSession } from "./types";
import type { AiPresenterState } from "./ai-presenter-types";
import { isDemoAiPaused } from "./demo-session-flags";

export type PresenterStateInput = {
  session: DemoSession;
  livekitPhase?: LiveKitAiPhase | string | null;
  aiAudioStatus?: string | null;
  aiStatus?: string | null;
  aiJoined?: boolean;
  aiPaused?: boolean;
  handoffRequired?: boolean;
  bookingRecommended?: boolean;
  presentingAssetId?: string | null;
  presentingAssetTitle?: string | null;
  livekitDisconnected?: boolean;
  aiAudioFailed?: boolean;
};

export function resolveAiPresenterState(input: PresenterStateInput): AiPresenterState {
  const {
    session,
    livekitPhase,
    aiAudioStatus,
    aiStatus,
    aiJoined,
    aiPaused,
    handoffRequired,
    bookingRecommended,
    presentingAssetId,
    livekitDisconnected,
    aiAudioFailed,
  } = input;

  const paused =
    aiPaused === true ||
    isDemoAiPaused(session) ||
    session.status === "human_taken_over" ||
    session.current_presenter_type === "staff";

  if (livekitDisconnected || aiAudioFailed || aiStatus === "failed") {
    return "failed";
  }

  if (session.status === "completed" || aiStatus === "stopped") {
    return "stopped";
  }

  if (paused) {
    return "paused";
  }

  if (handoffRequired === true || session.handoff_required === true) {
    return "handoff_required";
  }

  const phase = livekitPhase ?? mapAudioStatusToPhase(aiAudioStatus);
  if (phase === "joining" || (!aiJoined && aiStatus === "joining")) {
    return "joining";
  }
  if (phase === "thinking" || aiAudioStatus === "thinking") {
    return "thinking";
  }
  if (phase === "speaking" || aiAudioStatus === "speaking") {
    return "speaking";
  }

  const assetId =
    presentingAssetId ?? session.current_demo_asset_id ?? session.ai_presenter_last_asset_id;
  if (assetId && (phase === "speaking" || phase === "listening" || !phase)) {
    if (presentingAssetId || session.current_presenter_type === "ai") {
      return "presenting";
    }
  }

  if (phase === "listening") return "listening";
  if (aiJoined) return "listening";
  if (aiStatus === "not_started") return "idle";
  return "idle";
}

function mapAudioStatusToPhase(status?: string | null): LiveKitAiPhase | null {
  if (!status) return null;
  if (status === "thinking") return "thinking";
  if (status === "speaking") return "speaking";
  if (status === "listening") return "listening";
  if (status === "paused") return "paused";
  if (status === "failed") return "failed";
  return null;
}

export function presenterStateLabel(state: AiPresenterState): {
  title: string;
  subtitle: string;
} {
  switch (state) {
    case "joining":
      return { title: "Joining", subtitle: "Connecting to the demo room…" };
    case "listening":
      return { title: "Listening", subtitle: "Listening…" };
    case "thinking":
      return { title: "Thinking", subtitle: "Preparing response…" };
    case "speaking":
      return { title: "Speaking", subtitle: "Speaking…" };
    case "presenting":
      return { title: "Presenting", subtitle: "Guiding your demo" };
    case "paused":
      return { title: "Paused", subtitle: "Paused for human takeover" };
    case "handoff_required":
      return { title: "Handoff", subtitle: "Human closer needed" };
    case "failed":
      return { title: "Unavailable", subtitle: "AI connection issue" };
    case "stopped":
      return { title: "Ended", subtitle: "Demo session ended" };
    default:
      return { title: "Ready", subtitle: "Your AI demo guide" };
  }
}
