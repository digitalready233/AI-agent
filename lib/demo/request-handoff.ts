import { triggerDemoHandoff } from "./demo-live-handoff";

export async function requestDemoHumanHandoff(params: {
  demoSessionId: string;
  requestedBy?: "prospect" | "staff";
  notes?: string;
  reason?: string;
}): Promise<{ sessionId: string; handoff_required: boolean }> {
  const updated = await triggerDemoHandoff({
    demoSessionId: params.demoSessionId,
    requestedBy: params.requestedBy ?? "prospect",
    notes: params.notes,
    reason: params.reason ?? undefined,
  });
  return { sessionId: updated.id, handoff_required: true };
}
