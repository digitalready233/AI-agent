import { isLlmConfigured } from "@/lib/agent/llm-env";
import { generateAgentReply } from "@/lib/agent/run-agent";
import type { AgentRole, Channel } from "@/lib/config";

export const maxDuration = 60;

/** Plain JSON reply for browser voice and other non-SSE clients */
export async function POST(req: Request) {
  if (!isLlmConfigured()) {
    return Response.json(
      {
        error:
          "No LLM configured. Set OPENAI_API_KEY, GROQ_API_KEY, or run Ollama.",
      },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    messages?: { role: "user" | "assistant" | "system"; content: string }[];
    sessionId?: string;
    channel?: Channel;
    role?: AgentRole;
  } | null;

  if (!body?.messages || !Array.isArray(body.messages)) {
    return Response.json({ error: "Body must include messages array." }, { status: 400 });
  }

  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.length > 0
      ? body.sessionId
      : `voice_web_${Date.now()}`;
  const channel = body.channel ?? "voice";
  const role = body.role ?? "unified";

  const text = await generateAgentReply({
    messages: body.messages,
    sessionId,
    channel,
    role,
  });

  return Response.json({ text });
}
