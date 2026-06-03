import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { canConfigureAvatarRouting } from "@/lib/avatar/avatar-permissions";
import { selectAvatarProvider } from "@/lib/avatar/select-avatar-provider";
import { getAgent } from "@/lib/platform/data";

const bodySchema = z.object({
  agent_id: z.string().optional(),
  demo_path_id: z.string().optional(),
  demo_type: z.string().optional(),
  lead_category: z.string().optional(),
  service_interest: z.string().optional(),
});

export async function POST(req: Request) {
  const ctx = await requireSession();
  requirePermission(ctx, "settings.manage");
  if (!canConfigureAvatarRouting(ctx.profile.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const agent = parsed.data.agent_id
    ? await getAgent(parsed.data.agent_id)
    : null;

  const selection = await selectAvatarProvider({
    organizationId: ctx.organization.id,
    agentId: agent?.id,
    demoPathId: parsed.data.demo_path_id,
    demoType: parsed.data.demo_type,
    agent: agent ?? undefined,
  });

  return Response.json({
    ok: true,
    provider: selection.provider,
    fallback_provider: selection.fallbackProvider,
    source: selection.source,
    routing_rule_id: selection.routingRuleId,
    routing_rule_name: selection.routingRuleName,
    reason: selection.reason,
  });
}
