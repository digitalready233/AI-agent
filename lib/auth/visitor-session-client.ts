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

export function visitorAuthHeaders(token: string | null): HeadersInit {
  if (!token) return {};
  return { "X-Visitor-Token": token };
}
