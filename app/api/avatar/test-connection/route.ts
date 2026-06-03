import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { canManageAvatarCredentials } from "@/lib/avatar/avatar-permissions";
import { testAvatarProviderConnection } from "@/lib/avatar/avatar-session-service";
import { AVATAR_PROVIDER_IDS, type AvatarProviderId } from "@/lib/avatar/types";
import { getAvatarIntegration, saveAvatarIntegration } from "@/lib/avatar/avatar-integrations-data";

const bodySchema = z.object({
  provider: z.enum(AVATAR_PROVIDER_IDS as unknown as [string, ...string[]]),
  avatar_id: z.string().optional(),
  avatar_replica_id: z.string().optional(),
  avatar_persona_id: z.string().optional(),
  avatar_voice_id: z.string().optional(),
  test_session: z.boolean().optional(),
});

export async function POST(req: Request) {
  const ctx = await requireSession();
  requirePermission(ctx, "settings.manage");
  if (!canManageAvatarCredentials(ctx.profile.role)) {
    return Response.json(
      { error: "Only platform or company admins can test avatar credentials." },
      { status: 403 }
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const provider = parsed.data.provider as AvatarProviderId;
  if (provider === "internal_card") {
    return Response.json({ ok: true, message: "Internal presenter requires no API key." });
  }

  const result = await testAvatarProviderConnection(ctx.organization.id, provider, {
    avatar_id: parsed.data.avatar_id,
    avatar_replica_id: parsed.data.avatar_replica_id,
    avatar_persona_id: parsed.data.avatar_persona_id,
    avatar_voice_id: parsed.data.avatar_voice_id,
    avatar_enabled: true,
  });

  const existing = await getAvatarIntegration(ctx.organization.id, provider);
  await saveAvatarIntegration({
    id: existing?.id ?? crypto.randomUUID(),
    organization_id: ctx.organization.id,
    provider,
    status: result.ok ? "connected" : "needs_attention",
    config: existing?.config ?? {},
    default_avatar_id: existing?.default_avatar_id,
    default_voice_id: existing?.default_voice_id,
    api_key_encrypted: existing?.api_key_encrypted ?? null,
    last_tested_at: new Date().toISOString(),
  });

  return Response.json(result);
}
