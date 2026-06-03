import { z } from "zod";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { getDemoSession } from "@/lib/demo/demo-data";
import { switchDemoAvatarProvider } from "@/lib/avatar/smart-fallback";
import type { AvatarProviderId } from "@/lib/avatar/types";
import { AVATAR_PROVIDER_IDS } from "@/lib/avatar/types";

const bodySchema = z.object({
  provider: z.enum(AVATAR_PROVIDER_IDS as unknown as [string, ...string[]]),
  switched_by: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (!hasServiceRoleKey()) {
    return Response.json({ error: "Demo room not configured." }, { status: 503 });
  }

  const { sessionId } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return withPlatformAdmin(async () => {
    const session = await getDemoSession(sessionId);
    if (!session) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    try {
      const updated = await switchDemoAvatarProvider({
        demoSessionId: sessionId,
        organizationId: session.organization_id,
        targetProvider: parsed.data.provider as AvatarProviderId,
        switchedBy: parsed.data.switched_by,
      });
      return Response.json({
        ok: true,
        avatar_provider: updated.avatar_provider,
        avatar_status: updated.avatar_status,
        avatar_error: updated.avatar_error,
      });
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "Provider switch failed" },
        { status: 502 }
      );
    }
  });
}
