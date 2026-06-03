import { buildDefaultSlideBrandingForSpec } from "./slide-branding";
import { listDemoPaths, saveDemoPath } from "./demo-paths-data";
import { sequenceTitlesForPathKey } from "./path-asset-specs";
import type { DemoPath } from "./types";

export const DEFAULT_DEMO_PATH_SPECS: Array<{
  path_key: string;
  title: string;
  description: string;
  service_category: string;
  target_industry: string;
  qualification_questions: string[];
  demo_asset_sequence: string[];
  recommended_cta: string;
}> = [
  {
    path_key: "social_media",
    title: "Social Media Management Demo",
    description:
      "Content planning, posting, community management, and performance reporting for growth-focused brands.",
    service_category: "social_media",
    target_industry: "general",
    qualification_questions: [
      "Which platforms matter most for your audience?",
      "What is your monthly budget for social media?",
      "When do you want to start?",
      "Who approves marketing spend?",
    ],
    demo_asset_sequence: sequenceTitlesForPathKey("social_media"),
    recommended_cta: "Book a social media strategy call",
  },
  {
    path_key: "website",
    title: "Website Development Demo",
    description:
      "Modern websites and online stores built for speed, SEO, and conversion.",
    service_category: "website",
    target_industry: "general",
    qualification_questions: [
      "Do you need a new site or a redesign?",
      "Do you need ecommerce or booking features?",
      "What is your budget range?",
      "What is your launch timeline?",
    ],
    demo_asset_sequence: sequenceTitlesForPathKey("website"),
    recommended_cta: "Book a website discovery call",
  },
  {
    path_key: "digital_advertising",
    title: "Digital Advertising Demo",
    description:
      "Paid campaigns on Google, Meta, and other channels with tracking and optimization.",
    service_category: "digital_ads",
    target_industry: "general",
    qualification_questions: [
      "What is your main goal — leads, sales, or awareness?",
      "What monthly ad budget are you considering?",
      "Which channels have you tried before?",
      "When do you want campaigns live?",
    ],
    demo_asset_sequence: sequenceTitlesForPathKey("digital_advertising"),
    recommended_cta: "Book an ads strategy session",
  },
  {
    path_key: "branding",
    title: "Branding & Creative Design Demo",
    description:
      "Visual identity, logos, brand guidelines, and creative assets for consistent marketing.",
    service_category: "branding",
    target_industry: "general",
    qualification_questions: [
      "Are you launching a new brand or refreshing an existing one?",
      "What deliverables do you need first?",
      "What is your budget for branding?",
      "Who signs off on creative?",
    ],
    demo_asset_sequence: sequenceTitlesForPathKey("branding"),
    recommended_cta: "Book a brand discovery call",
  },
  {
    path_key: "full_growth",
    title: "Full Digital Growth Package Demo",
    description:
      "Integrated social, web, ads, and creative for businesses that want one partner for digital growth.",
    service_category: "full_package",
    target_industry: "general",
    qualification_questions: [
      "What are your top 2 business goals this quarter?",
      "What services do you need most urgently?",
      "What is your overall digital marketing budget?",
      "When do you want to start the engagement?",
    ],
    demo_asset_sequence: sequenceTitlesForPathKey("full_growth"),
    recommended_cta: "Book a full growth consultation",
  },
];

export async function seedDefaultDemoPathsForAgent(params: {
  organizationId: string;
  agentId: string;
}): Promise<{ created: number; skipped: number }> {
  const existing = await listDemoPaths(params.organizationId, params.agentId);
  const keys = new Set(
    existing.map((p) => (p.path_key ?? p.title).toLowerCase())
  );
  let created = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const spec of DEFAULT_DEMO_PATH_SPECS) {
    const existingPath = existing.find(
      (p) => (p.path_key ?? "").toLowerCase() === spec.path_key
    );
    if (existingPath) {
      const meta = existingPath.metadata ?? {};
      const sequence = sequenceTitlesForPathKey(spec.path_key);
      const needsUpdate =
        !meta.slide_branding ||
        JSON.stringify(existingPath.demo_asset_sequence) !== JSON.stringify(sequence);
      if (needsUpdate) {
        await saveDemoPath({
          ...existingPath,
          demo_asset_sequence: sequence,
          metadata: {
            ...meta,
            slide_branding:
              meta.slide_branding ?? buildDefaultSlideBrandingForSpec(spec),
          },
        });
        created++;
      } else {
        skipped++;
      }
      continue;
    }
    const row: DemoPath = {
      id: crypto.randomUUID(),
      organization_id: params.organizationId,
      agent_id: params.agentId,
      title: spec.title,
      description: spec.description,
      service_category: spec.service_category,
      target_industry: spec.target_industry,
      qualification_questions: spec.qualification_questions,
      demo_asset_sequence: spec.demo_asset_sequence,
      recommended_cta: spec.recommended_cta,
      path_key: spec.path_key,
      status: "active",
      metadata: {
        seeded: "digital_ready_ghana_paths",
        slide_branding: buildDefaultSlideBrandingForSpec(spec),
      },
      created_at: now,
      updated_at: now,
    };
    await saveDemoPath(row);
    created++;
  }

  return { created, skipped };
}
