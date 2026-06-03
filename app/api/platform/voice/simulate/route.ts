import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import {
  findOrCreateConversationBySession,
  saveMessage,
} from "@/lib/platform/data";
import { simulateVoiceTurn } from "@/lib/voice/simulate";

const schema = z.object({
  agent_id: z.string().uuid(),
  message: z.string().min(1).max(4000),
  conversation_id: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const session = await requireSession();
  requirePermission(session, "dashboard.view");

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const orgId = session.organization.id;
  const sessionId = `voice_sim_${session.userId}`;

  let conversationId = parsed.data.conversation_id;
  if (!conversationId) {
    const conv = await findOrCreateConversationBySession({
      organizationId: orgId,
      agentId: parsed.data.agent_id,
      sessionId,
      channel: "voice",
    });
    conversationId = conv.id;
  }

  const now = new Date().toISOString();
  await saveMessage({
    id: crypto.randomUUID(),
    conversation_id: conversationId,
    sender_type: "user",
    content: parsed.data.message,
    created_at: now,
  });

  const result = await simulateVoiceTurn({
    organizationId: orgId,
    agentId: parsed.data.agent_id,
    conversationId,
    userMessage: parsed.data.message,
  });

  await saveMessage({
    id: crypto.randomUUID(),
    conversation_id: conversationId,
    sender_type: "assistant",
    content: result.reply,
    created_at: new Date().toISOString(),
  });

  return Response.json({ ...result, conversation_id: conversationId });
}
