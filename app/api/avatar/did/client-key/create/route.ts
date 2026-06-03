import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { canManageAvatarCredentials } from "@/lib/avatar/avatar-permissions";
import { getAvatarIntegration, saveAvatarIntegration } from "@/lib/avatar/avatar-integrations-data";
import { buildAvatarContext } from "@/lib/avatar/avatar-session-service";
import { createDidClientKey, resolveDidAllowedDomains } from "@/lib/avatar/did-api";
import { avatarSecretKey } from "@/lib/avatar/avatar-credentials";
import {
  getOrganizationSecret,
  getMaskedOrganizationSecret,
  setOrganizationSecret,
} from "@/lib/platform/settings-data";

const bodySchema = z.object({
  allowed_domains: z.array(z.string()).optional(),
  regenerate: z.boolean().optional(),
});

function maskKey(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export async function POST(req: Request) {
  const ctx = await requireSession();
  requirePermission(ctx, "settings.manage");
  if (!canManageAvatarCredentials(ctx.profile.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const avatarCtx = await buildAvatarContext(
    {
      id: "client-key",
      organization_id: ctx.organization.id,
      agent_id: null,
      status: "in_progress",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as import("@/lib/demo/types").DemoSession,
    {
      id: "system",
      organization_id: ctx.organization.id,
      name: "System",
      enabled: true,
      avatar_provider: "did",
      avatar_enabled: true,
    } as import("@/lib/platform/types").Agent
  );

  const secretKey = avatarSecretKey("did", "client_key");
  if (!parsed.data.regenerate) {
    const existing = await getOrganizationSecret(ctx.organization.id, secretKey);
    if (existing?.trim()) {
      const masked = await getMaskedOrganizationSecret(ctx.organization.id, secretKey);
      return Response.json({
        ok: true,
        message: "Client key already configured.",
        masked_client_key: masked ?? maskKey(existing),
        allowed_domains: resolveDidAllowedDomains(parsed.data.allowed_domains),
        regenerated: false,
      });
    }
  }

  try {
    const created = await createDidClientKey(avatarCtx, parsed.data.allowed_domains);
    await setOrganizationSecret(ctx.organization.id, secretKey, created.client_key);

    const integration = await getAvatarIntegration(ctx.organization.id, "did");
    await saveAvatarIntegration({
      id: integration?.id ?? crypto.randomUUID(),
      organization_id: ctx.organization.id,
      provider: "did",
      status: "connected",
      config: {
        ...(integration?.config ?? {}),
        allowed_domains: created.allowed_domains,
        client_key_masked: maskKey(created.client_key),
        client_key_updated_at: new Date().toISOString(),
      },
      default_avatar_id: integration?.default_avatar_id ?? null,
      default_voice_id: integration?.default_voice_id ?? null,
      api_key_encrypted: integration?.api_key_encrypted ?? null,
    });

    return Response.json({
      ok: true,
      message: "D-ID client key created.",
      masked_client_key: maskKey(created.client_key),
      allowed_domains: created.allowed_domains,
      regenerated: true,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Failed to create client key" },
      { status: 502 }
    );
  }
}
