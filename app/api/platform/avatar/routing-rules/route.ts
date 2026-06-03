import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { canConfigureAvatarRouting } from "@/lib/avatar/avatar-permissions";
import {
  listAvatarRoutingRules,
  saveAvatarRoutingRule,
} from "@/lib/avatar/routing-rules-data";
import { AVATAR_PROVIDER_IDS } from "@/lib/avatar/types";

const ruleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  priority: z.number().int().min(0).max(10000).optional(),
  conditions: z.record(z.unknown()).optional(),
  provider: z.enum(AVATAR_PROVIDER_IDS as unknown as [string, ...string[]]),
  fallback_provider: z
    .enum(AVATAR_PROVIDER_IDS as unknown as [string, ...string[]])
    .optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function GET() {
  const ctx = await requireSession();
  requirePermission(ctx, "settings.view");
  const rules = await listAvatarRoutingRules(ctx.organization.id);
  return Response.json({ rules });
}

export async function POST(req: Request) {
  const ctx = await requireSession();
  requirePermission(ctx, "settings.manage");
  if (!canConfigureAvatarRouting(ctx.profile.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = ruleSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const saved = await saveAvatarRoutingRule({
    id: d.id ?? crypto.randomUUID(),
    organization_id: ctx.organization.id,
    name: d.name,
    priority: d.priority ?? 100,
    conditions: (d.conditions ?? {}) as import("@/lib/avatar/types").AvatarRoutingConditions,
    provider: d.provider,
    fallback_provider: d.fallback_provider ?? "internal_card",
    status: d.status ?? "active",
  });

  return Response.json({ rule: saved });
}
