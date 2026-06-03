"use client";

import { useCallback, useState } from "react";
import type { PresentationControlMode } from "@/lib/demo/types";

type PresentationResponse = {
  ok?: boolean;
  session?: Record<string, unknown>;
  pending_ai_action?: Record<string, unknown> | null;
  error?: string;
};

export function useDemoPresentationControl(sessionId: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/platform/demo/sessions/${sessionId}/presentation`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
          }
        );
        const data = (await res.json()) as PresentationResponse;
        if (!res.ok) {
          throw new Error(data.error ?? "Presentation command failed");
        }
        return data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Command failed";
        setError(msg);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [sessionId]
  );

  return {
    busy,
    error,
    setControlMode: (mode: PresentationControlMode) =>
      run({ command: "set_control_mode", control_mode: mode }),
    selectPath: (demoPathId: string) =>
      run({ command: "select_path", demo_path_id: demoPathId }),
    selectAsset: (demoAssetId: string) =>
      run({ command: "select_asset", demo_asset_id: demoAssetId }),
    nextAsset: (demoPathId?: string) =>
      run({ command: "next_asset", demo_path_id: demoPathId }),
    previousAsset: (demoPathId?: string) =>
      run({ command: "previous_asset", demo_path_id: demoPathId }),
    showBookingCta: () => run({ command: "show_booking_cta" }),
    hideBookingCta: () => run({ command: "hide_booking_cta" }),
    pauseAi: () => run({ command: "pause_ai" }),
    resumeAi: () => run({ command: "resume_ai" }),
    takeOver: () => run({ command: "take_over" }),
    returnToAi: (controlMode?: PresentationControlMode) =>
      run({
        command: "return_to_ai",
        control_mode: controlMode ?? "ai_controlled",
      }),
    startScreenShare: () => run({ command: "screen_share_start" }),
    stopScreenShare: () => run({ command: "screen_share_stop" }),
    applyPendingAi: () => run({ command: "apply_pending_ai_action" }),
  };
}
