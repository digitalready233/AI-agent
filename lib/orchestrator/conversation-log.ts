import type { Channel } from "../config";
import {
  appendChatMessage,
  ensureChatMemoryHydrated,
  getSessionMessages,
} from "../chat-memory";

export type { ChatMessageRecord as LoggedMessage } from "../chat-memory/types";

export async function ensureConversationLogHydrated(): Promise<void> {
  await ensureChatMemoryHydrated();
}

export function getSessionLog(sessionId: string) {
  return getSessionMessages(sessionId);
}

/**
 * Record an exchanged message for dashboard / summaries / chat memory.
 * Returns whether this is the first user message in the session.
 */
export async function appendSessionMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  channel: Channel
): Promise<{ isFirstUserMessage: boolean }> {
  await ensureChatMemoryHydrated();
  return appendChatMessage(sessionId, role, content, channel);
}
