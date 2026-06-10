import {
  PublicChatGuardError,
  assertPublicChatRateLimit,
  assertVisitorTokenForExistingChat,
  guardResponseHeaders,
  resolveAllowedPublicAgentId,
} from "@/lib/auth/public-chat-guard";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { loadVisitorChatSync } from "@/lib/platform/visitor-chat-sync";

function publicChatErrorResponse(err: PublicChatGuardError): Response {
  return guardResponseHeaders(
    Response.json({ error: err.message }, { status: err.status }),
    err.retryAfterSec
  );
}

/** Public visitor poll: session + agent must match an existing conversation. */
export async function GET(req: Request) {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) {
    return Response.json({ error: "Chat sync unavailable." }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId")?.trim();
  const fromQuery = searchParams.get("agentId")?.trim();

  if (!sessionId) {
    return Response.json(
      { error: "sessionId and agentId are required." },
      { status: 400 }
    );
  }

  let agentId: string;
  try {
    agentId = resolveAllowedPublicAgentId(fromQuery || "");
    assertPublicChatRateLimit(req, sessionId);
    assertVisitorTokenForExistingChat(req, sessionId, agentId, true);
  } catch (err) {
    if (err instanceof PublicChatGuardError) return publicChatErrorResponse(err);
    throw err;
  }

  try {
    const payload = await withPlatformAdmin(() =>
      loadVisitorChatSync({ sessionId, agentId })
    );

    if (!payload) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }

    return Response.json(payload);
  } catch (err) {
    if (err instanceof PublicChatGuardError) return publicChatErrorResponse(err);
    console.error("[GET /api/platform/chat/sync]", err);
    return Response.json({ error: "Sync failed." }, { status: 500 });
  }
}
