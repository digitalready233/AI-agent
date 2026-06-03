import { ensureChatMemoryHydrated, getChatSession } from "@/lib/chat-memory";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId")?.trim();

  if (!sessionId) {
    return Response.json({ error: "sessionId is required." }, { status: 400 });
  }

  await ensureChatMemoryHydrated();
  const session = getChatSession(sessionId);

  return Response.json({
    sessionId,
    messages: session?.messages ?? [],
    createdAt: session?.createdAt ?? null,
    updatedAt: session?.updatedAt ?? null,
    messageCount: session?.messages.length ?? 0,
  });
}
