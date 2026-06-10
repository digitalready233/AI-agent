/** Platform API routes that stay public (no session required). */
const PUBLIC_PLATFORM_API_PREFIXES = [
  "/api/platform/chat/agent",
  "/api/platform/chat/history",
  "/api/platform/chat/stream",
  "/api/platform/chat/sync",
  "/api/platform/chat/voice",
  "/api/platform/calendar/meeting-types",
] as const;

const PUBLIC_PLATFORM_API_EXACT = ["/api/platform/chat"] as const;

export function isPublicPlatformApiPath(pathname: string): boolean {
  if (PUBLIC_PLATFORM_API_EXACT.some((p) => pathname === p)) return true;
  return PUBLIC_PLATFORM_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
