import type { VisitorChatMessage } from "@/lib/platform/visitor-chat";

export type UiChatMessage = {
  id: string;
  role: "user" | "assistant" | "staff" | "system";
  content: string;
  label?: string;
};

export function visitorToUiMessages(rows: VisitorChatMessage[]): UiChatMessage[] {
  return rows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    label: m.label,
  }));
}
