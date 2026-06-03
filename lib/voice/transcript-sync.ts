import { listMessages } from "@/lib/platform/data";
import { appendCallTranscript, listCallTranscripts } from "./call-data";

/** Mirror conversation messages into call_transcripts (gather / workflow path). */
export async function syncConversationToCallTranscripts(params: {
  organizationId: string;
  callId: string;
  conversationId: string;
}): Promise<void> {
  const existing = await listCallTranscripts(params.callId);
  const startSeq = existing.length;

  const messages = await listMessages(params.conversationId);
  let seq = startSeq;
  for (const m of messages) {
    const speaker =
      m.sender_type === "user"
        ? ("caller" as const)
        : m.sender_type === "assistant"
          ? ("agent" as const)
          : ("system" as const);
    if (!m.content?.trim()) continue;
    const dup = existing.some(
      (e) => e.speaker === speaker && e.content === m.content
    );
    if (dup) continue;
    await appendCallTranscript({
      organizationId: params.organizationId,
      callId: params.callId,
      speaker,
      content: m.content.trim(),
      sequenceNum: seq++,
    });
  }
}
