import { isLlmConfigured } from "@/lib/agent/llm-env";
import { streamAgentResponse } from "@/lib/agent/run-agent";
import type { AgentRole, Channel } from "@/lib/config";
import { ensureChatMemoryHydrated } from "@/lib/chat-memory";
import { ensureLeadsHydrated } from "@/lib/store";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isLlmConfigured()) {
    return new Response(
      JSON.stringify({
        error:
          "No LLM configured. Set OPENAI_API_KEY, or GROQ_API_KEY / AI_PROVIDER, or run Ollama.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  await Promise.all([ensureLeadsHydrated(), ensureChatMemoryHydrated()]);

  const body = await req.json();
  const messages = body.messages ?? [];
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.length > 0
      ? body.sessionId
      : `sess_${Date.now()}`;
  const channel = (body.channel as Channel) ?? "website";
  const role = (body.role as AgentRole) ?? "unified";

  return await streamAgentResponse({
    messages,
    sessionId,
    channel,
    role,
  });
}
