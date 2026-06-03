import type { LeadStatus } from "../types";

export interface NbatScores {
  need: 0 | 1 | 2 | 3;
  budget: 0 | 1 | 2 | 3;
  authority: 0 | 1 | 2 | 3;
  timeline: 0 | 1 | 2 | 3;
}

export interface LeadScoreResult {
  total: number;
  status: LeadStatus;
  category: "Cold Lead" | "Warm Lead" | "Hot Lead";
  nextAction: string;
  breakdown: NbatScores;
}

const SCORE_GUIDE = `
Need: 0=no clear need, 1=general interest, 2=clear need, 3=urgent business need
Budget: 0=no budget, 1=unsure, 2=estimated budget, 3=ready to spend
Authority: 0=not decision maker, 1=influencer, 2=shared decision, 3=main decision maker
Timeline: 0=no timeline, 1=future interest, 2=within 30 days, 3=immediate
Total 0-3=Cold, 4-7=Warm, 8-12=Hot
`;

export function scoreLeadFromNbat(scores: NbatScores): LeadScoreResult {
  const total =
    scores.need + scores.budget + scores.authority + scores.timeline;

  let status: LeadStatus;
  let category: LeadScoreResult["category"];
  let nextAction: string;

  if (total === 0) {
    status = "Not Qualified";
    category = "Cold Lead";
    nextAction =
      "Politely close or nurture; no clear need, budget, authority, or timeline.";
    return { total, status, category, nextAction, breakdown: scores };
  }

  if (total <= 3) {
    status = "Cold";
    category = "Cold Lead";
    nextAction =
      "Provide helpful information, nurture politely, offer follow-up in 3–7 days.";
  } else if (total <= 7) {
    status = "Warm";
    category = "Warm Lead";
    nextAction =
      "Educate on the best package, address objections, schedule follow-up within 24 hours.";
  } else {
    status = "Hot";
    category = "Hot Lead";
    nextAction =
      "Push for consultation booking, quote request, or immediate human handoff.";
  }

  return { total, status, category, nextAction, breakdown: scores };
}

export { SCORE_GUIDE };
