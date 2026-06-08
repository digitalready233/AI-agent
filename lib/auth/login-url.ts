export const LOGIN_PATH = "/auth/login";

/** Reject open redirects; allow only same-site relative paths. */
export function safeNextPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (
    typeof raw === "string" &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\0")
  ) {
    return raw;
  }
  return fallback;
}

/** Canonical sign-in entry — always send users here before the workspace. */
export function loginUrl(nextPath = "/dashboard"): string {
  const next = safeNextPath(nextPath, "/dashboard");
  return `/auth/login?next=${encodeURIComponent(next)}`;
}
