import type { LeadCategory } from "@/lib/platform/types";
import type { DemoAnalysis } from "../demo-schemas";
import { resolveDemoLeadCategory, sumDemoBantScores } from "../demo-lead-scoring";
import { computeQualificationProgress } from "../qualification-progress";
import { mergeObjectionTags } from "../objection-tracker";
import type { MultiAgentTurnInsights } from "./types";

export function mergeSpecialistInsightsIntoAnalysis(
  analysis: DemoAnalysis,
  insights: MultiAgentTurnInsights,
  priorObjections: string[] | undefined
): {
  analysis: DemoAnalysis;
  leadCategory: LeadCategory;
  bookingRecommended: boolean;
  handoffRequired: boolean;
  objectionTags: string[];
  crmSummaryUpdate: string;
  followUpRecommendation: string;
} {
  const q = insights.qualification;
  const o = insights.objection;
  const b = insights.booking;
  const h = insights.handoff;

  if (q?.leadUpdates) {
    analysis.lead_extraction = {
      ...analysis.lead_extraction,
      full_name: q.leadUpdates.full_name ?? analysis.lead_extraction.full_name,
      phone: q.leadUpdates.phone ?? analysis.lead_extraction.phone,
      email: q.leadUpdates.email ?? analysis.lead_extraction.email,
      business_name:
        q.leadUpdates.business_name ?? analysis.lead_extraction.business_name,
      industry: q.leadUpdates.industry ?? analysis.lead_extraction.industry,
      service_interest:
        q.leadUpdates.service_interest ?? analysis.lead_extraction.service_interest,
      main_goal: q.leadUpdates.main_goal ?? analysis.lead_extraction.main_goal,
      budget: q.leadUpdates.budget ?? analysis.lead_extraction.budget,
      timeline: q.leadUpdates.timeline ?? analysis.lead_extraction.timeline,
      authority: q.leadUpdates.authority ?? analysis.lead_extraction.authority,
    };
  }

  if (q?.leadScore) {
    analysis.lead_scores = {
      need: q.leadScore.need,
      budget: q.leadScore.budget,
      authority: q.leadScore.authority,
      timeline: q.leadScore.timeline,
    };
  }

  const qualProgress = q?.qualificationProgress
    ? q.qualificationProgress
    : computeQualificationProgress(
        analysis.lead_extraction,
        undefined
      );

  const objectionTags = mergeObjectionTags(priorObjections, [
    ...(o?.objections ?? []),
    ...(analysis.detected_objection_tags ?? []),
  ]);

  if (o?.objectionType && !objectionTags.includes(o.objectionType)) {
    objectionTags.push(o.objectionType);
  }

  if (o?.severity === "high" || o?.humanCloserNeeded) {
    analysis.flags.serious_objection = true;
  }

  const scores = sumDemoBantScores(analysis.lead_scores);
  let leadCategory = resolveDemoLeadCategory(scores.total, analysis);
  if (q?.leadCategory && typeof q.leadCategory === "string") {
    const lc = q.leadCategory.toLowerCase();
    if (["hot", "warm", "cold"].includes(lc)) {
      leadCategory = lc as LeadCategory;
    }
  }

  const bookingRecommended =
    b?.bookingRecommended ?? analysis.suggest_booking ?? false;
  analysis.suggest_booking = bookingRecommended;

  const handoffRequired =
    h?.handoffRequired ??
    analysis.handoff_required ??
    analysis.flags.human_requested ??
    false;
  analysis.handoff_required = handoffRequired;
  if (h?.handoffReason) {
    analysis.flags.human_requested = handoffRequired;
  }

  if (insights.crmSummary?.crmSummaryUpdate) {
    analysis.conversation_summary =
      insights.crmSummary.conversationSummary ??
      insights.crmSummary.crmSummaryUpdate;
    analysis.recommended_next_action =
      insights.crmSummary.nextAction ?? analysis.recommended_next_action;
  }

  if (insights.presenter?.demoStage) {
    analysis.current_demo_stage = insights.presenter.demoStage as DemoAnalysis["current_demo_stage"];
  }
  if (insights.presenter?.recommendedNextAction) {
    analysis.recommended_next_action = insights.presenter.recommendedNextAction;
  }

  const crmSummaryUpdate =
    insights.crmSummary?.crmSummaryUpdate ?? analysis.conversation_summary ?? "";
  const followUpRecommendation =
    insights.followUp?.followUpRecommendation ??
    insights.crmSummary?.nextAction ??
    analysis.recommended_next_action;

  return {
    analysis,
    leadCategory,
    bookingRecommended,
    handoffRequired,
    objectionTags,
    crmSummaryUpdate,
    followUpRecommendation,
  };
}

export function buildInternalTeamBrief(insights: MultiAgentTurnInsights): string {
  const parts: string[] = [];
  if (insights.qualification) {
    parts.push(
      `Qualification: BANT ${JSON.stringify(insights.qualification.leadScore)}, category ${insights.qualification.leadCategory}.`
    );
  }
  if (insights.objection?.objections?.length) {
    parts.push(
      `Objections: ${insights.objection.objections.join(", ")} (${insights.objection.objectionType ?? "general"}, severity ${insights.objection.severity ?? "medium"}). Suggested angle: ${insights.objection.suggestedResponse ?? "address with value"}.`
    );
  }
  if (insights.booking?.bookingRecommended) {
    parts.push(
      `Booking: recommend ${insights.booking.meetingType ?? "consultation"} (${insights.booking.urgency ?? "medium"} urgency).`
    );
  }
  if (insights.handoff?.handoffRequired) {
    parts.push(
      `Handoff: ${insights.handoff.handoffReason ?? "human closer needed"} — ${insights.handoff.recommendedStaffRole ?? "sales"}.`
    );
  }
  return parts.join("\n");
}
