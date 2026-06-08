"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { signOutClient } from "@/lib/auth/client-logout";
import {
  formatInactivityMinutes,
  getLastSessionActivityAt,
  getSessionInactivityMs,
  touchSessionActivity,
} from "@/lib/auth/session-inactivity";

const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

const CHECK_INTERVAL_MS = 30_000;

/**
 * Signs the user out after a period without pointer/keyboard activity.
 * Syncs last-activity across tabs via localStorage.
 */
export function useSessionInactivityLogout(enabled = true) {
  const router = useRouter();
  const signingOutRef = useRef(false);
  const timeoutMs = getSessionInactivityMs();

  useEffect(() => {
    if (!enabled || timeoutMs <= 0) return;

    async function performLogout() {
      if (signingOutRef.current) return;
      signingOutRef.current = true;
      const minutes = formatInactivityMinutes(timeoutMs);
      toast.info(`Signed out after ${minutes} minutes of inactivity.`, {
        duration: 6000,
      });
      await signOutClient(router);
    }

    const last = getLastSessionActivityAt();
    if (Date.now() - last >= timeoutMs) {
      void performLogout();
      return;
    }

    touchSessionActivity();

    const onActivity = () => {
      if (signingOutRef.current) return;
      touchSessionActivity();
    };

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== "digisales_last_activity_at" || signingOutRef.current) return;
      const last = getLastSessionActivityAt();
      if (Date.now() - last >= timeoutMs) {
        void performLogout();
      }
    };
    window.addEventListener("storage", onStorage);

    const interval = window.setInterval(() => {
      if (signingOutRef.current) return;
      const idleFor = Date.now() - getLastSessionActivityAt();
      if (idleFor >= timeoutMs) {
        void performLogout();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, [enabled, router, timeoutMs]);
}
