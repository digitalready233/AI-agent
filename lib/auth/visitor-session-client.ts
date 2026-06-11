const TOKEN_SUFFIX = "_visitor_token";

export function visitorTokenStorageKey(sessionStorageKey: string): string {
  return `${sessionStorageKey}${TOKEN_SUFFIX}`;
}

export function getStoredVisitorToken(sessionStorageKey: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(visitorTokenStorageKey(sessionStorageKey))?.trim() || null;
}

export function storeVisitorToken(sessionStorageKey: string, token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(visitorTokenStorageKey(sessionStorageKey), token);
}

export function clearVisitorToken(sessionStorageKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(visitorTokenStorageKey(sessionStorageKey));
}

/** New session id when visitor token is invalid but an old conversation still exists in DB. */
export function rotateVisitorSession(
  sessionStorageKey: string,
  createId: () => string
): string {
  if (typeof window === "undefined") return "";
  clearVisitorToken(sessionStorageKey);
  localStorage.removeItem(sessionStorageKey);
  const newId = createId();
  localStorage.setItem(sessionStorageKey, newId);
  return newId;
}

export function visitorAuthHeaders(token: string | null): HeadersInit {
  if (!token) return {};
  return { "X-Visitor-Token": token };
}

/** Per live-agent session token (supports multiple conversations per browser). */
export function liveSessionTokenKey(agentId: string, sessionId: string): string {
  return `digisales_vt_${agentId}_${sessionId}`;
}

export function getStoredLiveSessionToken(
  agentId: string,
  sessionId: string
): string | null {
  if (typeof window === "undefined") return null;
  const scoped = localStorage.getItem(liveSessionTokenKey(agentId, sessionId))?.trim();
  if (scoped) return scoped;

  const legacySessionKey = `digisales_live_session_${agentId}`;
  const legacySessionId = localStorage.getItem(legacySessionKey)?.trim();
  if (legacySessionId === sessionId) {
    return getStoredVisitorToken(legacySessionKey);
  }
  return null;
}

export function storeLiveSessionToken(
  agentId: string,
  sessionId: string,
  token: string
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(liveSessionTokenKey(agentId, sessionId), token);
}

export function clearLiveSessionToken(agentId: string, sessionId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(liveSessionTokenKey(agentId, sessionId));
}
