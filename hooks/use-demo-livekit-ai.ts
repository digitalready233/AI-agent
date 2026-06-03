"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DemoVoiceTurnResult } from "@/hooks/use-demo-voice";
import { liveKitAiTurnToVoiceResult } from "@/lib/demo/livekit-ai-turn-client";
import type { DemoLiveKitAiTurnResult } from "@/lib/demo/demo-livekit-ai-worker";

export type LiveKitAiPhase =
  | "not_started"
  | "joining"
  | "listening"
  | "thinking"
  | "speaking"
  | "paused"
  | "stopped"
  | "failed";

export type LiveKitAiStatusPayload = {
  ok?: boolean;
  ai_joined?: boolean;
  ai_status?: string;
  ai_paused?: boolean;
  phase?: LiveKitAiPhase;
  ai_participant_identity?: string | null;
  ai_last_response_at?: string | null;
  last_error?: string | null;
  demo_path_id?: string | null;
  current_demo_asset_id?: string | null;
  lead_score?: number | null;
  lead_category?: string | null;
  booking_recommended?: boolean;
  handoff_required?: boolean;
  demo_path_title?: string | null;
  current_demo_stage?: string;
  recommended_next_action?: string | null;
  qualification_progress?: Record<string, boolean>;
  objections?: string[];
  ai_audio_mode?: string;
  ai_audio_status?: string;
  ai_audio_track_published?: boolean;
  ai_audio_error?: string | null;
  ai_last_spoken_at?: string | null;
  uses_native_livekit_audio?: boolean;
  duplicate_audio_prevented?: boolean;
};

async function speakBrowser(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  return new Promise<void>((resolve) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

async function playBase64Audio(base64: string, mime: string) {
  const src = `data:${mime};base64,${base64}`;
  const audio = new Audio(src);
  await audio.play();
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("Playback failed"));
  });
}

export function useDemoLivekitAi(params: {
  sessionId: string;
  enabled: boolean;
  autoStart?: boolean;
  onStatus?: (status: LiveKitAiStatusPayload) => void;
  onWelcomeTurn?: (turn: DemoVoiceTurnResult) => void;
  onTurnComplete?: (turn: DemoVoiceTurnResult, userMessage: string) => void;
}) {
  const [phase, setPhase] = useState<LiveKitAiPhase>("not_started");
  const [aiStatus, setAiStatus] = useState<string>("not_started");
  const [aiJoined, setAiJoined] = useState(false);
  const [aiPaused, setAiPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [aiAudioMode, setAiAudioMode] = useState<string>("fallback_tts");
  const [aiAudioStatus, setAiAudioStatus] = useState<string>("idle");
  const [nativeRoomAudio, setNativeRoomAudio] = useState(false);
  const startAttempted = useRef(false);

  const refreshStatus = useCallback(async () => {
    if (!params.enabled) return;
    try {
      const res = await fetch("/api/demo/livekit/ai/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo_session_id: params.sessionId }),
      });
      const data = (await res.json()) as LiveKitAiStatusPayload & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "AI status unavailable");
        return;
      }
      setAiJoined(!!data.ai_joined);
      setAiStatus(data.ai_status ?? "not_started");
      setAiPaused(!!data.ai_paused);
      setPhase((data.phase as LiveKitAiPhase) ?? "not_started");
      setError(data.last_error ?? null);
      setAiAudioMode(data.ai_audio_mode ?? "fallback_tts");
      setAiAudioStatus(data.ai_audio_status ?? "idle");
      setNativeRoomAudio(
        !!data.uses_native_livekit_audio || !!data.duplicate_audio_prevented
      );
      params.onStatus?.(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status check failed");
    }
  }, [params]);

  const playTurnAudio = useCallback(async (turn: {
    ai_voice_text?: string;
    audio_base64?: string | null;
    audio_mime_type?: string | null;
    use_browser_tts?: boolean;
    published_to_livekit?: boolean;
    ai_audio_mode?: string | null;
  }) => {
    if (
      turn.published_to_livekit ||
      nativeRoomAudio ||
      turn.ai_audio_mode === "livekit_track" ||
      turn.ai_audio_mode === "realtime_agent"
    ) {
      setPhase("speaking");
      await new Promise((r) => setTimeout(r, 600));
      setPhase(aiPaused ? "paused" : "listening");
      return;
    }
    const text = turn.ai_voice_text?.trim();
    if (!text) return;
    setPhase("speaking");
    try {
      if (turn.audio_base64 && turn.audio_mime_type && !turn.use_browser_tts) {
        await playBase64Audio(turn.audio_base64, turn.audio_mime_type);
      } else {
        await speakBrowser(text);
      }
    } finally {
      setPhase(aiPaused ? "paused" : "listening");
    }
  }, [aiPaused, nativeRoomAudio]);

  const startAi = useCallback(async () => {
    if (!params.enabled || starting) return;
    setStarting(true);
    setPhase("joining");
    setError(null);
    try {
      const res = await fetch("/api/demo/livekit/ai/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo_session_id: params.sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase("failed");
        setError(data.error ?? "Failed to start AI agent");
        return;
      }
      setAiJoined(true);
      setAiStatus(data.ai_status ?? "active");
      setPhase("listening");
      if (data.welcome_turn) {
        const mapped = liveKitAiTurnToVoiceResult(
          data.welcome_turn as DemoLiveKitAiTurnResult
        );
        params.onWelcomeTurn?.(mapped);
        params.onTurnComplete?.(mapped, "");
        await playTurnAudio(mapped);
      }
      await refreshStatus();
    } catch (e) {
      setPhase("failed");
      setError(e instanceof Error ? e.message : "Start failed");
    } finally {
      setStarting(false);
    }
  }, [params, playTurnAudio, refreshStatus, starting]);

  const stopAi = useCallback(async () => {
    await fetch("/api/demo/livekit/ai/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ demo_session_id: params.sessionId }),
    });
    setPhase("stopped");
    setAiStatus("stopped");
    setAiJoined(false);
  }, [params.sessionId]);

  const sendMessage = useCallback(
    async (message: string, opts?: { transcript_segment?: string }) => {
      setPhase("thinking");
      const res = await fetch("/api/demo/livekit/ai/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demo_session_id: params.sessionId,
          message,
          transcript_segment: opts?.transcript_segment ?? message,
          input_type: "voice",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPhase("failed");
        setError(data.error ?? "AI message failed");
        return null;
      }
      const mapped = liveKitAiTurnToVoiceResult(
        data as DemoLiveKitAiTurnResult,
        message
      );
      params.onTurnComplete?.(mapped, message);
      await playTurnAudio(mapped);
      await refreshStatus();
      return data;
    },
    [params.sessionId, playTurnAudio, refreshStatus]
  );

  useEffect(() => {
    if (!params.enabled) return;
    void refreshStatus();
    const t = setInterval(() => void refreshStatus(), 8000);
    return () => clearInterval(t);
  }, [params.enabled, refreshStatus]);

  useEffect(() => {
    if (!params.enabled || !params.autoStart || startAttempted.current) return;
    if (aiJoined || aiStatus === "active" || aiStatus === "starting") return;
    startAttempted.current = true;
    void startAi();
  }, [params.enabled, params.autoStart, aiJoined, aiStatus, startAi]);

  return {
    phase,
    aiStatus,
    aiJoined,
    aiPaused,
    error,
    starting,
    refreshStatus,
    startAi,
    stopAi,
    sendMessage,
    playTurnAudio,
    aiAudioMode,
    aiAudioStatus,
    nativeRoomAudio,
    aiAudioModeLabel:
      aiAudioMode === "livekit_track"
        ? "Native LiveKit audio"
        : aiAudioMode === "realtime_agent"
          ? "OpenAI Realtime agent"
          : "Browser TTS fallback",
    phaseLabel:
      phase === "joining"
        ? "Joining"
        : phase === "listening"
          ? "Listening"
          : phase === "thinking"
            ? "Thinking"
            : phase === "speaking"
              ? "Speaking"
              : phase === "paused"
                ? "Paused"
                : phase === "stopped"
                  ? "Stopped"
                  : phase === "failed"
                    ? "Failed"
                    : "AI agent",
  };
}
