import {
  PublicChatGuardError,
  assertPublicChatRateLimit,
  assertVisitorTokenForExistingChat,
  guardResponseHeaders,
  resolveAllowedPublicAgentId,
} from "@/lib/auth/public-chat-guard";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  getAgent,
  getConversationBySession,
  listMessages,
} from "@/lib/platform/data";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { mapConversationToVisitorSync } from "@/lib/platform/visitor-chat";

function publicChatErrorResponse(err: PublicChatGuardError): Response {
  return guardResponseHeaders(
    Response.json({ error: err.message }, { status: err.status }),
    err.retryAfterSec
  );
}

export async function GET(req: Request) {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) {
    return Response.json({ messages: [] });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId")?.trim();
  const fromQuery = searchParams.get("agentId")?.trim();

  if (!sessionId) {
    return Response.json({ messages: [] });
  }

  let agentId: string;
  try {
    agentId = resolveAllowedPublicAgentId(fromQuery || "");
    assertPublicChatRateLimit(req, sessionId);
  } catch (err) {
    if (err instanceof PublicChatGuardError) return publicChatErrorResponse(err);
    throw err;
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

      assertVisitorTokenForExistingChat(req, sessionId, agentId, true);

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
    if (err instanceof PublicChatGuardError) return publicChatErrorResponse(err);
    console.error("[GET /api/platform/chat/history]", err);
    return Response.json({ messages: [] });
  }
}
