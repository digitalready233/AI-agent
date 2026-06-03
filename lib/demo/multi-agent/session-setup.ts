import { saveDemoSession } from "../demo-data";
import type { DemoSession } from "../types";
import { getMultiAgentDemoSettings } from "./settings";
import { applyMultiAgentTeamToSession } from "./team-resolution";
import { syncDemoAgentAssignments } from "./assignments-data";
import type { MultiAgentAssignmentMode } from "./types";

export async function setupMultiAgentDemoSession(
  session: DemoSession,
  opts?: {
    enabled?: boolean;
    mode?: MultiAgentAssignmentMode | string | null;
  }
): Promise<DemoSession> {
  const settings = await getMultiAgentDemoSettings(session.organization_id);
  const enabled =
    session.multi_agent_enabled === true ||
    (session.multi_agent_enabled !== false &&
      (opts?.enabled ?? settings.enabled));
  if (!enabled || !session.agent_id) {
    return session;
  }

  const patched = await applyMultiAgentTeamToSession(session, {
    enabled: true,
    mode:
      opts?.mode ??
      session.multi_agent_assignment_mode ??
      "org_default_team",
  });
  const saved = await saveDemoSession(patched);

  if (saved.primary_presenter_agent_id) {
    const team = (saved.metadata?.multi_agent_team ?? {}) as Record<
      string,
      string | null
    >;
    await syncDemoAgentAssignments({
      organizationId: saved.organization_id,
      demoSessionId: saved.id,
      team: {
        presenter_agent: saved.primary_presenter_agent_id,
        qualification_agent: saved.qualification_agent_id,
        objection_agent: saved.objection_agent_id,
        booking_agent: saved.booking_agent_id,
        crm_summary_agent: saved.crm_summary_agent_id,
        handoff_agent: saved.handoff_agent_id,
        follow_up_agent: saved.follow_up_agent_id,
      },
    });
  }

  return saved;
}
