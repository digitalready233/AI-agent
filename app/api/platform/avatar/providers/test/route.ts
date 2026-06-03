import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { canManageAvatarCredentials } from "@/lib/avatar/avatar-permissions";
import { runProviderTest } from "@/lib/avatar/provider-comparison";
import type { AvatarProviderId } from "@/lib/avatar/types";

const bodySchema = z.object({
  provider: z.enum(["internal_card", "tavus", "did", "heygen", "custom_future"]),
  agent_id: z.string().optional(),
  replica_id: z.string().optional(),
  persona_id: z.string().optional(),
});

export async function POST(req: Request) {
  const ctx = await requireSession();
  requirePermission(ctx, "settings.manage");
  if (!canManageAvatarCredentials(ctx.profile.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await runProviderTest(
      ctx.organization.id,
      parsed.data.provider as AvatarProviderId,
      {
        agent_id: parsed.data.agent_id,
        replica_id: parsed.data.replica_id,
        persona_id: parsed.data.persona_id,
      }
    );
    return Response.json({
      ok: result.ok,
      message: result.message,
      response_time_ms: result.response_time_ms,
      provider: parsed.data.provider,
    });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : "Test failed",
        provider: parsed.data.provider,
      },
      { status: 502 }
    );
  }
}
