/** Canonical sign-in entry — always send users here before the workspace. */
export function loginUrl(nextPath = "/dashboard"): string {
  const next =
    typeof nextPath === "string" &&
    nextPath.startsWith("/") &&
    !nextPath.startsWith("//") &&
    !nextPath.includes("\0")
      ? nextPath
      : "/dashboard";
  return `/auth/login?next=${encodeURIComponent(next)}`;
}

export const LOGIN_PATH = "/auth/login";
