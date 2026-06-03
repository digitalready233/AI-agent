import { getMessagesForModel } from "./store";

type ChatTurn = {
  role: "user" | "assistant" | "system";
  content: string;
};

/** Prefer the fuller thread when the browser has not hydrated history yet. */
export function resolveChatMessages(
  sessionId: string,
  clientMessages: ChatTurn[]
): ChatTurn[] {
  const server = getMessagesForModel(sessionId);
  const client = clientMessages.filter(
    (m): m is ChatTurn & { role: "user" | "assistant" } =>
      (m.role === "user" || m.role === "assistant") && Boolean(m.content?.trim())
  );

  if (client.length === 0 && server.length > 0) {
    return server;
  }

  if (server.length > client.length) {
    return server;
  }

  return client;
}
