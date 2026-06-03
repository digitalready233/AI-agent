import { isSupabaseConfigured } from "@/lib/supabase/env";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { loadVisitorChatSync } from "@/lib/platform/visitor-chat-sync";

function resolveAgentId(fromQuery: string | null): string {
  const trimmed = fromQuery?.trim();
  if (trimmed) return trimmed;
  return (
    process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID?.trim() ||
    process.env.PLATFORM_AGENT_ID?.trim() ||
    ""
  );
}

/** Public visitor poll: session + agent must match an existing conversation. */
export async function GET(req: Request) {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) {
    return Response.json({ error: "Chat sync unavailable." }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId")?.trim();
  const agentId = resolveAgentId(searchParams.get("agentId"));

  if (!sessionId || !agentId) {
    return Response.json(
      { error: "sessionId and agentId are required." },
      { status: 400 }
    );
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
    console.error("[GET /api/platform/chat/sync]", err);
    return Response.json({ error: "Sync failed." }, { status: 500 });
  }
}
