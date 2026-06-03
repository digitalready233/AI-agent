import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  getAgent,
  getConversationBySession,
  listMessages,
} from "@/lib/platform/data";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { mapConversationToVisitorSync } from "@/lib/platform/visitor-chat";

export async function GET(req: Request) {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) {
    return Response.json({ messages: [] });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId")?.trim();
  const fromQuery = searchParams.get("agentId")?.trim();
  const agentId =
    fromQuery ||
    process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID?.trim() ||
    process.env.PLATFORM_AGENT_ID?.trim() ||
    "";

  if (!sessionId || !agentId) {
    return Response.json({ messages: [] });
  }

  try {
    const payload = await withPlatformAdmin(async () => {
      const agent = await getAgent(agentId);
      if (!agent) return { messages: [] as { role: string; content: string; at: string }[] };

      const conversation = await getConversationBySession(
        agent.organization_id,
        agent.id,
        sessionId
      );
      if (!conversation) return { messages: [] };

      const rows = await listMessages(conversation.id);
      const sync = mapConversationToVisitorSync(conversation, rows);
      return {
        conversationId: sync.conversationId,
        status: sync.status,
        staffHandling: sync.staffHandling,
        handoffActive: sync.handoffActive,
        staffJoined: sync.staffJoined,
        messages: sync.messages,
        welcomeMessage: agent.welcome_message,
      };
    });

    return Response.json(payload);
  } catch (err) {
    console.error("[GET /api/platform/chat/history]", err);
    return Response.json({ messages: [] });
  }
}
