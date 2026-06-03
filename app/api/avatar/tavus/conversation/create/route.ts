import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { getDemoSession } from "@/lib/demo/demo-data";
import { canUseAvatarInDemo } from "@/lib/avatar/avatar-permissions";
import { createTavusConversationForDemo } from "@/lib/avatar/tavus-demo";

const bodySchema = z.object({
  demo_session_id: z.string().uuid(),
  conversational_context: z.string().max(4000).optional(),
  custom_greeting: z.string().max(500).optional(),
});

async function handleCreate(
  demoSessionId: string,
  organizationId: string,
  extras?: { conversational_context?: string; custom_greeting?: string }
) {
  const session = await getDemoSession(demoSessionId);
  if (!session || session.organization_id !== organizationId) {
    return Response.json({ error: "Demo session not found" }, { status: 404 });
  }

  try {
    const result = await createTavusConversationForDemo({
      demoSessionId,
      organizationId,
      agentId: session.agent_id,
      conversationalContext: extras?.conversational_context,
      customGreeting: extras?.custom_greeting,
    });
    return Response.json({
      ok: true,
      conversation_id: result.conversation_id,
      conversation_url: result.conversation_url,
      replica_id: result.replica_id,
      persona_id: result.persona_id,
      avatar_status: result.session.avatar_status,
      avatar_provider: result.session.avatar_provider,
      avatar_stream_url: result.session.avatar_stream_url,
      avatar_join_url: result.session.avatar_join_url,
      tavus_conversation_id: result.session.tavus_conversation_id,
      tavus_conversation_url: result.session.tavus_conversation_url,
    });
  } catch (e) {
    const sessionAfter = await getDemoSession(demoSessionId);
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Tavus conversation failed",
        avatar_status: sessionAfter?.avatar_status,
        avatar_error: sessionAfter?.avatar_error,
        fallback: sessionAfter?.avatar_status === "fallback_active",
      },
      { status: 502 }
    );
  }
}

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const demoSessionId = parsed.data.demo_session_id;
  const extras = {
    conversational_context: parsed.data.conversational_context,
    custom_greeting: parsed.data.custom_greeting,
  };

  try {
    const ctx = await requireSession();
    requirePermission(ctx, "conversations.manage");
    if (!canUseAvatarInDemo(ctx.profile.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return handleCreate(demoSessionId, ctx.organization.id, extras);
  } catch {
    if (!hasServiceRoleKey()) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = await getDemoSession(demoSessionId);
    if (!session) {
      return Response.json({ error: "Demo session not found" }, { status: 404 });
    }
    return withPlatformAdmin(() =>
      handleCreate(demoSessionId, session.organization_id, extras)
    );
  }
}
