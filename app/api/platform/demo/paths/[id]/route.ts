import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getDemoPath, saveDemoPath } from "@/lib/demo/demo-paths-data";
import type { SlideBrandingMap } from "@/lib/demo/slide-branding";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  service_category: z.string().max(80).nullable().optional(),
  target_industry: z.string().max(80).nullable().optional(),
  qualification_questions: z.array(z.string()).optional(),
  demo_asset_sequence: z.array(z.string()).optional(),
  recommended_cta: z.string().max(300).nullable().optional(),
  path_key: z.string().max(64).nullable().optional(),
  status: z.enum(["active", "draft", "archived"]).optional(),
  slide_branding: z
    .record(
      z.string(),
      z.object({
        eyebrow: z.string().optional(),
        headline: z.string().optional(),
        subhead: z.string().optional(),
        accent: z.string().optional(),
        badge: z.string().optional(),
      })
    )
    .optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  requirePermission(session, "conversations.view");
  const { id } = await params;
  const path = await getDemoPath(id);
  if (!path || path.organization_id !== session.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ path });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  requirePermission(session, "conversations.manage");
  const { id } = await params;

  const existing = await getDemoPath(id);
  if (!existing || existing.organization_id !== session.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const slideBranding = parsed.data.slide_branding as SlideBrandingMap | undefined;
  const metadata = { ...(existing.metadata ?? {}) };
  if (slideBranding !== undefined) {
    metadata.slide_branding = slideBranding;
  }

  const updated = await saveDemoPath({
    ...existing,
    ...parsed.data,
    qualification_questions:
      parsed.data.qualification_questions ?? existing.qualification_questions,
    demo_asset_sequence:
      parsed.data.demo_asset_sequence ?? existing.demo_asset_sequence,
    metadata,
    updated_at: new Date().toISOString(),
  });

  return Response.json({ path: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  requirePermission(session, "conversations.manage");
  const { id } = await params;

  const existing = await getDemoPath(id);
  if (!existing || existing.organization_id !== session.organization.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await saveDemoPath({
    ...existing,
    status: "archived",
    updated_at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
