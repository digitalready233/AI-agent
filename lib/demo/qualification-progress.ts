import type { DemoQualificationProgress } from "./types";

export type BantExtraction = {
  need?: string | null;
  budget?: string | null;
  authority?: string | null;
  timeline?: string | null;
  service_interest?: string | null;
  business_name?: string | null;
  industry?: string | null;
  main_goal?: string | null;
};

export function computeQualificationProgress(
  extraction: BantExtraction,
  prior?: DemoQualificationProgress | null
): DemoQualificationProgress {
  const need =
    prior?.need ||
    Boolean(
      extraction.service_interest?.trim() ||
        extraction.main_goal?.trim() ||
        extraction.business_name?.trim()
    );
  const budget = prior?.budget || Boolean(extraction.budget?.trim());
  const authority = prior?.authority || Boolean(extraction.authority?.trim());
  const timeline = prior?.timeline || Boolean(extraction.timeline?.trim());

  return { need, budget, authority, timeline };
}

export function qualificationProgressScore(p: DemoQualificationProgress): number {
  return [p.need, p.budget, p.authority, p.timeline].filter(Boolean).length;
}

/** All four BANT dimensions captured with strong signals. */
export function isQualificationStrong(p: DemoQualificationProgress): boolean {
  return p.need && p.budget && p.authority && p.timeline;
}
