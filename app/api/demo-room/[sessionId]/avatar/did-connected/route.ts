import { z } from "zod";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";
import { markDidAvatarConnected } from "@/lib/avatar/did-demo";

const bodySchema = z.object({
  stream_id: z.string().optional(),
  chat_id: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  if (!hasServiceRoleKey()) {
    return Response.json({ error: "Demo room not configured." }, { status: 503 });
  }

  const { sessionId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  return withPlatformAdmin(async () => {
    const { getDemoSession } = await import("@/lib/demo/demo-data");
    const session = await getDemoSession(sessionId);
    if (!session) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    try {
      const updated = await markDidAvatarConnected({
        demoSessionId: sessionId,
        organizationId: session.organization_id,
        streamId: parsed.data.stream_id,
        chatId: parsed.data.chat_id,
      });
      return Response.json({
        ok: true,
        avatar_status: updated.avatar_status,
        did_stream_id: updated.did_stream_id,
      });
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : "Failed to mark connected" },
        { status: 500 }
      );
    }
  });
}
