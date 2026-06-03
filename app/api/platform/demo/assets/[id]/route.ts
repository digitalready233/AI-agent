import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { deleteDemoAsset, getDemoAsset, saveDemoAsset } from "@/lib/demo/demo-data";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(20000).optional(),
  asset_type: z
    .enum([
      "slide",
      "service_card",
      "product_step",
      "pricing_placeholder",
      "case_study",
      "faq",
    ])
    .optional(),
  sort_order: z.number().int().optional(),
  demo_path_id: z.string().uuid().nullable().optional(),
  attached_agent_id: z.string().uuid().nullable().optional(),
  attached_knowledge_base_id: z.string().uuid().nullable().optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  requirePermission(session, "conversations.manage");
  const { id } = await params;

  const existing = await getDemoAsset(id);
  if (!existing || existing.organization_id !== session.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const saved = await saveDemoAsset({ ...existing, ...parsed.data });
  return Response.json({ asset: saved });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  requirePermission(session, "conversations.manage");
  const { id } = await params;

  const existing = await getDemoAsset(id);
  if (!existing || existing.organization_id !== session.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await deleteDemoAsset(id, session.organization.id);
  return Response.json({ ok: true });
}
