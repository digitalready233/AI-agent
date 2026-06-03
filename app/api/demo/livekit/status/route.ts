import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { withDemoPublicApi } from "@/lib/demo/demo-api";
import { getLiveKitRoomStatusPayload } from "@/lib/demo/livekit-service";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("demo_session_id");

  if (!sessionId) {
    return Response.json({ error: "demo_session_id required" }, { status: 400 });
  }

  const platformAuth = req.headers.get("cookie")?.includes("sb-");
  if (platformAuth) {
    try {
      const ctx = await requireSession();
      requirePermission(ctx, "conversations.view");
      const payload = await getLiveKitRoomStatusPayload(sessionId);
      if (!payload) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json(payload);
    } catch {
      /* fall through to public */
    }
  }

  return withDemoPublicApi(async () => {
    const payload = await getLiveKitRoomStatusPayload(sessionId);
    if (!payload) {
      return { status: 404, body: { error: "Not found" } };
    }
    return { status: 200, body: payload };
  });
}
