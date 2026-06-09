"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlatformChatResponseBody } from "@/lib/platform/chat/build-platform-chat-response";

export type LiveAgentVoiceStatus =
  | "idle"
  | "listening"
  | "processing"
  | "ai_speaking"
  | "error";

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/wav"];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "audio/webm";
}

export function useLiveAgentVoice(params: {
  sessionId: string;
  agentId: string;
  enabled: boolean;
  autoPlay: boolean;
  onTurnComplete: (data: PlatformChatResponseBody & { transcript?: string }) => void;
  onError: (message: string) => void;
}) {
  const [status, setStatus] = useState<LiveAgentVoiceStatus>("idle");
  const [recording, setRecording] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(params.enabled);
  const autoPlayRef = useRef(params.autoPlay);

  useEffect(() => {
    enabledRef.current = params.enabled;
  }, [params.enabled]);

  useEffect(() => {
    autoPlayRef.current = params.autoPlay;
  }, [params.autoPlay]);

  const stopPlayback = useCallback(() => {
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

  const playResponseAudio = useCallback(
    async (reply: string, audioBase64?: string | null, mimeType?: string | null) => {
      if (!autoPlayRef.current || !reply.trim()) {
        setStatus("idle");
        return;
      }
      setStatus("ai_speaking");
      stopPlayback();
      try {
        if (audioBase64 && mimeType) {
          const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
          audioRef.current = audio;
          audio.onended = () => setStatus("idle");
          audio.onerror = () => setStatus("idle");
          await audio.play();
          return;
        }
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(reply);
          utterance.onend = () => setStatus("idle");
          utterance.onerror = () => setStatus("idle");
          window.speechSynthesis.speak(utterance);
          return;
        }
        setStatus("idle");
      } catch {
        setStatus("idle");
      }
    },
    [stopPlayback]
  );

  const sendAudioBlob = useCallback(
    async (blob: Blob, mimeType: string) => {
      if (!params.sessionId || !params.agentId) return;
      setStatus("processing");
      try {
        const form = new FormData();
        form.append("sessionId", params.sessionId);
        form.append("agentId", params.agentId);
        form.append("channel", "live_agent");
        form.append("includeTts", "true");
        form.append("audio", blob, "recording.webm");

        const res = await fetch("/api/platform/chat/voice", {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as PlatformChatResponseBody & {
          error?: string;
        };

        if (!res.ok) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "Voice message could not be sent."
          );
        }

        params.onTurnComplete(data);
        await playResponseAudio(
          data.reply ?? "",
          data.audioBase64,
          data.audioMimeType
        );
        setStatus("idle");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Voice message failed. Try again.";
        params.onError(message);
        setStatus("error");
      }
    },
    [params, playResponseAudio]
  );

  const ensureMic = useCallback(async () => {
    if (streamRef.current) return streamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    return stream;
  }, []);

  const startRecording = useCallback(async () => {
    if (!enabledRef.current || recording) return;
    try {
      await ensureMic();
      chunksRef.current = [];
      const mime = pickRecorderMime();
      const recorder = new MediaRecorder(streamRef.current!, { mimeType: mime });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size > 0) {
          void sendAudioBlob(blob, mime);
        } else {
          setStatus("idle");
          params.onError("No speech detected. Try again.");
        }
      };
      recorder.start();
      setRecording(true);
      setStatus("listening");
    } catch {
      params.onError("Microphone access is required for voice mode.");
      setStatus("error");
    }
  }, [ensureMic, params, recording, sendAudioBlob]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setRecording(false);
  }, []);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [recording, startRecording, stopRecording]);

  useEffect(() => {
    return () => {
      stopPlayback();
      releaseStream();
    };
  }, [releaseStream, stopPlayback]);

  return {
    status,
    recording,
    toggleRecording,
    stopRecording,
    stopPlayback,
    playResponseAudio,
  };
}
