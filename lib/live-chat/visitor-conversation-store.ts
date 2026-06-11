export type VisitorConversationEntry = {
  sessionId: string;
  title: string;
  preview?: string;
  updatedAt: string;
};

const INDEX_PREFIX = "digisales_conv_index_";
const ACTIVE_PREFIX = "digisales_live_active_";
const LEGACY_SESSION_PREFIX = "digisales_live_session_";

function indexKey(agentId: string): string {
  return `${INDEX_PREFIX}${agentId}`;
}

function activeKey(agentId: string): string {
  return `${ACTIVE_PREFIX}${agentId}`;
}

function legacySessionKey(agentId: string): string {
  return `${LEGACY_SESSION_PREFIX}${agentId}`;
}

function readIndex(agentId: string): VisitorConversationEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(indexKey(agentId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VisitorConversationEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(agentId: string, entries: VisitorConversationEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(indexKey(agentId), JSON.stringify(entries));
}

/** Pull legacy single-session storage into the conversation index once. */
export function migrateLegacyConversationIndex(agentId: string): void {
  if (typeof window === "undefined") return;
  const legacySessionId = localStorage.getItem(legacySessionKey(agentId))?.trim();
  if (!legacySessionId) return;

  const index = readIndex(agentId);
  if (!index.some((e) => e.sessionId === legacySessionId)) {
    index.unshift({
      sessionId: legacySessionId,
      title: "Previous chat",
      updatedAt: new Date().toISOString(),
    });
    writeIndex(agentId, index);
  }

  if (!localStorage.getItem(activeKey(agentId))) {
    localStorage.setItem(activeKey(agentId), legacySessionId);
  }
}

export function listConversations(agentId: string): VisitorConversationEntry[] {
  migrateLegacyConversationIndex(agentId);
  return readIndex(agentId).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getActiveSessionId(agentId: string): string | null {
  migrateLegacyConversationIndex(agentId);
  return localStorage.getItem(activeKey(agentId))?.trim() || null;
}

export function setActiveSessionId(agentId: string, sessionId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(activeKey(agentId), sessionId);
  localStorage.setItem(legacySessionKey(agentId), sessionId);
}

export function upsertConversation(
  agentId: string,
  entry: VisitorConversationEntry
): void {
  const index = readIndex(agentId);
  const i = index.findIndex((e) => e.sessionId === entry.sessionId);
  const next = { ...entry, updatedAt: entry.updatedAt || new Date().toISOString() };
  if (i >= 0) {
    index[i] = { ...index[i], ...next };
  } else {
    index.unshift(next);
  }
  writeIndex(agentId, index.slice(0, 40));
}

export function createConversation(agentId: string): string {
  const sessionId = `live_${crypto.randomUUID()}`;
  upsertConversation(agentId, {
    sessionId,
    title: "New conversation",
    updatedAt: new Date().toISOString(),
  });
  setActiveSessionId(agentId, sessionId);
  return sessionId;
}

export function replaceConversationSessionId(
  agentId: string,
  oldSessionId: string,
  newSessionId: string
): void {
  const index = readIndex(agentId);
  const i = index.findIndex((e) => e.sessionId === oldSessionId);
  if (i >= 0) {
    index[i] = { ...index[i], sessionId: newSessionId, updatedAt: new Date().toISOString() };
    writeIndex(agentId, index);
  } else {
    upsertConversation(agentId, {
      sessionId: newSessionId,
      title: "New conversation",
      updatedAt: new Date().toISOString(),
    });
  }
  const active = getActiveSessionId(agentId);
  if (active === oldSessionId) {
    setActiveSessionId(agentId, newSessionId);
  }
}

export function touchConversationFromUserMessage(
  agentId: string,
  sessionId: string,
  text: string
): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  const index = readIndex(agentId);
  const existing = index.find((e) => e.sessionId === sessionId);
  const title =
    existing?.title && existing.title !== "New conversation"
      ? existing.title
      : trimmed.length > 42
        ? `${trimmed.slice(0, 42)}…`
        : trimmed;
  upsertConversation(agentId, {
    sessionId,
    title,
    preview: trimmed.slice(0, 80),
    updatedAt: new Date().toISOString(),
  });
}

export function formatConversationTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
