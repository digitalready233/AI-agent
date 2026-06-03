import { z } from "zod";
import { headers } from "next/headers";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { createDemoSessionForLead } from "@/lib/demo/create-demo-for-lead";

const bodySchema = z.object({
  agent_id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  requirePermission(session, "conversations.manage");
  const { id: leadId } = await params;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    const siteOrigin = host ? `${proto}://${host}` : undefined;

    const result = await createDemoSessionForLead({
      organizationId: session.organization.id,
      leadId,
      agentId: parsed.data.agent_id,
      title: parsed.data.title,
      siteOrigin,
    });

    return Response.json({
      session: result.session,
      room_url: result.roomUrl,
      share_url: result.absoluteUrl ?? result.roomUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create demo";
    return Response.json({ error: message }, { status: 400 });
  }
}
