/** Client-readable inactivity timeout before automatic sign-out (minutes). */
export const DEFAULT_SESSION_INACTIVITY_MINUTES = 30;

const LAST_ACTIVITY_KEY = "digisales_last_activity_at";

export function getSessionInactivityMs(): number {
  const raw = process.env.NEXT_PUBLIC_SESSION_INACTIVITY_MINUTES?.trim();
  const minutes = raw ? Number(raw) : DEFAULT_SESSION_INACTIVITY_MINUTES;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return DEFAULT_SESSION_INACTIVITY_MINUTES * 60 * 1000;
  }
  return minutes * 60 * 1000;
}

export function touchSessionActivity(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    /* private mode / storage full */
  }
}

export function getLastSessionActivityAt(): number {
  if (typeof window === "undefined") return Date.now();
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : Date.now();
  } catch {
    return Date.now();
  }
}

export function clearSessionActivity(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    /* */
  }
}

export function formatInactivityMinutes(ms: number): number {
  return Math.max(1, Math.round(ms / 60_000));
}
