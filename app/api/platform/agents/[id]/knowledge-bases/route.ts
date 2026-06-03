import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { getAgent, linkAgentKnowledgeBases } from "@/lib/platform/data";
import { can } from "@/lib/platform/rbac";
import { formatAgentApiValidationError } from "@/lib/platform/agent-api-schema";

const bodySchema = z.object({
  knowledge_base_ids: z.array(z.string().uuid()),
});

/** Update which knowledge bases an agent uses (without saving the full agent form). */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!can(session.profile.role, "agents.manage")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const agent = await getAgent(id);
  if (!agent || agent.organization_id !== session.organization.id) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { error: formatAgentApiValidationError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    await linkAgentKnowledgeBases(
      id,
      parsed.data.knowledge_base_ids,
      session.organization.id
    );
    revalidatePath("/dashboard/agents");
    revalidatePath(`/dashboard/agents/${id}`);
    return Response.json({
      agentId: id,
      knowledge_base_ids: parsed.data.knowledge_base_ids,
    });
  } catch (err) {
    console.error("[PUT /api/platform/agents/[id]/knowledge-bases]", err);
    const message =
      err instanceof Error ? err.message : "Could not save knowledge links";
    return Response.json({ error: message }, { status: 500 });
  }
}
