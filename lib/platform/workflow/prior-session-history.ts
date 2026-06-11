import { getConversationBySession, listMessages } from "@/lib/platform/data";

export type WorkflowHistoryTurn = {
  role: "user" | "assistant";
  content: string;
};

export async function loadPriorSessionHistory(params: {
  organizationId: string;
  agentId: string;
  priorSessionId: string;
  maxTurns?: number;
}): Promise<WorkflowHistoryTurn[]> {
  const priorConversation = await getConversationBySession(
    params.organizationId,
    params.agentId,
    params.priorSessionId
  );
  if (!priorConversation) return [];

  const rows = await listMessages(priorConversation.id);
  const turns = rows
    .filter((m) => m.sender_type === "user" || m.sender_type === "assistant")
    .map((m) => ({
      role: m.sender_type === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content.trim(),
    }))
    .filter((m) => m.content.length > 0);

  const cap = params.maxTurns ?? 24;
  return turns.slice(-cap);
}
