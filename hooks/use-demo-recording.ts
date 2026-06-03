"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type DemoRecordingUiStatus =
  | "idle"
  | "consent_required"
  | "pending_consent"
  | "starting"
  | "recording"
  | "stopped"
  | "failed"
  | "unavailable";

type RecordingConfig = {
  enable_recording?: boolean;
  auto_record_demos?: boolean;
  record_only_with_consent?: boolean;
  require_recording_consent?: boolean;
  consent_message?: string;
  recording_status?: string;
  recording_consent_given?: boolean;
};

function needsConsent(cfg: RecordingConfig | null | undefined): boolean {
  return Boolean(
    cfg?.require_recording_consent ?? cfg?.record_only_with_consent
  );
}

export function useDemoRecording(opts: {
  sessionId: string;
  enabled: boolean;
  staffMode: boolean;
  recordingConfig?: RecordingConfig | null;
  onConsentRequired?: () => void;
}) {
  const { sessionId, enabled, staffMode, recordingConfig } = opts;
  const [status, setStatus] = useState<DemoRecordingUiStatus>("idle");
  const [providerConfigured, setProviderConfigured] = useState(true);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const apiBase = staffMode
    ? `/api/platform/demo/sessions/${sessionId}/recording`
    : `/api/demo/livekit/recording`;

  const syncFromConfig = useCallback(() => {
    const s = (recordingConfig?.recording_status ?? "idle") as DemoRecordingUiStatus;
    setStatus(s);
    if (
      needsConsent(recordingConfig) &&
      !recordingConfig?.recording_consent_given &&
      s !== "recording" &&
      s !== "starting"
    ) {
      setStatus("consent_required");
    }
  }, [recordingConfig]);

  const refreshStatus = useCallback(async () => {
    if (!enabled || !sessionId) return;
    try {
      const statusUrl = staffMode
        ? `${apiBase}/status`
        : `${apiBase}/status?demo_session_id=${encodeURIComponent(sessionId)}`;
      const res = await fetch(statusUrl, {
        credentials: staffMode ? "include" : "same-origin",
      });
      const data = await res.json();
      if (!res.ok) return;
      setStatus((data.recording_status ?? "idle") as DemoRecordingUiStatus);
      setRecordingUrl(data.recording_url ?? null);
      setProviderConfigured(Boolean(data.provider?.configured));
      setProviderMessage(data.provider?.message ?? null);
      if (data.recording_started_at && data.recording_status === "recording") {
        const start = new Date(data.recording_started_at).getTime();
        setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
      }
    } catch {
      /* ignore */
    }
  }, [enabled, sessionId, staffMode, apiBase]);

  useEffect(() => {
    syncFromConfig();
  }, [syncFromConfig]);

  useEffect(() => {
    if (!enabled) return;
    void refreshStatus();
    const id = setInterval(() => void refreshStatus(), 15000);
    return () => clearInterval(id);
  }, [enabled, refreshStatus]);

  useEffect(() => {
    if (status === "recording") {
      timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      if (status !== "starting") setElapsedSec(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  const submitConsent = useCallback(
    async (accepted: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/demo/livekit/recording/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            demo_session_id: sessionId,
            consent_given: accepted,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Consent failed");
        setStatus(
          accepted
            ? ((data.recording_status as DemoRecordingUiStatus) ?? "idle")
            : "idle"
        );
        if (!accepted) {
          setProviderMessage(null);
        }
        return accepted;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Consent failed");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [sessionId]
  );

  const startRecording = useCallback(async () => {
    if (!staffMode) return;
    if (!recordingConfig?.enable_recording) {
      setError("Recording is disabled in settings");
      return;
    }
    if (needsConsent(recordingConfig) && !recordingConfig.recording_consent_given) {
      opts.onConsentRequired?.();
      setStatus("consent_required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: staffMode ? "include" : "same-origin",
        body: JSON.stringify({
          demo_session_id: sessionId,
          consent_given: recordingConfig.recording_consent_given ?? true,
          started_by: "staff",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start recording");
      setStatus((data.recording_status ?? "recording") as DemoRecordingUiStatus);
      setElapsedSec(0);
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Start failed");
      setStatus("failed");
    } finally {
      setBusy(false);
    }
  }, [staffMode, recordingConfig, sessionId, refreshStatus, opts, apiBase]);

  const stopRecording = useCallback(async () => {
    if (!staffMode) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          demo_session_id: sessionId,
          started_by: "staff",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to stop recording");
      setStatus("stopped");
      setRecordingUrl(data.recording?.recording_url ?? recordingUrl);
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stop failed");
    } finally {
      setBusy(false);
    }
  }, [staffMode, sessionId, recordingUrl, refreshStatus, apiBase]);

  useEffect(() => {
    if (
      staffMode &&
      recordingConfig?.auto_record_demos &&
      recordingConfig.enable_recording &&
      status === "idle" &&
      (!needsConsent(recordingConfig) || recordingConfig.recording_consent_given)
    ) {
      void startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffMode, recordingConfig?.auto_record_demos]);

  return {
    status,
    error,
    busy,
    elapsedSec,
    providerConfigured,
    providerMessage,
    recordingUrl,
    consentMessage:
      recordingConfig?.consent_message ??
      "This demo may be recorded for quality, training, and follow-up purposes. Do you agree to continue?",
    canControlRecording: staffMode && Boolean(recordingConfig?.enable_recording),
    submitConsent,
    startRecording,
    stopRecording,
    refreshStatus,
  };
}
