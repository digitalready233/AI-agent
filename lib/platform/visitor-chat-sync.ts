import {
  getAgent,
  getConversationBySession,
  listMessages,
} from "@/lib/platform/data";
import {
  mapConversationToVisitorSync,
  type VisitorChatSyncPayload,
} from "@/lib/platform/visitor-chat";

export async function loadVisitorChatSync(params: {
  sessionId: string;
  agentId: string;
}): Promise<VisitorChatSyncPayload | null> {
  const agent = await getAgent(params.agentId);
  if (!agent) return null;

  const conversation = await getConversationBySession(
    agent.organization_id,
    agent.id,
    params.sessionId
  );
  if (!conversation) return null;

  const rows = await listMessages(conversation.id);
  return mapConversationToVisitorSync(conversation, rows);
}

/** Cheap change detector for SSE push filtering. */
export function visitorSyncFingerprint(payload: VisitorChatSyncPayload): string {
  const last = payload.messages[payload.messages.length - 1];
  return [
    payload.conversationId,
    payload.status,
    payload.staffHandling,
    payload.handoffActive,
    payload.staffJoined,
    payload.messages.length,
    last?.id ?? "",
    last?.at ?? "",
  ].join("|");
}
