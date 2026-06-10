import {
  PublicChatGuardError,
  guardResponseHeaders,
  resolveAllowedPublicAgentId,
} from "@/lib/auth/public-chat-guard";
import { getAgent } from "@/lib/platform/data";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Public agent metadata for customer-facing chat (no auth). */
export async function GET(req: Request) {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) {
    return Response.json({ error: "Chat is not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  let agentId: string;
  try {
    agentId = resolveAllowedPublicAgentId(searchParams.get("agentId") ?? undefined);
  } catch (err) {
    if (err instanceof PublicChatGuardError) {
      return guardResponseHeaders(
        Response.json({ error: err.message }, { status: err.status }),
        err.retryAfterSec
      );
    }
    throw err;
  }

  try {
    const agent = await withPlatformAdmin(() => getAgent(agentId));
    if (!agent || !agent.enabled) {
      return Response.json({ error: "Agent not available." }, { status: 404 });
    }

    return Response.json({
      id: agent.id,
      name: agent.name,
      nickname: agent.nickname,
      companyProductName: agent.company_product_name,
      agentType: agent.agent_type,
      welcomeMessage:
        agent.welcome_message?.trim() ||
        `Hi! I'm ${agent.name}. How can I help you today?`,
      tone: agent.tone,
      language: agent.language,
    });
  } catch (err) {
    console.error("[GET /api/platform/chat/agent]", err);
    return Response.json({ error: "Failed to load agent." }, { status: 500 });
  }
}
