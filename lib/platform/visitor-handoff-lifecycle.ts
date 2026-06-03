import { saveMessage } from "@/lib/platform/data";
import type { ConversationStatus } from "@/lib/platform/types";
import { conversationRequiresStaffHandling } from "@/lib/platform/visitor-chat";

export const VISITOR_AI_RESUMED_MESSAGE =
  "You're connected back with our AI assistant. Feel free to continue the conversation here.";

export function shouldNotifyVisitorAiResumed(
  previousStatus: ConversationStatus,
  nextStatus: ConversationStatus
): boolean {
  if (!conversationRequiresStaffHandling(previousStatus)) return false;
  return nextStatus === "resolved" || nextStatus === "closed";
}

export async function appendVisitorAiResumedMessage(
  conversationId: string
): Promise<void> {
  const now = new Date().toISOString();
  await saveMessage({
    id: crypto.randomUUID(),
    conversation_id: conversationId,
    sender_type: "system",
    sender_name: "System",
    content: VISITOR_AI_RESUMED_MESSAGE,
    metadata: { event: "ai_resumed_after_handoff" },
    created_at: now,
  });
}
