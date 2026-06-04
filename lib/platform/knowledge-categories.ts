/** Categories for knowledge_entries — shared by add + edit UI and seeds. */
export const KNOWLEDGE_ENTRY_CATEGORIES = [
  "general",
  "Product Collateral",
  "FAQ",
  "Brand Guidelines",
  "Company Profile",
  "Pricing",
  "Service Pillars",
  "Objection Handling",
  "ReadyBot Playbook",
  "Operations",
  "product",
  "support",
  "policy",
] as const;

export type KnowledgeEntryCategory = (typeof KNOWLEDGE_ENTRY_CATEGORIES)[number];

const LABELS: Record<string, string> = {
  general: "General",
  product: "Product",
  support: "Support",
  policy: "Policy",
  pricing: "Pricing",
  "Product Collateral": "Product collateral",
  FAQ: "FAQ",
  "Brand Guidelines": "Brand guidelines",
};

export function knowledgeEntryCategoryLabel(category: string): string {
  return LABELS[category] ?? category;
}
