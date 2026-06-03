import { listDemoAssets, saveDemoAsset } from "./demo-data";
import type { DemoAsset } from "./types";

const DEFAULT_ASSETS: Array<{
  title: string;
  asset_type: DemoAsset["asset_type"];
  content: string;
  sort_order: number;
}> = [
  {
    title: "Company Introduction",
    asset_type: "slide",
    sort_order: 1,
    content:
      "Digital Ready Ghana helps businesses grow through digital marketing, branding, web development, and paid advertising. We focus on measurable results and long-term partnerships.",
  },
  {
    title: "Social Media Management Overview",
    asset_type: "service_card",
    sort_order: 2,
    content:
      "Content planning, posting, community engagement, and performance reporting across the platforms that matter for your audience.",
  },
  {
    title: "Website Development Overview",
    asset_type: "product_step",
    sort_order: 3,
    content:
      "Modern, mobile-friendly websites built for speed, SEO, and conversion — from landing pages to full business sites.",
  },
  {
    title: "Digital Advertising Overview",
    asset_type: "product_step",
    sort_order: 4,
    content:
      "Paid campaigns on Google, Meta, and other channels with clear targeting, tracking, and optimization.",
  },
  {
    title: "Branding & Creative Design Overview",
    asset_type: "service_card",
    sort_order: 5,
    content:
      "Visual identity, logos, brand guidelines, and creative assets that keep your business consistent and professional.",
  },
  {
    title: "Why Work With Us",
    asset_type: "case_study",
    sort_order: 6,
    content:
      "Local expertise, transparent communication, and a team focused on helping Ghanaian businesses compete digitally.",
  },
  {
    title: "Recommended Next Step",
    asset_type: "faq",
    sort_order: 7,
    content:
      "Book a consultation to discuss your goals, budget, and timeline. We'll recommend a tailored package.",
  },
];

export async function seedDefaultDemoAssetsForAgent(params: {
  organizationId: string;
  agentId: string;
  knowledgeBaseId?: string | null;
}): Promise<{ created: number; skipped: number }> {
  const existing = await listDemoAssets(params.organizationId, params.agentId);
  const titles = new Set(existing.map((a) => a.title.toLowerCase()));
  let created = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const item of DEFAULT_ASSETS) {
    if (titles.has(item.title.toLowerCase())) {
      skipped++;
      continue;
    }
    await saveDemoAsset({
      id: crypto.randomUUID(),
      organization_id: params.organizationId,
      title: item.title,
      content: item.content,
      asset_type: item.asset_type,
      sort_order: item.sort_order,
      attached_agent_id: params.agentId,
      attached_knowledge_base_id: params.knowledgeBaseId ?? null,
      status: "active",
      metadata: { seeded: "digital_ready_ghana_defaults" },
      created_at: now,
      updated_at: now,
    });
    created++;
  }

  return { created, skipped };
}
