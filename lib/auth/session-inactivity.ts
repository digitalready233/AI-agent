/** Client-readable inactivity timeout before automatic sign-out (minutes). */
export const DEFAULT_SESSION_INACTIVITY_MINUTES = 30;

const LAST_ACTIVITY_KEY = "digisales_last_activity_at";
export const SESSION_ACTIVITY_COOKIE = LAST_ACTIVITY_KEY;

const ACTIVITY_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;

function activityCookieFlags(): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  return `; path=/; max-age=${ACTIVITY_COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
}

function readActivityCookie(): number | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LAST_ACTIVITY_KEY}=([^;]*)`)
  );
  if (!match?.[1]) return null;
  const n = Number(decodeURIComponent(match[1]));
  return Number.isFinite(n) ? n : null;
}

function writeActivityCookie(at: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LAST_ACTIVITY_KEY}=${encodeURIComponent(String(at))}${activityCookieFlags()}`;
}

function clearActivityCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LAST_ACTIVITY_KEY}=; path=/; max-age=0; SameSite=Lax`;
}

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
  const at = Date.now();
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(at));
  } catch {
    /* private mode / storage full */
  }
  writeActivityCookie(at);
}

export function getLastSessionActivityAt(): number {
  if (typeof window === "undefined") return Date.now();
  let fromStorage: number | null = null;
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    const n = raw ? Number(raw) : NaN;
    fromStorage = Number.isFinite(n) ? n : null;
  } catch {
    fromStorage = null;
  }
  const fromCookie = readActivityCookie();
  if (fromStorage != null && fromCookie != null) {
    return Math.max(fromStorage, fromCookie);
  }
  return fromStorage ?? fromCookie ?? Date.now();
}

export function clearSessionActivity(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    /* */
  }
  clearActivityCookie();
}

export function formatInactivityMinutes(ms: number): number {
  return Math.max(1, Math.round(ms / 60_000));
}
