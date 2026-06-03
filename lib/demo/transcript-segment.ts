import {
  appendDemoTranscript,
  listDemoTranscripts,
  rebuildSessionTranscript,
  saveDemoSession,
} from "./demo-data";
import { getDemoSession } from "./demo-data";
import type { DemoTranscriptSegment } from "./types";

export type TranscriptSpeakerType = "prospect" | "agent" | "staff" | "system";
export type TranscriptInputType = "text" | "voice";

export async function saveDemoTranscriptSegment(params: {
  organizationId: string;
  demoSessionId: string;
  speaker: string;
  speakerType: TranscriptSpeakerType;
  content: string;
  inputType?: TranscriptInputType;
  metadata?: Record<string, unknown>;
}): Promise<DemoTranscriptSegment> {
  const existing = await listDemoTranscripts(params.demoSessionId);
  const sequenceNum = existing.length;

  const segment: DemoTranscriptSegment = {
    id: crypto.randomUUID(),
    organization_id: params.organizationId,
    demo_session_id: params.demoSessionId,
    speaker: params.speaker,
    speaker_type: params.speakerType,
    content: params.content,
    input_type: params.inputType ?? "text",
    sequence_num: sequenceNum,
    metadata: params.metadata,
    created_at: new Date().toISOString(),
  };

  try {
    await appendDemoTranscript(segment);
  } catch (err) {
    console.error("[demo-transcript] save failed", {
      demoSessionId: params.demoSessionId,
      err,
    });
    throw err;
  }

  const session = await getDemoSession(params.demoSessionId);
  if (session) {
    const transcript = await rebuildSessionTranscript(params.demoSessionId);
    const viewed = Array.isArray(session.metadata?.assets_viewed)
      ? (session.metadata.assets_viewed as string[])
      : [];
    await saveDemoSession({
      ...session,
      transcript,
      metadata: {
        ...(session.metadata ?? {}),
        last_transcript_at: segment.created_at,
        assets_viewed: viewed,
      },
    });
  }

  return segment;
}

export function mapSenderToSpeakerType(
  senderType: string
): TranscriptSpeakerType {
  if (senderType === "agent") return "agent";
  if (senderType === "staff") return "staff";
  if (senderType === "system") return "system";
  return "prospect";
}
