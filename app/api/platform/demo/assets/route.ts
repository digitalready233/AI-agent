import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { listDemoAssets, saveDemoAsset } from "@/lib/demo/demo-data";
import type { DemoAsset } from "@/lib/demo/types";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(20000),
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

export async function GET(req: Request) {
  const session = await requireSession();
  requirePermission(session, "conversations.view");
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agent_id") ?? undefined;
  const demoPathId = url.searchParams.get("demo_path_id") ?? undefined;
  const assets = await listDemoAssets(session.organization.id, agentId, {
    includeAllStatuses: true,
    demoPathId: demoPathId ?? undefined,
  });
  return Response.json({ assets });
}

export async function POST(req: Request) {
  const session = await requireSession();
  requirePermission(session, "conversations.manage");

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const now = new Date().toISOString();
  const asset: DemoAsset = {
    id: crypto.randomUUID(),
    organization_id: session.organization.id,
    title: parsed.data.title,
    content: parsed.data.content,
    asset_type: parsed.data.asset_type ?? "slide",
    sort_order: parsed.data.sort_order ?? 0,
    demo_path_id: parsed.data.demo_path_id ?? null,
    attached_agent_id: parsed.data.attached_agent_id ?? null,
    attached_knowledge_base_id: parsed.data.attached_knowledge_base_id ?? null,
    status: parsed.data.status ?? "active",
    created_at: now,
    updated_at: now,
  };

  const saved = await saveDemoAsset(asset);
  return Response.json({ asset: saved });
}
