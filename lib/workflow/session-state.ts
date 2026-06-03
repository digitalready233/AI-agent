import type { Channel } from "../types";
import type { ConversationStage, WorkflowSessionState } from "./types";

const sessions = new Map<string, WorkflowSessionState>();

export function getWorkflowState(
  sessionId: string
): WorkflowSessionState | undefined {
  return sessions.get(sessionId);
}

export function upsertWorkflowState(
  sessionId: string,
  channel: Channel,
  patch: Partial<
    Pick<
      WorkflowSessionState,
      "conversationStage" | "lastIntent" | "conversationSummary" | "channelRef"
    >
  >
): WorkflowSessionState {
  const existing = sessions.get(sessionId);
  const now = new Date().toISOString();
  const next: WorkflowSessionState = {
    sessionId,
    channel: existing?.channel ?? channel,
    conversationStage:
      patch.conversationStage ??
      existing?.conversationStage ??
      "new_visitor",
    lastIntent: patch.lastIntent ?? existing?.lastIntent,
    conversationSummary:
      patch.conversationSummary ?? existing?.conversationSummary ?? "",
    channelRef: patch.channelRef ?? existing?.channelRef,
    updatedAt: now,
  };
  sessions.set(sessionId, next);
  return next;
}

export function listWorkflowSessions(): WorkflowSessionState[] {
  return [...sessions.values()].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
