import { runDemoClosePipeline } from "./demo-close-pipeline";

/** Ends a demo and runs the full close pipeline (recording → transcript → timeline → summary → CRM → follow-up). */
export async function endDemoSession(params: {
  demoSessionId: string;
  status?: "completed" | "missed" | "cancelled";
}): Promise<{ summary: string; sessionId: string }> {
  const result = await runDemoClosePipeline(params);
  return { summary: result.summary, sessionId: result.sessionId };
}
