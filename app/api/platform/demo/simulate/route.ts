import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getAgent } from "@/lib/platform/data";
import { getDemoSession, saveDemoSession } from "@/lib/demo/demo-data";
import { runDemoWorkflow } from "@/lib/demo/run-demo-workflow";
import { WorkflowError } from "@/lib/platform/workflow/types";

const bodySchema = z.object({
  agent_id: z.string().uuid(),
  demo_session_id: z.string().uuid().optional(),
  message: z.string().min(1).max(8000),
  current_demo_step: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await requireSession();
  requirePermission(session, "agents.manage");

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const agent = await getAgent(parsed.data.agent_id);
  if (!agent || agent.organization_id !== session.organization.id) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  let demoSessionId = parsed.data.demo_session_id;
  if (!demoSessionId) {
    const now = new Date().toISOString();
    const created = await saveDemoSession({
      id: crypto.randomUUID(),
      organization_id: session.organization.id,
      agent_id: agent.id,
      lead_id: null,
      conversation_id: null,
      title: "Simulated demo",
      demo_type: "simulate",
      status: "in_progress",
      current_demo_stage: "welcome",
      started_at: now,
      ended_at: null,
      duration_seconds: null,
      summary: null,
      transcript: null,
      detected_intent: null,
      lead_score: null,
      lead_category: null,
      handoff_required: false,
      booking_recommended: false,
      recommended_next_action: null,
      recording_url: null,
      metadata: { simulate: true },
      created_at: now,
      updated_at: now,
    });
    demoSessionId = created.id;
  } else {
    const existing = await getDemoSession(demoSessionId);
    if (!existing || existing.organization_id !== session.organization.id) {
      return Response.json({ error: "Demo session not found" }, { status: 404 });
    }
  }

  try {
    const result = await runDemoWorkflow({
      organizationId: session.organization.id,
      demoSessionId,
      agentId: agent.id,
      leadId: null,
      customerMessage: parsed.data.message,
      currentDemoStep: parsed.data.current_demo_step,
      channel: "demo_call",
      inputType: "text",
      participantRole: "prospect",
    });

    return Response.json({
      demo_session_id: demoSessionId,
      reply: result.aiResponse,
      current_demo_stage: result.currentDemoStage,
      detected_intent: result.detectedIntent,
      lead_score: result.leadScore,
      lead_category: result.leadCategory,
      booking_recommended: result.bookingRecommended,
      handoff_required: result.handoffRequired,
      recommended_next_action: result.recommendedNextAction,
      next_asset_title: result.nextDemoAsset?.title ?? null,
    });
  } catch (err) {
    if (err instanceof WorkflowError) {
      return Response.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[demo/simulate]", err);
    return Response.json({ error: "Simulate failed" }, { status: 500 });
  }
}
