"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DemoVoiceStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "processing"
  | "ai_speaking"
  | "error"
  | "disconnected";

export type DemoVoiceTurnResult = {
  transcript: string;
  reply: string;
  ai_voice_text?: string;
  audio_base64?: string | null;
  audio_mime_type?: string | null;
  use_browser_tts?: boolean;
  published_to_livekit?: boolean;
  ai_audio_mode?: string | null;
  next_asset?: { id: string; title: string; content: string; asset_type: string } | null;
  booking_recommended?: boolean;
  handoff_required?: boolean;
  lead_category?: string | null;
  lead_score?: number | { total?: number };
  demo_stage?: string;
  selected_demo_path_id?: string | null;
  selected_demo_path_title?: string | null;
  qualification_progress?: Record<string, boolean>;
  objections?: string[];
  recommended_next_action?: string | null;
  ai_paused?: boolean;
  structured?: Record<string, unknown>;
};

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/wav"];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "audio/webm";
}

async function speakWithBrowser(text: string): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    throw new Error("Browser speech is not available.");
  }
  return new Promise((resolve, reject) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.pitch = 1;
    utter.onend = () => resolve();
    utter.onerror = () => reject(new Error("Voice playback failed."));
    window.speechSynthesis.speak(utter);
  });
}

export function useDemoVoice(params: {
  sessionId: string;
  enabled: boolean;
  displayName?: string;
  email?: string;
  phone?: string;
  currentAssetId?: string | null;
  aiPaused?: boolean;
  onTurnComplete: (data: DemoVoiceTurnResult) => void;
}) {
  const [status, setStatus] = useState<DemoVoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [voiceDemoActive, setVoiceDemoActive] = useState(false);
  const [useBrowserStt, setUseBrowserStt] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceDemoActiveRef = useRef(false);

  useEffect(() => {
    voiceDemoActiveRef.current = voiceDemoActive;
  }, [voiceDemoActive]);

  const stopAudio = useCallback(() => {
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  }, []);

  const playServerOrBrowserAudio = useCallback(
    async (spoken: string, audioBase64?: string | null, mimeType?: string | null, useBrowserTts?: boolean) => {
      if (muted || !spoken.trim()) {
        setStatus(voiceDemoActiveRef.current ? "idle" : "disconnected");
        return;
      }
      setStatus("ai_speaking");
      stopAudio();
      try {
        if (audioBase64 && mimeType && !useBrowserTts) {
          const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
          audioRef.current = audio;
          audio.onended = () =>
            setStatus(voiceDemoActiveRef.current ? "idle" : "disconnected");
          audio.onerror = () => {
            void speakWithBrowser(spoken).finally(() =>
              setStatus(voiceDemoActiveRef.current ? "idle" : "disconnected")
            );
          };
          await audio.play();
          return;
        }
        await speakWithBrowser(spoken);
        setStatus(voiceDemoActiveRef.current ? "idle" : "disconnected");
      } catch {
        setError("Voice playback failed. You can read the reply in the transcript.");
        setStatus("error");
      }
    },
    [muted, stopAudio]
  );

  const runVoiceTurn = useCallback(
    async (transcript: string, opts?: { prospectTranscriptSaved?: boolean }) => {
      if (params.aiPaused) {
        setError("A team member is assisting you — voice AI is paused.");
        setStatus("idle");
        return;
      }
      setStatus("processing");
      setError(null);
      try {
        const res = await fetch(`/api/demo/sessions/${params.sessionId}/voice`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            display_name: params.displayName,
            email: params.email,
            phone: params.phone,
            current_demo_asset_id: params.currentAssetId ?? undefined,
            prospect_transcript_saved: Boolean(opts?.prospectTranscriptSaved),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "AI response failed");

        const spoken = (data.ai_voice_text as string) ?? (data.reply as string);
        const turn: DemoVoiceTurnResult = {
          transcript,
          reply: data.reply as string,
          ai_voice_text: spoken,
          next_asset: data.next_asset ?? null,
          booking_recommended: data.booking_recommended,
          handoff_required: data.handoff_required,
          lead_category: data.lead_category,
          lead_score: data.lead_score,
          demo_stage: data.demo_stage ?? data.current_demo_stage,
          selected_demo_path_id: data.selected_demo_path_id,
          selected_demo_path_title: data.selected_demo_path_title,
          qualification_progress: data.qualification_progress,
          objections: data.objections,
          recommended_next_action: data.recommended_next_action,
          ai_paused: data.ai_paused,
          structured: data.structured,
        };
        params.onTurnComplete(turn);

        const speakRes = await fetch(`/api/demo/sessions/${params.sessionId}/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: spoken }),
        });
        const speakData = await speakRes.json();
        if (!speakRes.ok) {
          await playServerOrBrowserAudio(spoken, null, null, true);
          return;
        }
        await playServerOrBrowserAudio(
          speakData.text ?? spoken,
          speakData.audio_base64,
          speakData.audio_mime_type,
          speakData.use_browser_tts
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Voice turn failed");
        setStatus("error");
      }
    },
    [params, playServerOrBrowserAudio]
  );

  const transcribeBlob = useCallback(
    async (blob: Blob) => {
      const form = new FormData();
      form.append("audio", blob, "demo-utterance.webm");
      if (params.displayName) form.append("display_name", params.displayName);
      const res = await fetch(`/api/demo/sessions/${params.sessionId}/transcribe`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transcription failed");
      return data.transcript as string;
    },
    [params.displayName, params.sessionId]
  );

  const stopRecorder = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    recorderRef.current = null;
  }, []);

  const startBrowserRecognition = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError("Speech recognition is not supported. Use Chrome or Edge, or enable microphone recording.");
      setStatus("error");
      return;
    }
    setUseBrowserStt(true);
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    recognition.onstart = () => setStatus("listening");
    recognition.onerror = (ev) => {
      setError(
        ev.error === "not-allowed"
          ? "Microphone permission denied."
          : "Could not capture speech."
      );
      setStatus("error");
    };
    recognition.onresult = (ev) => {
      const text = ev.results[0]?.[0]?.transcript?.trim();
      if (text) {
        setStatus("processing");
        void runVoiceTurn(text, { prospectTranscriptSaved: false });
      } else {
        setError("No speech detected. Try again.");
        setStatus("error");
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setStatus((current) => {
        if (current === "listening") {
          return voiceDemoActiveRef.current ? "idle" : "disconnected";
        }
        return current;
      });
    };
    recognitionRef.current = recognition;
    recognition.start();
  }, [runVoiceTurn, status, voiceDemoActive]);

  const startRecorderListening = useCallback(async () => {
    if (!streamRef.current) {
      setError("Start voice demo first.");
      setStatus("error");
      return;
    }
    setUseBrowserStt(false);
    setStatus("listening");
    setError(null);
    chunksRef.current = [];
    const mime = pickRecorderMime();
    const recorder = new MediaRecorder(streamRef.current, { mimeType: mime });
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];
      if (blob.size < 800) {
        setError("Recording too short. Speak a bit longer.");
        setStatus("error");
        return;
      }
      setStatus("processing");
      try {
        const transcript = await transcribeBlob(blob);
        await runVoiceTurn(transcript, { prospectTranscriptSaved: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Transcription failed";
        if (msg.includes("OPENAI_API_KEY") && getSpeechRecognition()) {
          setError("Server transcription unavailable. Using browser speech recognition.");
          startBrowserRecognition();
          return;
        }
        setError(msg);
        setStatus("error");
      }
    };
    recorder.onerror = () => {
      setError("Recording failed.");
      setStatus("error");
    };
    recorder.start();
  }, [runVoiceTurn, startBrowserRecognition, transcribeBlob]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    stopRecorder();
    if (status === "listening") {
      setStatus(voiceDemoActive ? "idle" : "disconnected");
    }
  }, [status, stopRecorder, voiceDemoActive]);

  const startVoiceDemo = useCallback(async () => {
    if (!params.enabled) {
      setError("Voice demo is disabled for this organization.");
      setStatus("error");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone is not supported in this browser.");
      setStatus("error");
      return;
    }
    setStatus("connecting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      voiceDemoActiveRef.current = true;
      setVoiceDemoActive(true);
      setStatus("idle");
    } catch {
      setError("Microphone permission denied. Allow microphone access to use voice demo.");
      setStatus("error");
      setVoiceDemoActive(false);
    }
  }, [params.enabled]);

  const stopVoiceDemo = useCallback(() => {
    stopListening();
    stopAudio();
    releaseStream();
    voiceDemoActiveRef.current = false;
    setVoiceDemoActive(false);
    setStatus("disconnected");
  }, [releaseStream, stopAudio, stopListening]);

  const speakNow = useCallback(async () => {
    if (!voiceDemoActive) {
      await startVoiceDemo();
      if (!voiceDemoActiveRef.current && !streamRef.current) return;
    }
    if (params.aiPaused) {
      setError("AI is paused while a team member assists you.");
      return;
    }
    if (typeof MediaRecorder !== "undefined" && streamRef.current) {
      await startRecorderListening();
      return;
    }
    startBrowserRecognition();
  }, [
    params.aiPaused,
    startBrowserRecognition,
    startRecorderListening,
    startVoiceDemo,
    voiceDemoActive,
  ]);

  const finishSpeaking = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      stopRecorder();
    } else {
      stopListening();
    }
  }, [stopListening, stopRecorder]);

  const reconnect = useCallback(() => {
    setError(null);
    setStatus(voiceDemoActive ? "idle" : "disconnected");
  }, [voiceDemoActive]);

  useEffect(() => {
    return () => {
      stopListening();
      stopAudio();
      releaseStream();
    };
  }, [releaseStream, stopAudio, stopListening]);

  return {
    status,
    error,
    muted,
    setMuted,
    voiceDemoActive,
    useBrowserStt,
    startVoiceDemo,
    stopVoiceDemo,
    speakNow,
    finishSpeaking,
    stopListening,
    reconnect,
    /** @deprecated use speakNow after startVoiceDemo */
    startVoice: speakNow,
    disconnect: stopVoiceDemo,
  };
}
