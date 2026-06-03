import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { canConfigureAvatarRouting } from "@/lib/avatar/avatar-permissions";
import { buildProviderComparison } from "@/lib/avatar/provider-comparison";
import { getDemoProviderSettings } from "@/lib/demo/demo-provider";
import {
  getOrganizationSettings,
  patchOrganizationSettingsSection,
} from "@/lib/platform/settings-data";
import { DEFAULT_AVATAR_ORG_SETTINGS, type AvatarProviderId } from "@/lib/avatar/types";
import { z } from "zod";

export async function GET() {
  const ctx = await requireSession();
  requirePermission(ctx, "settings.view");
  const data = await buildProviderComparison(ctx.organization.id);
  return Response.json(data);
}

const patchSchema = z.object({
  default_avatar_provider: z
    .enum(["internal_card", "tavus", "did", "heygen", "custom_future"])
    .optional(),
  enable_smart_routing: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const ctx = await requireSession();
  requirePermission(ctx, "settings.manage");
  if (!canConfigureAvatarRouting(ctx.profile.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const org = await getOrganizationSettings(ctx.organization.id);
  const demo = org.api_settings.demo_room ?? (await getDemoProviderSettings(ctx.organization.id));
  const nextAvatar = {
    ...DEFAULT_AVATAR_ORG_SETTINGS,
    ...demo.avatar,
    ...(parsed.data.default_avatar_provider
      ? { default_avatar_provider: parsed.data.default_avatar_provider as AvatarProviderId }
      : {}),
    ...(parsed.data.enable_smart_routing !== undefined
      ? { enable_smart_routing: parsed.data.enable_smart_routing }
      : {}),
  };
  await patchOrganizationSettingsSection(ctx.organization.id, "api_settings", {
    ...org.api_settings,
    demo_room: { ...demo, avatar: nextAvatar },
  });

  const data = await buildProviderComparison(ctx.organization.id);
  return Response.json(data);
}
