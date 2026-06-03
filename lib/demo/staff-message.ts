import { getDemoSession, saveDemoMessage } from "./demo-data";
import { saveDemoTranscriptSegment } from "./transcript-segment";

export async function postDemoStaffMessage(params: {
  demoSessionId: string;
  organizationId: string;
  content: string;
  staffName: string;
  staffUserId?: string;
}): Promise<
  | { ok: true; message: { id: string; content: string; created_at: string } }
  | { ok: false; status: number; error: string }
> {
  const session = await getDemoSession(params.demoSessionId);
  if (!session || session.organization_id !== params.organizationId) {
    return { ok: false, status: 404, error: "Demo not found" };
  }
  if (session.status === "completed" || session.status === "cancelled") {
    return { ok: false, status: 400, error: "Demo has ended" };
  }

  const text = params.content.trim();
  if (!text) {
    return { ok: false, status: 400, error: "Message is required" };
  }

  const now = new Date().toISOString();
  const message = await saveDemoMessage({
    id: crypto.randomUUID(),
    organization_id: params.organizationId,
    demo_session_id: params.demoSessionId,
    sender_type: "staff",
    sender_name: params.staffName,
    content: text,
    metadata: params.staffUserId ? { staff_user_id: params.staffUserId } : undefined,
    created_at: now,
  });

  try {
    await saveDemoTranscriptSegment({
      organizationId: params.organizationId,
      demoSessionId: params.demoSessionId,
      speaker: params.staffName,
      speakerType: "staff",
      content: text,
      inputType: "text",
      metadata: { staff_user_id: params.staffUserId },
    });
  } catch (err) {
    console.error("[postDemoStaffMessage] transcript failed", err);
  }

  return {
    ok: true,
    message: {
      id: message.id,
      content: message.content,
      created_at: message.created_at,
    },
  };
}
