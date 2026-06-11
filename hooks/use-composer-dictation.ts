"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ComposerDictationStatus = "idle" | "recording" | "transcribing";

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/wav"];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "audio/webm";
}

export function useComposerDictation(params: {
  agentId: string;
  sessionId: string;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState<ComposerDictationStatus>("idle");
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  const cancelRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    chunksRef.current = [];
    stopStream();
    setStatus("idle");
  }, [stopStream]);

  const startRecording = useCallback(async () => {
    if (params.disabled || !params.sessionId) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone is not available in this browser.");
    }

    cancelRecording();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mimeType = pickRecorderMime();
    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(200);
    setStatus("recording");
  }, [cancelRecording, params.disabled, params.sessionId]);

  const finishRecording = useCallback(async (): Promise<string> => {
    if (status !== "recording" || !recorderRef.current) {
      return "";
    }

    const recorder = recorderRef.current;
    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("Recording failed."));
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        resolve(new Blob(chunksRef.current, { type }));
      };
      recorder.stop();
    });

    recorderRef.current = null;
    chunksRef.current = [];
    stopStream();
    setStatus("transcribing");

    try {
      const form = new FormData();
      form.append("sessionId", params.sessionId);
      form.append("agentId", params.agentId);
      form.append("audio", blob, "dictation.webm");

      const res = await fetch("/api/platform/chat/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { transcript?: string; error?: string };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not transcribe. Try again or type your message."
        );
      }
      return data.transcript?.trim() ?? "";
    } finally {
      setStatus("idle");
    }
  }, [params.agentId, params.sessionId, status, stopStream]);

  return {
    status,
    isRecording: status === "recording",
    isTranscribing: status === "transcribing",
    startRecording,
    finishRecording,
    cancelRecording,
  };
}
