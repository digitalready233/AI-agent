import type { NextRequest, NextResponse } from "next/server";

/** Must match client `session-inactivity.ts` cookie name. */
export const SESSION_ACTIVITY_COOKIE = "digisales_last_activity_at";

export const DEFAULT_SESSION_INACTIVITY_MINUTES = 30;

export function getSessionInactivityMs(): number {
  const raw = process.env.NEXT_PUBLIC_SESSION_INACTIVITY_MINUTES?.trim();
  const minutes = raw ? Number(raw) : DEFAULT_SESSION_INACTIVITY_MINUTES;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return DEFAULT_SESSION_INACTIVITY_MINUTES * 60 * 1000;
  }
  return minutes * 60 * 1000;
}

export function getLastActivityFromRequest(request: NextRequest): number | null {
  const raw = request.cookies.get(SESSION_ACTIVITY_COOKIE)?.value;
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** True when the Supabase session should be cleared due to inactivity. */
export function isSessionIdleExpired(request: NextRequest): boolean {
  const last = getLastActivityFromRequest(request);
  if (last === null) return true;
  return Date.now() - last >= getSessionInactivityMs();
}

const ACTIVITY_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export function stampSessionActivityCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_ACTIVITY_COOKIE, String(Date.now()), {
    path: "/",
    maxAge: ACTIVITY_COOKIE_MAX_AGE_SEC,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export function clearSessionActivityCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_ACTIVITY_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });
  return response;
}
