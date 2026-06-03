import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import {
  getConversation,
  listMessages,
  saveConversation,
  saveMessage,
} from "@/lib/platform/data";
import { can } from "@/lib/platform/rbac";
import type { Message } from "@/lib/platform/types";

const postSchema = z.object({
  content: z.string().min(1).max(8000),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!can(session.profile.role, "conversations.view")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation || conversation.organization_id !== session.organization.id) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const messages = await listMessages(id);
  return Response.json({
    conversation: {
      id: conversation.id,
      status: conversation.status,
      assigned_to: conversation.assigned_to,
      updated_at: conversation.updated_at,
    },
    messages,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!can(session.profile.role, "conversations.manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const conversation = await getConversation(id);
  if (!conversation || conversation.organization_id !== session.organization.id) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const staffName = session.profile.full_name || "Team member";

  const message: Message = await saveMessage({
    id: crypto.randomUUID(),
    conversation_id: conversation.id,
    sender_type: "staff",
    sender_name: staffName,
    content: parsed.data.content.trim(),
    metadata: { staff_profile_id: session.profile.id },
    created_at: now,
  });

  const nextStatus =
    conversation.status === "resolved" || conversation.status === "closed"
      ? conversation.status
      : conversation.status === "human_needed"
        ? "assigned"
        : conversation.status === "new"
          ? "assigned"
          : conversation.status;

  const updated = await saveConversation({
    ...conversation,
    status: nextStatus,
    assigned_to: conversation.assigned_to ?? session.profile.id,
    updated_at: now,
  });

  return Response.json({ message, conversation: updated });
}
