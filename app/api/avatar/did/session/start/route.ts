import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { getDemoSession } from "@/lib/demo/demo-data";
import { canUseAvatarInDemo } from "@/lib/avatar/avatar-permissions";
import { startDidSessionForDemo } from "@/lib/avatar/did-demo";

const bodySchema = z.object({
  demo_session_id: z.string().uuid(),
  use_server_stream: z.boolean().optional(),
});

async function handleStart(
  demoSessionId: string,
  organizationId: string,
  useServerStream?: boolean
) {
  try {
    const result = await startDidSessionForDemo({
      demoSessionId,
      organizationId,
      useServerStream,
    });
    return Response.json({
      ok: true,
      avatar_status: result.session.avatar_status,
      avatar_provider: result.session.avatar_provider,
      avatar_session_id: result.session.avatar_session_id,
      did_agent_id: result.agent_id,
      did_stream_id: result.stream_id,
      did_session_id: result.session.did_session_id,
      client_key: result.client_key,
      mode: result.mode,
      sdk_available: true,
    });
  } catch (e) {
    const after = await getDemoSession(demoSessionId);
    return Response.json(
      {
        error: e instanceof Error ? e.message : "D-ID session failed",
        avatar_status: after?.avatar_status,
        avatar_error: after?.avatar_error,
        fallback: after?.avatar_status === "fallback_active",
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

  const { demo_session_id, use_server_stream } = parsed.data;

  try {
    const ctx = await requireSession();
    requirePermission(ctx, "conversations.manage");
    if (!canUseAvatarInDemo(ctx.profile.role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return handleStart(demo_session_id, ctx.organization.id, use_server_stream);
  } catch {
    if (!hasServiceRoleKey()) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = await getDemoSession(demo_session_id);
    if (!session) {
      return Response.json({ error: "Demo session not found" }, { status: 404 });
    }
    return withPlatformAdmin(() =>
      handleStart(demo_session_id, session.organization_id, use_server_stream)
    );
  }
}
