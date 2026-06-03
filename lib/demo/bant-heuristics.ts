import type { DemoAnalysis } from "./demo-schemas";
import type { DemoQualificationProgress } from "./types";
import { sumDemoBantScores } from "./demo-lead-scoring";

const BUDGET_RE =
  /\b(?:ghs|ghc|usd|us\$|\$|€|£)\s*[\d,]+(?:\.\d+)?|\b[\d,]+(?:\.\d+)?\s*(?:ghs|ghc|usd|dollars?)(?:\s*(?:per month|\/month|monthly))?/i;

const TIMELINE_RE =
  /\b(this month|next month|asap|as soon as possible|within \d+\s*(?:day|days|week|weeks|month|months)|start(?:ing)?\s+(?:this|next)\s+month|go live|launch\s+(?:this|next)\s+month|right away|immediately)\b/i;

const SOCIAL_RE =
  /\b(social media|instagram|facebook|tiktok|content|posting|reels?|account management)\b/i;

const REAL_ESTATE_RE = /\b(real estate|property|realtor|listings?)\b/i;

function extractBudgetSnippet(message: string): string | null {
  const m = message.match(BUDGET_RE);
  return m?.[0]?.trim() ?? null;
}

function extractTimelineSnippet(message: string): string | null {
  const m = message.match(TIMELINE_RE);
  return m?.[0]?.trim() ?? null;
}

/**
 * Rule-based BANT enrichment so budget/timeline turns reliably qualify leads
 * even when the LLM returns conservative scores.
 */
export function enrichDemoAnalysisFromHeuristics(
  analysis: DemoAnalysis,
  customerMessage: string,
  priorProgress?: DemoQualificationProgress | null
): DemoAnalysis {
  const msg = customerMessage;
  const ext = { ...analysis.lead_extraction };

  const budgetSnippet = extractBudgetSnippet(msg);
  const timelineSnippet = extractTimelineSnippet(msg);

  if (budgetSnippet && !ext.budget?.trim()) ext.budget = budgetSnippet;
  if (timelineSnippet && !ext.timeline?.trim()) ext.timeline = timelineSnippet;

  if (SOCIAL_RE.test(msg) && !ext.service_interest?.trim()) {
    ext.service_interest = "Social media management";
  }
  if (REAL_ESTATE_RE.test(msg) && !ext.industry?.trim()) {
    ext.industry = "Real estate";
  }

  const scores = { ...analysis.lead_scores };
  const floor = (key: "need" | "budget" | "authority" | "timeline", min: number) => {
    scores[key] = Math.max(scores[key] ?? 0, min);
  };

  const hasNeed =
    priorProgress?.need ||
    Boolean(
      ext.service_interest?.trim() ||
        ext.main_goal?.trim() ||
        ext.business_name?.trim() ||
        ext.industry?.trim()
    );

  if (hasNeed) floor("need", 2);
  if (priorProgress?.budget || ext.budget?.trim()) floor("budget", 2);
  if (priorProgress?.timeline || ext.timeline?.trim()) floor("timeline", 2);
  if (priorProgress?.authority || ext.authority?.trim()) floor("authority", 2);

  const strongBuyingSignal =
    Boolean(ext.budget?.trim()) && Boolean(ext.timeline?.trim());

  if (strongBuyingSignal) {
    floor("budget", 3);
    floor("timeline", 3);
    if (hasNeed) floor("need", 3);
  }

  const merged = sumDemoBantScores(scores);

  let stage = analysis.current_demo_stage;
  if (stage === "welcome" && (SOCIAL_RE.test(msg) || hasNeed)) {
    stage = "need_discovery";
  }

  const flags = { ...analysis.flags };
  if (strongBuyingSignal) {
    flags.ready_to_book = flags.ready_to_book || true;
    flags.asks_next_step = flags.asks_next_step || true;
  }

  return {
    ...analysis,
    lead_extraction: ext,
    lead_scores: {
      need: merged.need,
      budget: merged.budget,
      authority: merged.authority,
      timeline: merged.timeline,
    },
    current_demo_stage: stage,
    suggest_booking: analysis.suggest_booking || strongBuyingSignal,
    flags,
  };
}

export function defaultRecommendedNextAction(params: {
  leadCategory: string;
  bookingRecommended: boolean;
  handoffRequired: boolean;
  qualificationProgress: DemoQualificationProgress;
}): string {
  const { leadCategory, bookingRecommended, handoffRequired, qualificationProgress } =
    params;
  const hot = leadCategory === "hot";

  if (hot && handoffRequired) {
    return "Alert human closer and offer consultation booking while the prospect is engaged.";
  }
  if (bookingRecommended) {
    return "Invite the prospect to book a consultation and confirm budget and start date.";
  }
  if (!qualificationProgress.budget) {
    return "Ask about monthly budget range and when they want to launch.";
  }
  if (!qualificationProgress.timeline) {
    return "Confirm decision timeline and preferred start date.";
  }
  if (!qualificationProgress.need) {
    return "Clarify their main goal for social media (leads, brand, listings visibility).";
  }
  return "Continue the presentation and tie features to their real estate goals.";
}
