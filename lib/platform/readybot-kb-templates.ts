/**
 * Client-safe ReadyBot KB article metadata (no Node `crypto` / seed logic).
 * Keep in sync with `lib/platform/seed/readybot-knowledge.ts` article titles.
 */

export type ReadybotKbTemplate = {
  title: string;
  category: string;
};

export const READYBOT_KB_TEMPLATES: ReadybotKbTemplate[] = [
  {
    title: "Digital Ready Ltd — Company Profile",
    category: "Company Profile",
  },
  {
    title: "Pricing & Commercial Policy",
    category: "Pricing",
  },
  {
    title: "Pillar 1 — Paid Ads & Lead Generation",
    category: "Service Pillars",
  },
  {
    title: "Pillar 2 — Social Media Management & Branding",
    category: "Service Pillars",
  },
  {
    title: "Pillar 3 — Full-Scale Digital Transformation",
    category: "Service Pillars",
  },
  {
    title: "Objection Handling — Ghana Market",
    category: "Objection Handling",
  },
  {
    title: "When to Escalate to Human",
    category: "Operations",
  },
  {
    title: "Premium Travel — Documentation Requirements",
    category: "FAQ",
  },
  {
    title: "Premium Travel — Insurance & Concierge",
    category: "Product Collateral",
  },
  {
    title: "Brand Guidelines — Sales Agent Voice",
    category: "Brand Guidelines",
  },
];

export const READYBOT_KB_ARTICLE_TITLES = READYBOT_KB_TEMPLATES.map(
  (t) => t.title
);
