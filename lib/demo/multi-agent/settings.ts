import { getDemoProviderSettings } from "../demo-provider";
import {
  DEFAULT_MULTI_AGENT_DEMO_SETTINGS,
  type MultiAgentDemoSettings,
} from "./types";

export async function getMultiAgentDemoSettings(
  organizationId: string
): Promise<MultiAgentDemoSettings> {
  const demo = await getDemoProviderSettings(organizationId);
  const raw = (demo as { multi_agent?: Partial<MultiAgentDemoSettings> }).multi_agent;
  return {
    ...DEFAULT_MULTI_AGENT_DEMO_SETTINGS,
    ...raw,
    default_team: {
      ...DEFAULT_MULTI_AGENT_DEMO_SETTINGS.default_team,
      ...(raw?.default_team ?? {}),
    },
  };
}

export function isMultiAgentDemoEnabledForSession(
  session: { multi_agent_enabled?: boolean | null },
  settings: MultiAgentDemoSettings
): boolean {
  if (session.multi_agent_enabled === true) return true;
  if (session.multi_agent_enabled === false) return false;
  return settings.enabled;
}
