import { requireSession } from "@/lib/platform/auth";
import {
  runAgentWorkflow,
  workflowInputSchema,
  WorkflowError,
} from "@/lib/platform/workflow";

export async function postRunAgentWorkflow(req: Request) {
  try {
    const { organization } = await requireSession();
    const body = await req.json();

    const withOrg = {
      ...body,
      organizationId: body.organizationId ?? organization.id,
    };

    const parsed = workflowInputSchema.safeParse(withOrg);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.organizationId !== organization.id) {
      return Response.json({ error: "Organization mismatch" }, { status: 403 });
    }

    const result = await runAgentWorkflow(parsed.data);
    return Response.json(result);
  } catch (err) {
    if (err instanceof WorkflowError) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: err.statusCode }
      );
    }
    console.error("[runAgentWorkflow]", err);
    return Response.json({ error: "Internal workflow error" }, { status: 500 });
  }
}
