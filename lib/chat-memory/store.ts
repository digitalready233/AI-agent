import { logEvent } from "../analytics";
import type { Channel } from "../config";
import { readJsonFile, writeJsonFile } from "../persistence/json-db";
import type { ChatMessageRecord, ChatSessionRecord } from "./types";

const SESSIONS_FILE = "chat-sessions.json";
const MAX_MESSAGES_PER_SESSION = 120;

const memory = new Map<string, ChatSessionRecord>();
let hydrated = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void writeJsonFile(SESSIONS_FILE, Object.fromEntries(memory.entries())).catch(
      () => undefined
    );
  }, 80);
}

export async function ensureChatMemoryHydrated(): Promise<void> {
  if (hydrated) return;
  const raw = await readJsonFile<Record<string, ChatSessionRecord>>(
    SESSIONS_FILE,
    {}
  );
  for (const [id, session] of Object.entries(raw)) {
    memory.set(id, session);
  }
  hydrated = true;
}

export function getChatSession(
  sessionId: string
): ChatSessionRecord | undefined {
  return memory.get(sessionId);
}

export function getSessionMessages(sessionId: string): ChatMessageRecord[] {
  return [...(memory.get(sessionId)?.messages ?? [])];
}

export function listChatSessions(): ChatSessionRecord[] {
  return [...memory.values()].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/**
 * Append a message to the session log (dedupes identical back-to-back entries).
 * Returns whether this is the first user message in the session.
 */
export function appendChatMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  channel: Channel
): { isFirstUserMessage: boolean } {
  const trimmed = content.trim();
  if (!trimmed) {
    return { isFirstUserMessage: false };
  }

  const now = new Date().toISOString();
  const existing = memory.get(sessionId);
  const messages = existing?.messages ?? [];
  const hadUser = messages.some((m) => m.role === "user");
  const isFirstUserMessage = role === "user" && !hadUser;

  const last = messages[messages.length - 1];
  if (
    last &&
    last.role === role &&
    last.content === trimmed &&
    last.channel === channel
  ) {
    return { isFirstUserMessage };
  }

  const nextMessage: ChatMessageRecord = {
    role,
    content: trimmed,
    channel,
    at: now,
  };

  const nextMessages =
    messages.length >= MAX_MESSAGES_PER_SESSION
      ? [...messages.slice(-(MAX_MESSAGES_PER_SESSION - 1)), nextMessage]
      : [...messages, nextMessage];

  const session: ChatSessionRecord = {
    sessionId,
    channel: existing?.channel ?? channel,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    messages: nextMessages,
  };

  memory.set(sessionId, session);
  schedulePersist();

  if (isFirstUserMessage) {
    logEvent("conversation_started", sessionId, channel);
  }

  if (role === "user") {
    logEvent("customer_message_saved", sessionId, channel, {
      preview: trimmed.slice(0, 240),
    });
  }

  return { isFirstUserMessage };
}

/** Messages formatted for the AI SDK / useChat (roles only, no ids). */
export function getMessagesForModel(
  sessionId: string
): { role: "user" | "assistant"; content: string }[] {
  return getSessionMessages(sessionId).map((m) => ({
    role: m.role,
    content: m.content,
  }));
}
