import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getAgent } from "@/lib/platform/data";
import { seedDefaultDemoPathsForAgent } from "@/lib/demo/seed-default-paths";
import { seedDefaultPathAssetsForAgent } from "@/lib/demo/seed-default-path-assets";
import { seedDefaultDemoAssetsForAgent } from "@/lib/demo/seed-default-assets";

const bodySchema = z.object({
  agent_id: z.string().uuid(),
  knowledge_base_id: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const session = await requireSession();
  requirePermission(session, "conversations.manage");

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const agent = await getAgent(parsed.data.agent_id);
  if (!agent || agent.organization_id !== session.organization.id) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  const paths = await seedDefaultDemoPathsForAgent({
    organizationId: session.organization.id,
    agentId: agent.id,
  });
  const pathAssets = await seedDefaultPathAssetsForAgent({
    organizationId: session.organization.id,
    agentId: agent.id,
  });
  const legacy = await seedDefaultDemoAssetsForAgent({
    organizationId: session.organization.id,
    agentId: agent.id,
    knowledgeBaseId: parsed.data.knowledge_base_id,
  });

  return Response.json({ paths, pathAssets, legacy });
}
