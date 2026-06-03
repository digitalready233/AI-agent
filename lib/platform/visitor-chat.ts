import type { Conversation, ConversationStatus, Message } from "@/lib/platform/types";

export type VisitorChatRole = "user" | "assistant" | "staff" | "system";

export type VisitorChatMessage = {
  id: string;
  role: VisitorChatRole;
  content: string;
  at: string;
  label?: string;
};

export type VisitorChatSyncPayload = {
  conversationId: string;
  status: ConversationStatus;
  staffHandling: boolean;
  handoffActive: boolean;
  staffJoined: boolean;
  messages: VisitorChatMessage[];
};

const STAFF_HANDLED_STATUSES: ConversationStatus[] = ["human_needed", "assigned"];

export function conversationRequiresStaffHandling(
  status: ConversationStatus
): boolean {
  return STAFF_HANDLED_STATUSES.includes(status);
}

export function isHandoffActiveForVisitor(status: ConversationStatus): boolean {
  return conversationRequiresStaffHandling(status);
}

export function visitorStaffJoined(
  status: ConversationStatus,
  assignedTo?: string | null
): boolean {
  return status === "assigned" && Boolean(assignedTo);
}

export function mapMessageToVisitor(row: Message): VisitorChatMessage | null {
  if (row.sender_type === "user") {
    return {
      id: row.id,
      role: "user",
      content: row.content,
      at: row.created_at,
      label: row.sender_name ?? "You",
    };
  }
  if (row.sender_type === "assistant") {
    return {
      id: row.id,
      role: "assistant",
      content: row.content,
      at: row.created_at,
      label: row.sender_name ?? "Assistant",
    };
  }
  if (row.sender_type === "staff") {
    return {
      id: row.id,
      role: "staff",
      content: row.content,
      at: row.created_at,
      label: row.sender_name ?? "Team member",
    };
  }
  if (row.sender_type === "system") {
    return {
      id: row.id,
      role: "system",
      content: row.content,
      at: row.created_at,
    };
  }
  return null;
}

export function mapConversationToVisitorSync(
  conversation: Conversation,
  rows: Message[]
): VisitorChatSyncPayload {
  const messages = rows
    .map(mapMessageToVisitor)
    .filter((m): m is VisitorChatMessage => m !== null)
    .sort((a, b) => a.at.localeCompare(b.at));

  const staffHandling = conversationRequiresStaffHandling(conversation.status);

  return {
    conversationId: conversation.id,
    status: conversation.status,
    staffHandling,
    handoffActive: isHandoffActiveForVisitor(conversation.status),
    staffJoined: visitorStaffJoined(
      conversation.status,
      conversation.assigned_to
    ),
    messages,
  };
}

/** Merge server transcript with optimistic client-only user messages. */
export function mergeVisitorChatMessages(
  local: VisitorChatMessage[],
  server: VisitorChatMessage[]
): VisitorChatMessage[] {
  const serverIds = new Set(server.map((m) => m.id));
  const serverUserBodies = new Set(
    server.filter((m) => m.role === "user").map((m) => m.content.trim())
  );

  const optimistic = local.filter(
    (m) =>
      m.role === "user" &&
      !serverIds.has(m.id) &&
      m.id.startsWith("u_") &&
      !serverUserBodies.has(m.content.trim())
  );

  const merged = [...server, ...optimistic];
  merged.sort((a, b) => a.at.localeCompare(b.at));
  return merged;
}

export const VISITOR_HANDOFF_POLL_MS = 5_000;

export const VISITOR_STAFF_QUEUE_ACK =
  "Your message has been sent to our team. Someone will respond here shortly.";
