const OBJECTION_PATTERNS: Array<{ key: string; patterns: string[] }> = [
  { key: "price_concern", patterns: ["expensive", "too much", "cost", "budget tight", "afford", "too pricey"] },
  { key: "timing_concern", patterns: ["not now", "later", "next quarter", "too soon", "busy", "not ready this month"] },
  { key: "trust_concern", patterns: ["trust", "scam", "reliable", "prove", "guarantee", "legit"] },
  {
    key: "competitor_comparison",
    patterns: ["competitor", "another agency", "vs ", "compare", "cheaper elsewhere", "other vendor"],
  },
  {
    key: "needs_approval",
    patterns: ["boss", "partner", "approve", "decision maker", "committee", "my manager", "need approval"],
  },
  {
    key: "custom_package",
    patterns: ["custom", "tailored", "package", "bundle", "specific scope", "custom pricing"],
  },
  {
    key: "unclear_service_need",
    patterns: [
      "not sure what",
      "don't know what i need",
      "unclear",
      "which service",
      "what do you offer",
      "confused about",
    ],
  },
  {
    key: "not_ready_yet",
    patterns: ["not ready", "just researching", "early stage", "maybe later", "still thinking"],
  },
];

export function detectObjectionTags(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const { key, patterns } of OBJECTION_PATTERNS) {
    if (patterns.some((p) => lower.includes(p))) found.add(key);
  }
  return [...found];
}

export function mergeObjectionTags(
  existing: string[] | null | undefined,
  incoming: string[]
): string[] {
  return [...new Set([...(existing ?? []), ...incoming])];
}
