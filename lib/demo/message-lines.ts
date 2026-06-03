import type { DemoMessage } from "./types";

export type DemoChatLine = {
  role: "user" | "assistant" | "system" | "staff";
  content: string;
  senderName?: string;
  createdAt?: string;
};

function toChatLine(m: {
  sender_type: string;
  content: string;
  sender_name?: string | null;
  created_at?: string | null;
}): DemoChatLine {
  const createdAt = m.created_at ?? undefined;
  if (m.sender_type === "staff") {
    return {
      role: "staff",
      content: m.content,
      senderName: m.sender_name ?? undefined,
      createdAt,
    };
  }
  return {
    role:
      m.sender_type === "prospect"
        ? "user"
        : m.sender_type === "system"
          ? "system"
          : "assistant",
    content: m.content,
    senderName: m.sender_type === "agent" ? (m.sender_name ?? undefined) : undefined,
    createdAt,
  };
}

export function demoMessagesToChatLines(messages: DemoMessage[]): DemoChatLine[] {
  return messages.map(toChatLine);
}

export function apiDemoMessagesToChatLines(
  messages: {
    sender_type: string;
    content: string;
    sender_name?: string | null;
    created_at?: string | null;
  }[]
): DemoChatLine[] {
  return messages.map(toChatLine);
}
