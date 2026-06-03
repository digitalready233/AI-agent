import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { getConversation, saveConversation } from "@/lib/platform/data";
import { can } from "@/lib/platform/rbac";
import {
  appendVisitorAiResumedMessage,
  shouldNotifyVisitorAiResumed,
} from "@/lib/platform/visitor-handoff-lifecycle";
import type { ConversationStatus } from "@/lib/platform/types";

const patchSchema = z.object({
  status: z
    .enum([
      "new",
      "ai_handling",
      "waiting_customer",
      "human_needed",
      "assigned",
      "booked",
      "follow_up",
      "resolved",
      "closed",
    ])
    .optional(),
  assigned_to: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!can(session.profile.role, "conversations.manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { organization } = session;
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const conversation = await getConversation(id);
  if (!conversation || conversation.organization_id !== organization.id) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  const updated = {
    ...conversation,
    ...parsed.data,
    status: (parsed.data.status ?? conversation.status) as ConversationStatus,
    updated_at: new Date().toISOString(),
  };

  const saved = await saveConversation(updated);

  if (
    parsed.data.status &&
    shouldNotifyVisitorAiResumed(conversation.status, saved.status)
  ) {
    await appendVisitorAiResumedMessage(saved.id);
  }

  return Response.json({ conversation: saved });
}
