import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import {
  getOrganizationSettings,
  patchOrganizationSettingsSection,
} from "@/lib/platform/settings-data";
import { getDemoProviderSettings } from "@/lib/demo/demo-provider";
import {
  canManageAvatarCredentials,
  canConfigureAgentAvatar,
} from "@/lib/avatar/avatar-permissions";
import {
  ensureAvatarIntegrationRows,
  getAvatarIntegration,
  listAvatarIntegrations,
  saveAvatarIntegration,
} from "@/lib/avatar/avatar-integrations-data";
import {
  getMaskedAvatarApiKey,
  hasAvatarProviderApiKey,
  saveAvatarProviderApiKey,
} from "@/lib/avatar/avatar-credentials";
import {
  AVATAR_PROVIDER_IDS,
  AVATAR_PROVIDER_LABELS,
  DEFAULT_AVATAR_ORG_SETTINGS,
  type AvatarProviderId,
} from "@/lib/avatar/types";

const patchSchema = z.object({
  enable_ai_avatar: z.boolean().optional(),
  default_avatar_provider: z.enum(AVATAR_PROVIDER_IDS as unknown as [string, ...string[]]).optional(),
  provider: z.enum(AVATAR_PROVIDER_IDS as unknown as [string, ...string[]]).optional(),
  status: z.enum(["connected", "not_connected", "needs_attention"]).optional(),
  api_key: z.string().optional(),
  default_avatar_id: z.string().nullable().optional(),
  default_voice_id: z.string().nullable().optional(),
  default_replica_id: z.string().nullable().optional(),
  default_persona_id: z.string().nullable().optional(),
  config: z.record(z.unknown()).optional(),
});

export async function GET() {
  const ctx = await requireSession();
  requirePermission(ctx, "settings.view");
  const orgId = ctx.organization.id;
  const demoSettings = await getDemoProviderSettings(orgId);
  const avatarOrg = {
    ...DEFAULT_AVATAR_ORG_SETTINGS,
    ...demoSettings.avatar,
  };

  await ensureAvatarIntegrationRows(orgId, [
    "tavus",
    "did",
    "heygen",
    "custom_future",
  ]);

  const integrations = await listAvatarIntegrations(orgId);
  const providers = await Promise.all(
    AVATAR_PROVIDER_IDS.map(async (id) => {
      const row = integrations.find((i) => i.provider === id);
      const configured =
        id === "internal_card" ||
        (await hasAvatarProviderApiKey(orgId, id)) ||
        Boolean(row?.api_key_encrypted);
      const masked = id === "internal_card" ? null : await getMaskedAvatarApiKey(orgId, id);
      return {
        id,
        label: AVATAR_PROVIDER_LABELS[id as AvatarProviderId],
        status: row?.status ?? (id === "internal_card" ? "connected" : "not_connected"),
        configured,
        masked_api_key: masked,
        default_avatar_id: row?.default_avatar_id ?? null,
        default_voice_id: row?.default_voice_id ?? null,
        default_replica_id:
          (typeof row?.config?.default_replica_id === "string"
            ? row.config.default_replica_id
            : null) ??
          (id === "tavus" ? row?.default_avatar_id : null) ??
          null,
        default_persona_id:
          typeof row?.config?.default_persona_id === "string"
            ? row.config.default_persona_id
            : null,
        can_manage_credentials: canManageAvatarCredentials(ctx.profile.role),
        config:
          id === "did"
            ? {
                allowed_domains:
                  typeof row?.config?.allowed_domains === "object" &&
                  Array.isArray(row?.config?.allowed_domains)
                    ? (row.config.allowed_domains as string[])
                    : null,
                client_key_masked:
                  typeof row?.config?.client_key_masked === "string"
                    ? row.config.client_key_masked
                    : null,
                client_key_updated_at:
                  typeof row?.config?.client_key_updated_at === "string"
                    ? row.config.client_key_updated_at
                    : null,
              }
            : undefined,
      };
    })
  );

  return Response.json({
    settings: avatarOrg,
    providers,
    can_configure_agents: canConfigureAgentAvatar(ctx.profile.role),
  });
}

export async function PATCH(req: Request) {
  const ctx = await requireSession();
  requirePermission(ctx, "settings.manage");

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const orgId = ctx.organization.id;
  const d = parsed.data;

  if (d.api_key !== undefined && d.provider) {
    if (!canManageAvatarCredentials(ctx.profile.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (d.api_key.trim()) {
      await saveAvatarProviderApiKey(orgId, d.provider, d.api_key);
    }
  }

  if (
    d.provider &&
    (d.default_avatar_id !== undefined ||
      d.default_voice_id !== undefined ||
      d.default_replica_id !== undefined ||
      d.default_persona_id !== undefined ||
      d.status ||
      d.config)
  ) {
    const existing = await getAvatarIntegration(orgId, d.provider);
    const nextConfig = { ...(existing?.config ?? {}), ...(d.config ?? {}) };
    if (d.default_replica_id !== undefined) {
      nextConfig.default_replica_id = d.default_replica_id;
    }
    if (d.default_persona_id !== undefined) {
      nextConfig.default_persona_id = d.default_persona_id;
    }
    await saveAvatarIntegration({
      id: existing?.id ?? crypto.randomUUID(),
      organization_id: orgId,
      provider: d.provider,
      status: d.status ?? existing?.status ?? "not_connected",
      config: nextConfig,
      default_avatar_id:
        d.default_avatar_id ??
        (d.provider === "tavus" && d.default_replica_id !== undefined
          ? d.default_replica_id
          : existing?.default_avatar_id) ??
        null,
      default_voice_id: d.default_voice_id ?? existing?.default_voice_id ?? null,
      api_key_encrypted: existing?.api_key_encrypted ?? null,
    });
  }

  if (d.enable_ai_avatar !== undefined || d.default_avatar_provider !== undefined) {
    const org = await getOrganizationSettings(orgId);
    const demo = org.api_settings.demo_room ?? (await getDemoProviderSettings(orgId));
    const next = {
      ...demo,
      avatar: {
        ...DEFAULT_AVATAR_ORG_SETTINGS,
        ...demo.avatar,
        ...(d.enable_ai_avatar !== undefined
          ? { enable_ai_avatar: d.enable_ai_avatar }
          : {}),
        ...(d.default_avatar_provider !== undefined
          ? { default_avatar_provider: d.default_avatar_provider as AvatarProviderId }
          : {}),
      },
    };
    await patchOrganizationSettingsSection(orgId, "api_settings", {
      ...org.api_settings,
      demo_room: next,
    });
  }

  return GET();
}
