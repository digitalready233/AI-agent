import type { Agent } from "@/lib/platform/types";
import type { DemoSession } from "../types";
import { getMultiAgentDemoSettings } from "./settings";
import { syncDemoAgentAssignments } from "./assignments-data";
import { resolveDemoAgentTeam } from "./team-resolution";
import { recordSpecialistEvent } from "./events-data";
import {
  runQualificationAgent,
  runObjectionAgent,
  runBookingAgent,
  runHandoffAgent,
  runCrmSummaryAgent,
  runFollowUpAgent,
} from "./specialist-runner";
import {
  buildInternalTeamBrief,
  mergeSpecialistInsightsIntoAnalysis,
} from "./merge-specialist-insights";
import type { DemoAnalysis } from "../demo-schemas";
import type { DemoAgentRole, MultiAgentTurnInsights } from "./types";

export async function runMultiAgentSpecialistsForTurn(params: {
  organizationId: string;
  demoSessionId: string;
  session: DemoSession;
  primaryAgent: Agent;
  customerMessage: string;
  historyText: string;
  priorObjections: string[];
}): Promise<MultiAgentTurnInsights> {
  const settings = await getMultiAgentDemoSettings(params.organizationId);
  const team = await resolveDemoAgentTeam({
    organizationId: params.organizationId,
    primaryAgentId: params.primaryAgent.id,
    mode: params.session.multi_agent_assignment_mode,
    sessionOverrides: {
      primary_presenter_agent_id: params.session.primary_presenter_agent_id ?? null,
      qualification_agent_id: params.session.qualification_agent_id ?? null,
      objection_agent_id: params.session.objection_agent_id ?? null,
      booking_agent_id: params.session.booking_agent_id ?? null,
      crm_summary_agent_id: params.session.crm_summary_agent_id ?? null,
      handoff_agent_id: params.session.handoff_agent_id ?? null,
      follow_up_agent_id: params.session.follow_up_agent_id ?? null,
    },
  });

  await syncDemoAgentAssignments({
    organizationId: params.organizationId,
    demoSessionId: params.demoSessionId,
    team,
  });

  const { primaryPresenterAgentId: _presenterId, ...roleTeam } = team;

  const insights: MultiAgentTurnInsights = {
    team: roleTeam,
    qualification: null,
    objection: null,
    booking: null,
    handoff: null,
    crmSummary: null,
    followUp: null,
    presenter: null,
    errors: {},
  };

  const saveReasoning = settings.save_internal_reasoning;

  async function safeRun<T>(
    role: DemoAgentRole,
    agentId: string | null,
    eventType: string,
    fn: () => Promise<T>
  ): Promise<T | null> {
    if (!agentId) return null;
    try {
      const output = await fn();
      await recordSpecialistEvent({
        organizationId: params.organizationId,
        demoSessionId: params.demoSessionId,
        agentRole: role,
        agentId,
        eventType,
        input: { message: params.customerMessage.slice(0, 500) },
        output: output as Record<string, unknown>,
        saveReasoning,
        reasoning:
          typeof (output as { reasoning?: string }).reasoning === "string"
            ? (output as { reasoning?: string }).reasoning
            : undefined,
      });
      return output;
    } catch (e) {
      insights.errors[role] = e instanceof Error ? e.message : "Specialist failed";
      console.error(`[multi-agent] ${role} failed`, e);
      return null;
    }
  }

  insights.qualification = await safeRun(
    "qualification_agent",
    team.qualification_agent,
    "qualification_completed",
    () =>
      runQualificationAgent({
        agentId: team.qualification_agent!,
        customerMessage: params.customerMessage,
        history: params.historyText,
        session: params.session,
      })
  );

  insights.objection = await safeRun(
    "objection_agent",
    team.objection_agent,
    "objection_detected",
    () =>
      runObjectionAgent({
        agentId: team.objection_agent!,
        customerMessage: params.customerMessage,
        history: params.historyText,
        priorObjections: params.priorObjections,
      })
  );

  const leadCat =
    insights.qualification?.leadCategory ?? params.session.lead_category ?? "cold";
  const qualSummary = insights.qualification
    ? JSON.stringify(insights.qualification.leadScore)
    : "unknown";

  insights.booking = await safeRun(
    "booking_agent",
    team.booking_agent,
    "booking_recommended",
    () =>
      runBookingAgent({
        agentId: team.booking_agent!,
        customerMessage: params.customerMessage,
        leadCategory: String(leadCat),
        qualificationSummary: qualSummary,
      })
  );

  insights.handoff = await safeRun(
    "handoff_agent",
    team.handoff_agent,
    "handoff_recommended",
    () =>
      runHandoffAgent({
        agentId: team.handoff_agent!,
        customerMessage: params.customerMessage,
        leadCategory: String(leadCat),
        objectionSeverity: insights.objection?.severity,
        aiConfidenceLow: false,
      })
  );

  insights.crmSummary = await safeRun(
    "crm_summary_agent",
    team.crm_summary_agent,
    "crm_summary_updated",
    () =>
      runCrmSummaryAgent({
        agentId: team.crm_summary_agent!,
        customerMessage: params.customerMessage,
        history: params.historyText,
        priorSummary: params.session.summary,
      })
  );

  insights.followUp = await safeRun(
    "follow_up_agent",
    team.follow_up_agent,
    "follow_up_created",
    () =>
      runFollowUpAgent({
        agentId: team.follow_up_agent!,
        session: params.session,
        isDemoEnding: false,
      })
  );

  return insights;
}

export function applyMultiAgentInsightsToTurn(params: {
  analysis: DemoAnalysis;
  insights: MultiAgentTurnInsights;
  priorObjections: string[] | undefined;
}) {
  const merged = mergeSpecialistInsightsIntoAnalysis(
    params.analysis,
    params.insights,
    params.priorObjections
  );
  return {
    ...merged,
    internalBrief: buildInternalTeamBrief(params.insights),
  };
}
