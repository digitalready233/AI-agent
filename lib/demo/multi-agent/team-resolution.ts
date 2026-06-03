import { listAgents, getAgent } from "@/lib/platform/data";
import type { Agent } from "@/lib/platform/types";
import type { DemoSession } from "../types";
import { getMultiAgentDemoSettings } from "./settings";
import {
  DEMO_AGENT_ROLES,
  OPERATIONAL_ROLE_TO_DEMO_ROLE,
  type AgentOperationalRole,
  type DemoAgentRole,
  type MultiAgentAssignmentMode,
} from "./types";

export type ResolvedDemoTeam = Record<DemoAgentRole, string | null> & {
  primaryPresenterAgentId: string;
};

function agentForOperationalRole(
  agents: Agent[],
  role: AgentOperationalRole
): Agent | null {
  return (
    agents.find(
      (a) =>
        a.enabled &&
        (a.operational_role as string | undefined) === role
    ) ?? null
  );
}

export async function resolveDemoAgentTeam(params: {
  organizationId: string;
  primaryAgentId: string;
  mode?: MultiAgentAssignmentMode | string | null;
  sessionOverrides?: Partial<{
    primary_presenter_agent_id: string | null;
    qualification_agent_id: string | null;
    objection_agent_id: string | null;
    booking_agent_id: string | null;
    crm_summary_agent_id: string | null;
    handoff_agent_id: string | null;
    follow_up_agent_id: string | null;
  }>;
}): Promise<ResolvedDemoTeam> {
  const settings = await getMultiAgentDemoSettings(params.organizationId);
  const mode = (params.mode ?? "org_default_team") as MultiAgentAssignmentMode;
  const agents = await listAgents(params.organizationId);
  const primary = await getAgent(params.primaryAgentId);
  if (!primary?.enabled) {
    throw new Error("Primary agent not found");
  }

  const team = {} as Record<DemoAgentRole, string | null>;
  for (const role of DEMO_AGENT_ROLES) {
    team[role] = null;
  }

  const pick = (demoRole: DemoAgentRole, operational: AgentOperationalRole): string => {
    const overrideKey = {
      presenter_agent: "primary_presenter_agent_id",
      qualification_agent: "qualification_agent_id",
      objection_agent: "objection_agent_id",
      booking_agent: "booking_agent_id",
      crm_summary_agent: "crm_summary_agent_id",
      handoff_agent: "handoff_agent_id",
      follow_up_agent: "follow_up_agent_id",
    }[demoRole] as keyof NonNullable<typeof params.sessionOverrides>;

    const override = params.sessionOverrides?.[overrideKey];
    if (override) return override;

    if (mode === "same_agent") return params.primaryAgentId;

    const fromSettings = settings.default_team[demoRole];
    if (fromSettings) return fromSettings;

    if (mode === "smart_assignment" || mode === "org_default_team") {
      const specialist = agentForOperationalRole(agents, operational);
      if (specialist) return specialist.id;
    }

    if (demoRole === "presenter_agent") {
      const presenter =
        agentForOperationalRole(agents, "demo_presenter") ?? primary;
      return presenter.id;
    }

    return params.primaryAgentId;
  };

  team.presenter_agent = pick("presenter_agent", "demo_presenter");
  team.qualification_agent = pick("qualification_agent", "lead_qualification");
  team.objection_agent = pick("objection_agent", "objection_handling");
  team.booking_agent = pick("booking_agent", "booking");
  team.crm_summary_agent = pick("crm_summary_agent", "crm_summary");
  team.handoff_agent = pick("handoff_agent", "handoff");
  team.follow_up_agent = pick("follow_up_agent", "follow_up");

  return {
    ...team,
    primaryPresenterAgentId: team.presenter_agent ?? params.primaryAgentId,
  };
}

export function sessionTeamOverrides(session: DemoSession): Partial<{
  primary_presenter_agent_id: string | null;
  qualification_agent_id: string | null;
  objection_agent_id: string | null;
  booking_agent_id: string | null;
  crm_summary_agent_id: string | null;
  handoff_agent_id: string | null;
  follow_up_agent_id: string | null;
}> {
  return {
    primary_presenter_agent_id: session.primary_presenter_agent_id ?? null,
    qualification_agent_id: session.qualification_agent_id ?? null,
    objection_agent_id: session.objection_agent_id ?? null,
    booking_agent_id: session.booking_agent_id ?? null,
    crm_summary_agent_id: session.crm_summary_agent_id ?? null,
    handoff_agent_id: session.handoff_agent_id ?? null,
    follow_up_agent_id: session.follow_up_agent_id ?? null,
  };
}

export async function applyMultiAgentTeamToSession(
  session: DemoSession,
  opts?: { enabled?: boolean; mode?: MultiAgentAssignmentMode | string | null }
): Promise<DemoSession> {
  const settings = await getMultiAgentDemoSettings(session.organization_id);
  const enabled = opts?.enabled ?? settings.enabled;
  if (!enabled || !session.agent_id) {
    return session;
  }

  const team = await resolveDemoAgentTeam({
    organizationId: session.organization_id,
    primaryAgentId: session.agent_id,
    mode: opts?.mode ?? session.multi_agent_assignment_mode ?? "org_default_team",
    sessionOverrides: sessionTeamOverrides(session),
  });

  return {
    ...session,
    multi_agent_enabled: true,
    multi_agent_assignment_mode:
      opts?.mode ?? session.multi_agent_assignment_mode ?? "org_default_team",
    primary_presenter_agent_id: team.presenter_agent,
    qualification_agent_id: team.qualification_agent,
    objection_agent_id: team.objection_agent,
    booking_agent_id: team.booking_agent,
    crm_summary_agent_id: team.crm_summary_agent,
    handoff_agent_id: team.handoff_agent,
    follow_up_agent_id: team.follow_up_agent,
    metadata: {
      ...(session.metadata ?? {}),
      multi_agent_team: team,
    },
  };
}
