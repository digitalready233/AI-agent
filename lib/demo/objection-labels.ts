const LABELS: Record<string, string> = {
  price_concern: "Price concern",
  timing_concern: "Timing concern",
  trust_concern: "Trust concern",
  competitor_comparison: "Comparing competitors",
  needs_approval: "Needs approval",
  custom_package: "Custom package request",
  unclear_service_need: "Unclear service need",
  not_ready_yet: "Not ready yet",
};

export function formatObjectionTag(tag: string): string {
  return LABELS[tag] ?? tag.replace(/_/g, " ");
}
