import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { canManageAvatarCredentials } from "@/lib/avatar/avatar-permissions";
import { getAvatarIntegration } from "@/lib/avatar/avatar-integrations-data";
import { loadAvatarProviderCredentials } from "@/lib/avatar/avatar-credentials";
import { createTavusConversation, endTavusConversation } from "@/lib/avatar/tavus-cvi";
import type { AvatarSessionContext } from "@/lib/avatar/types";

const bodySchema = z.object({
  replica_id: z.string().optional(),
  persona_id: z.string().optional(),
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

  const integration = await getAvatarIntegration(ctx.organization.id, "tavus");
  const credentials = await loadAvatarProviderCredentials(
    ctx.organization.id,
    "tavus",
    integration ?? undefined
  );

  const avatarCtx: AvatarSessionContext = {
    organizationId: ctx.organization.id,
    demoSessionId: "test",
    agent: {
      id: "test",
      name: "Test",
      avatar_provider: "tavus",
      avatar_enabled: true,
      avatar_replica_id: parsed.data.replica_id ?? null,
      avatar_persona_id: parsed.data.persona_id ?? null,
    },
    integration,
    credentials,
    config: integration?.config ?? {},
  };

  try {
    const created = await createTavusConversation({
      ctx: avatarCtx,
      conversationName: `test-${ctx.organization.id.slice(0, 8)}`,
      properties: { test: true },
    });
    try {
      await endTavusConversation(avatarCtx, created.conversationId);
    } catch {
      /* best effort */
    }
    return Response.json({
      ok: true,
      message: "Test Tavus conversation created successfully.",
      conversation_id: created.conversationId,
      conversation_url: created.conversationUrl,
    });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Test conversation failed",
      },
      { status: 502 }
    );
  }
}
