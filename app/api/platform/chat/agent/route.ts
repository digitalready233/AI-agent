import { getAgent } from "@/lib/platform/data";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { isSupabaseConfigured } from "@/lib/supabase/env";

function resolveAgentId(requested: string | null): string {
  const fromQuery = requested?.trim();
  if (fromQuery) return fromQuery;
  return (
    process.env.NEXT_PUBLIC_PLATFORM_AGENT_ID?.trim() ||
    process.env.PLATFORM_AGENT_ID?.trim() ||
    ""
  );
}

/** Public agent metadata for customer-facing chat (no auth). */
export async function GET(req: Request) {
  if (!isSupabaseConfigured() || !hasServiceRoleKey()) {
    return Response.json({ error: "Chat is not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const agentId = resolveAgentId(searchParams.get("agentId"));

  if (!agentId) {
    return Response.json({ error: "agentId is required." }, { status: 400 });
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
