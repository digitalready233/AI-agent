import type { Channel } from "../config";

export interface ChatMessageRecord {
  role: "user" | "assistant";
  content: string;
  channel: Channel;
  at: string;
}

export interface ChatSessionRecord {
  sessionId: string;
  channel: Channel;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessageRecord[];
}
