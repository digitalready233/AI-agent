import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getAgent } from "@/lib/platform/data";
import { getDemoSession } from "@/lib/demo/demo-data";
import { runDemoWorkflow } from "@/lib/demo/run-demo-workflow";
import { WorkflowError } from "@/lib/platform/workflow/types";

const bodySchema = z.object({
  demo_session_id: z.string().uuid(),
  agent_id: z.string().uuid(),
  message: z.string().min(1).max(8000),
  lead_id: z.string().uuid().optional().nullable(),
  current_demo_step: z.string().optional(),
  current_demo_asset_id: z.string().uuid().optional().nullable(),
});

/** Server-side demo workflow (admin / integrations). */
export async function POST(req: Request) {
  const session = await requireSession();
  requirePermission(session, "conversations.manage");

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const demo = await getDemoSession(parsed.data.demo_session_id);
  if (!demo || demo.organization_id !== session.organization.id) {
    return Response.json({ error: "Demo session not found" }, { status: 404 });
  }

  const agent = await getAgent(parsed.data.agent_id);
  if (!agent || agent.organization_id !== session.organization.id) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    const result = await runDemoWorkflow({
      organizationId: session.organization.id,
      demoSessionId: demo.id,
      agentId: agent.id,
      leadId: parsed.data.lead_id ?? demo.lead_id,
      customerMessage: parsed.data.message,
      currentDemoStep: parsed.data.current_demo_step ?? demo.current_demo_stage,
      currentDemoAssetId: parsed.data.current_demo_asset_id,
      channel: "demo_call",
      inputType: "text",
      participantRole: "prospect",
    });

    return Response.json({
      ...result.structured,
      message_id: result.messageId,
      next_demo_asset: result.nextDemoAsset,
      used_fallback: result.usedFallback,
    });
  } catch (err) {
    if (err instanceof WorkflowError) {
      return Response.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error("[platform/demo/workflow]", err);
    return Response.json({ error: "Workflow failed" }, { status: 500 });
  }
}
