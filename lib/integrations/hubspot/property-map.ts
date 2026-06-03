/**
 * HubSpot contact property internal names.
 * Override via env: HUBSPOT_PROPERTY_LEAD_INTENT=your_custom_name
 */

export type HubSpotPropertyMap = {
  lead_intent: string;
  current_stack: string;
  budget_tier: string;
  timeline: string;
  team_structure: string;
  service_interest: string;
  lead_score: string;
  lead_category: string;
  lead_status: string;
  conversation_summary: string;
  next_action: string;
  source_channel: string;
};

const DEFAULT_MAP: HubSpotPropertyMap = {
  lead_intent: "dr_lead_intent",
  current_stack: "dr_current_stack",
  budget_tier: "dr_budget_tier",
  timeline: "dr_timeline",
  team_structure: "dr_team_structure",
  service_interest: "dr_service_interest",
  lead_score: "dr_lead_score",
  lead_category: "dr_lead_category",
  lead_status: "dr_lead_status",
  conversation_summary: "dr_conversation_summary",
  next_action: "dr_next_action",
  source_channel: "dr_source_channel",
};

function envOverride(key: keyof HubSpotPropertyMap): string | undefined {
  return process.env[`HUBSPOT_PROPERTY_${key.toUpperCase()}`]?.trim();
}

export function resolveHubSpotPropertyMap(): HubSpotPropertyMap {
  const map = { ...DEFAULT_MAP };
  for (const key of Object.keys(DEFAULT_MAP) as (keyof HubSpotPropertyMap)[]) {
    const override = envOverride(key);
    if (override) map[key] = override;
  }
  return map;
}
