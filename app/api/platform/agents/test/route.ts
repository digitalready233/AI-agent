import { generateText } from "ai";
import { z } from "zod";
import { getChatModel } from "@/lib/agent/llm-model";
import { isLlmConfigured } from "@/lib/agent/llm-env";
import { requireSession } from "@/lib/platform/auth";
import { buildAgentTestSystemPrompt } from "@/lib/platform/agent-test-prompt";
import {
  findOrCreateConversationBySession,
  getAgent,
  getKnowledgeContextForAgent,
  saveMessage,
} from "@/lib/platform/data";
import { can } from "@/lib/platform/rbac";
import type { Message } from "@/lib/platform/types";

const historySchema = z.array(
  z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(8000),
  })
);

const bodySchema = z.object({
  agentId: z.string().min(1),
  message: z.string().min(1).max(4000),
  history: historySchema.optional().default([]),
  saveTestConversation: z.boolean().optional().default(false),
  conversationId: z.string().uuid().optional(),
  sessionId: z.string().min(1).max(128).optional(),
});

export async function POST(req: Request) {
  const session = await requireSession();

  if (!can(session.profile.role, "agents.view")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isLlmConfigured()) {
    return Response.json(
      { error: "LLM not configured. Set OPENAI_API_KEY or GROQ_API_KEY." },
      { status: 503 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { agentId, message, history, saveTestConversation, conversationId, sessionId } =
    parsed.data;

  const agent = await getAgent(agentId);
  if (!agent || agent.organization_id !== session.organization.id) {
    return Response.json({ error: "Agent not found." }, { status: 404 });
  }

  const knowledgeContext = await getKnowledgeContextForAgent(
    agent.id,
    session.organization.id,
    { strict: true }
  );

  const system = buildAgentTestSystemPrompt(agent, knowledgeContext);

  const modelMessages = [
    ...history.slice(-20).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  let reply: string;
  try {
    const { text } = await generateText({
      model: getChatModel(),
      system,
      messages: modelMessages,
      maxTokens: 900,
      temperature: 0.4,
    });
    reply =
      text.trim() ||
      agent.fallback_response?.trim() ||
      "I do not have that information in my knowledge base yet. How else can I help?";
  } catch (err) {
    console.error("[POST /api/platform/agents/test]", err);
    return Response.json({ error: "AI request failed. Check your API key and try again." }, { status: 502 });
  }

  let savedConversationId: string | undefined = conversationId;

  if (saveTestConversation) {
    const testSessionId =
      sessionId?.trim() ||
      `admin_test_${session.organization.id}_${agent.id}`;

    const conversation =
      conversationId
        ? { id: conversationId }
        : await findOrCreateConversationBySession({
            organizationId: session.organization.id,
            agentId: agent.id,
            sessionId: testSessionId,
            channel: "test",
          });

    savedConversationId = conversation.id;

    const now = new Date().toISOString();
    const base = {
      conversation_id: conversation.id,
      metadata: { source: "agent_test_chat" } as Record<string, unknown>,
    };

    await persistTestMessage({
      ...base,
      sender_type: "user",
      sender_name: session.profile.full_name,
      content: message,
      created_at: now,
    });

    await persistTestMessage({
      ...base,
      sender_type: "assistant",
      sender_name: agent.name,
      content: reply,
      created_at: new Date().toISOString(),
    });
  }

  return Response.json({
    reply,
    conversationId: savedConversationId,
    knowledgeEntryCount: knowledgeContext ? knowledgeContext.split("### ").length - 1 : 0,
  });
}

async function persistTestMessage(
  partial: Omit<Message, "id">
): Promise<Message> {
  return saveMessage({
    ...partial,
    id: crypto.randomUUID(),
  });
}
