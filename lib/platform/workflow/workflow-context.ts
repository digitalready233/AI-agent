import { getOrganizationSettings } from "@/lib/platform/settings-data";
import type { OrganizationSettingsRecord } from "@/lib/platform/settings-types";
import type { Agent } from "@/lib/platform/types";

export type WorkflowRuntimeContext = {
  settings: OrganizationSettingsRecord;
  agent: Agent;
  /** Agent row merged with organization AI defaults (empty agent fields fall back to settings). */
  effective: {
    tone: string;
    language: string;
    welcome_message: string;
    fallback_response: string;
    qualification_prompt: string;
    objection_prompt: string;
    booking_rules: string;
    handoff_rules: string;
    crm_update_rules: string;
    lead_scoring_rules: string;
    handoff_message: string;
    booking_message: string;
  };
};

export async function loadWorkflowContext(
  organizationId: string,
  agent: Agent
): Promise<WorkflowRuntimeContext> {
  const settings = await getOrganizationSettings(organizationId);
  const d = settings.agent_defaults;

  const effective = {
    tone: agent.tone?.trim() || d.default_tone,
    language: agent.language?.trim() || settings.workspace.default_language || "en",
    welcome_message: agent.welcome_message?.trim() || d.default_welcome_message,
    fallback_response: agent.fallback_response?.trim() || d.default_fallback_response,
    qualification_prompt:
      agent.qualification_prompt?.trim() || d.default_qualification_prompt,
    objection_prompt: agent.objection_prompt?.trim() || d.default_objection_prompt,
    booking_rules: agent.booking_rules?.trim() || d.default_booking_message,
    handoff_rules: agent.handoff_rules?.trim() || d.default_handoff_message,
    crm_update_rules: agent.crm_update_rules?.trim() || "",
    lead_scoring_rules:
      agent.lead_scoring_rules?.trim() || settings.lead_scoring.auto_qualify_rules,
    handoff_message: d.default_handoff_message,
    booking_message: d.default_booking_message,
  };

  return { settings, agent, effective };
}
