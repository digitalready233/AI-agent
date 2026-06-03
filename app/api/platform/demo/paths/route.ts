import { z } from "zod";
import { requireSession } from "@/lib/platform/auth";
import { requirePermission } from "@/lib/platform/rbac";
import { getAgent } from "@/lib/platform/data";
import {
  listDemoPaths,
  saveDemoPath,
} from "@/lib/demo/demo-paths-data";
import { seedDefaultDemoPathsForAgent } from "@/lib/demo/seed-default-paths";
import { seedDefaultPathAssetsForAgent } from "@/lib/demo/seed-default-path-assets";
import type { DemoPath } from "@/lib/demo/types";
import type { SlideBrandingMap } from "@/lib/demo/slide-branding";

const createSchema = z.object({
  agent_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  service_category: z.string().max(80).optional(),
  target_industry: z.string().max(80).optional(),
  qualification_questions: z.array(z.string()).optional(),
  demo_asset_sequence: z.array(z.string()).optional(),
  recommended_cta: z.string().max(300).optional(),
  path_key: z.string().max(64).optional(),
  status: z.enum(["active", "draft", "archived"]).optional(),
  slide_branding: z.record(z.string(), z.object({
    eyebrow: z.string().optional(),
    headline: z.string().optional(),
    subhead: z.string().optional(),
    accent: z.string().optional(),
    badge: z.string().optional(),
  })).optional(),
});

export async function GET(req: Request) {
  const session = await requireSession();
  requirePermission(session, "conversations.view");

  const agentId = new URL(req.url).searchParams.get("agent_id") ?? undefined;
  const status = new URL(req.url).searchParams.get("status") as
    | "active"
    | "draft"
    | "archived"
    | "all"
    | null;

  const paths = await listDemoPaths(
    session.organization.id,
    agentId,
    status ?? "all"
  );

  return Response.json({ paths });
}

export async function POST(req: Request) {
  const session = await requireSession();
  requirePermission(session, "conversations.manage");

  const url = new URL(req.url);
  if (url.searchParams.get("seed") === "defaults") {
    const agentId = url.searchParams.get("agent_id");
    if (!agentId) {
      return Response.json({ error: "agent_id required" }, { status: 400 });
    }
    const agent = await getAgent(agentId);
    if (!agent || agent.organization_id !== session.organization.id) {
      return Response.json({ error: "Agent not found" }, { status: 404 });
    }
    const paths = await seedDefaultDemoPathsForAgent({
      organizationId: session.organization.id,
      agentId: agent.id,
    });
    const assets = await seedDefaultPathAssetsForAgent({
      organizationId: session.organization.id,
      agentId: agent.id,
    });
    return Response.json({ ...paths, pathAssets: assets });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const agent = await getAgent(parsed.data.agent_id);
  if (!agent || agent.organization_id !== session.organization.id) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const slideBranding = parsed.data.slide_branding as SlideBrandingMap | undefined;

  const row: DemoPath = {
    id: crypto.randomUUID(),
    organization_id: session.organization.id,
    agent_id: agent.id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    service_category: parsed.data.service_category ?? null,
    target_industry: parsed.data.target_industry ?? null,
    qualification_questions: parsed.data.qualification_questions ?? [],
    demo_asset_sequence: parsed.data.demo_asset_sequence ?? [],
    recommended_cta: parsed.data.recommended_cta ?? null,
    path_key: parsed.data.path_key ?? null,
    status: parsed.data.status ?? "active",
    metadata: slideBranding ? { slide_branding: slideBranding } : {},
    created_at: now,
    updated_at: now,
  };

  const saved = await saveDemoPath(row);
  return Response.json({ path: saved });
}
