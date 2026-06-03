import type { DemoSession } from "../types";
import type { DemoAgentRole, MultiAgentAssignmentMode } from "./types";

export type MultiAgentSessionConfig = {
  multi_agent_enabled?: boolean;
  multi_agent_assignment_mode?: MultiAgentAssignmentMode | string | null;
  primary_presenter_agent_id?: string | null;
  qualification_agent_id?: string | null;
  objection_agent_id?: string | null;
  booking_agent_id?: string | null;
  crm_summary_agent_id?: string | null;
  handoff_agent_id?: string | null;
  follow_up_agent_id?: string | null;
};

export function applyMultiAgentFieldsToSession(
  session: DemoSession,
  config?: MultiAgentSessionConfig | null
): DemoSession {
  if (!config) return session;
  return {
    ...session,
    multi_agent_enabled: config.multi_agent_enabled ?? session.multi_agent_enabled,
    multi_agent_assignment_mode:
      config.multi_agent_assignment_mode ?? session.multi_agent_assignment_mode,
    primary_presenter_agent_id:
      config.primary_presenter_agent_id !== undefined
        ? config.primary_presenter_agent_id
        : session.primary_presenter_agent_id,
    qualification_agent_id:
      config.qualification_agent_id !== undefined
        ? config.qualification_agent_id
        : session.qualification_agent_id,
    objection_agent_id:
      config.objection_agent_id !== undefined
        ? config.objection_agent_id
        : session.objection_agent_id,
    booking_agent_id:
      config.booking_agent_id !== undefined
        ? config.booking_agent_id
        : session.booking_agent_id,
    crm_summary_agent_id:
      config.crm_summary_agent_id !== undefined
        ? config.crm_summary_agent_id
        : session.crm_summary_agent_id,
    handoff_agent_id:
      config.handoff_agent_id !== undefined
        ? config.handoff_agent_id
        : session.handoff_agent_id,
    follow_up_agent_id:
      config.follow_up_agent_id !== undefined
        ? config.follow_up_agent_id
        : session.follow_up_agent_id,
  };
}

export const DEMO_AGENT_ROLE_KEYS: DemoAgentRole[] = [
  "presenter_agent",
  "qualification_agent",
  "objection_agent",
  "booking_agent",
  "crm_summary_agent",
  "handoff_agent",
  "follow_up_agent",
];
