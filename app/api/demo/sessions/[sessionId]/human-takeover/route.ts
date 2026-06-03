import { z } from "zod";
import { getSessionContext } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getDemoSession } from "@/lib/demo/demo-data";
import { handleDemoHumanTakeover } from "@/lib/demo/session-handlers";
import { hasServiceRoleKey, withPlatformAdmin } from "@/lib/platform/db";

const bodySchema = z.object({
  notes: z.string().max(500).optional(),
  as_staff: z.boolean().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const platformSession = await getSessionContext();
  if (platformSession && parsed.data.as_staff !== false) {
    requirePermission(platformSession, "conversations.manage");
    const demo = await getDemoSession(sessionId);
    if (!demo || demo.organization_id !== platformSession.organization.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    const result = await handleDemoHumanTakeover(sessionId, {
      requestedBy: "staff",
      staffUserId: platformSession.userId,
      notes: parsed.data.notes,
    });
    return Response.json(result.body, { status: result.status });
  }

  if (!hasServiceRoleKey()) {
    return Response.json({ error: "Demo API not configured." }, { status: 503 });
  }
  return withPlatformAdmin(async () => {
    const result = await handleDemoHumanTakeover(sessionId, {
      requestedBy: "prospect",
      notes: parsed.data.notes,
    });
    return Response.json(result.body, { status: result.status });
  });
}
