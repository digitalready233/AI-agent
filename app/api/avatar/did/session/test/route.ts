import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { canManageAvatarCredentials } from "@/lib/avatar/avatar-permissions";
import { getAvatarIntegration } from "@/lib/avatar/avatar-integrations-data";
import { loadAvatarProviderCredentials } from "@/lib/avatar/avatar-credentials";
import { buildAvatarContext } from "@/lib/avatar/avatar-session-service";
import { createDidClientKey, resolveDidAgentId } from "@/lib/avatar/did-api";
import type { DemoSession } from "@/lib/demo/types";
import type { Agent } from "@/lib/platform/types";

const bodySchema = z.object({
  agent_id: z.string().optional(),
});

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

  const integration = await getAvatarIntegration(ctx.organization.id, "did");
  const credentials = await loadAvatarProviderCredentials(
    ctx.organization.id,
    "did",
    integration ?? undefined
  );

  if (!credentials.apiKey) {
    return Response.json(
      { ok: false, message: "D-ID API key is not configured." },
      { status: 400 }
    );
  }

  const stubSession = {
    id: "did-test",
    organization_id: ctx.organization.id,
    agent_id: "did-test-agent",
    status: "in_progress",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as DemoSession;

  const stubAgent = {
    id: "did-test-agent",
    organization_id: ctx.organization.id,
    name: "Test",
    enabled: true,
    avatar_provider: "did",
    avatar_enabled: true,
    avatar_id: parsed.data.agent_id ?? integration?.default_avatar_id ?? null,
  } as Agent;

  const avatarCtx = await buildAvatarContext(stubSession, stubAgent);

  try {
    const agentId = resolveDidAgentId(avatarCtx);
    const clientKey = await createDidClientKey(avatarCtx);
    return Response.json({
      ok: true,
      message: "D-ID connection OK — agent and client key validated.",
      agent_id: agentId,
      allowed_domains: clientKey.allowed_domains,
      masked_client_key:
        clientKey.client_key.length > 8
          ? `${clientKey.client_key.slice(0, 4)}…${clientKey.client_key.slice(-4)}`
          : "••••",
    });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "D-ID test session failed",
      },
      { status: 502 }
    );
  }
}
