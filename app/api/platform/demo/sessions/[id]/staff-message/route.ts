import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getDemoSession } from "@/lib/demo/demo-data";
import { postDemoStaffMessage } from "@/lib/demo/staff-message";

const bodySchema = z.object({
  message: z.string().min(1).max(8000),
  staff_display_name: z.string().max(120).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  requirePermission(session, "conversations.manage");
  const { id: demoSessionId } = await params;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const demo = await getDemoSession(demoSessionId);
  if (!demo || demo.organization_id !== session.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const staffName =
    parsed.data.staff_display_name?.trim() ||
    session.profile.full_name?.trim() ||
    session.email ||
    "Team member";

  const result = await postDemoStaffMessage({
    demoSessionId,
    organizationId: session.organization.id,
    content: parsed.data.message,
    staffName,
    staffUserId: session.userId,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({
    ok: true,
    message: result.message,
    sender_type: "staff",
    sender_name: staffName,
  });
}
