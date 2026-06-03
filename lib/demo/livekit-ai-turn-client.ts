import type { DemoVoiceTurnResult } from "@/hooks/use-demo-voice";
import type { DemoLiveKitAiTurnResult } from "./demo-livekit-ai-worker";

/** Map server LiveKit AI turn payload to demo room voice/UI shape */
export function liveKitAiTurnToVoiceResult(
  turn: DemoLiveKitAiTurnResult,
  userMessage?: string
): DemoVoiceTurnResult {
  return {
    transcript: userMessage ?? "",
    reply: turn.ai_response ?? "",
    ai_voice_text: turn.ai_voice_text,
    audio_base64: turn.audio_base64,
    audio_mime_type: turn.audio_mime_type,
    use_browser_tts: turn.use_browser_tts,
    published_to_livekit: turn.published_to_livekit,
    ai_audio_mode: turn.ai_audio_mode,
    next_asset: turn.next_asset ?? null,
    booking_recommended: turn.booking_recommended,
    handoff_required: turn.handoff_required,
    lead_category: turn.lead_category,
    lead_score: turn.lead_score,
    demo_stage: turn.demo_stage,
    selected_demo_path_id: turn.selected_demo_path_id,
    selected_demo_path_title: turn.selected_demo_path_title,
    qualification_progress: turn.qualification_progress,
    objections: turn.objections,
    recommended_next_action: turn.recommended_next_action,
    structured: turn.structured,
  };
}
