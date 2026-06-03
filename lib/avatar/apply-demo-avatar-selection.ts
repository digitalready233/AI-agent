import { getAgent } from "@/lib/platform/data";
import { saveDemoSession } from "@/lib/demo/demo-data";
import type { DemoSession } from "@/lib/demo/types";
import { saveAvatarEvent } from "./avatar-events-data";
import { selectAvatarProvider } from "./select-avatar-provider";

export async function applyAvatarProviderToDemoSession(
  session: DemoSession
): Promise<DemoSession> {
  const agent = session.agent_id ? await getAgent(session.agent_id) : null;
  if (!agent) return session;

  const selection = await selectAvatarProvider({
    organizationId: session.organization_id,
    agentId: agent.id,
    demoSessionId: session.id,
    demoPathId: session.demo_path_id,
    leadId: session.lead_id,
    demoType: session.demo_type,
    agent,
  });

  const updated = await saveDemoSession({
    ...session,
    avatar_provider: selection.provider,
    avatar_fallback_provider: selection.fallbackProvider,
    avatar_routing_rule_id: selection.routingRuleId ?? null,
    avatar_provider_mode: agent.avatar_provider_mode ?? null,
    avatar_status: selection.provider === "internal_card" ? "not_started" : "not_started",
    metadata: {
      ...(session.metadata ?? {}),
      avatar_selection_source: selection.source,
      avatar_selection_reason: selection.reason ?? null,
      avatar_routing_rule_name: selection.routingRuleName ?? null,
    },
  });

  await saveAvatarEvent({
    organization_id: updated.organization_id,
    demo_session_id: updated.id,
    provider: selection.provider,
    event_type: "avatar_provider_selected",
    payload: {
      provider: selection.provider,
      fallback_provider: selection.fallbackProvider,
      source: selection.source,
      routing_rule_id: selection.routingRuleId,
      routing_rule_name: selection.routingRuleName,
    },
  });

  if (selection.routingRuleId) {
    await saveAvatarEvent({
      organization_id: updated.organization_id,
      demo_session_id: updated.id,
      provider: selection.provider,
      event_type: "routing_rule_matched",
      payload: {
        rule_id: selection.routingRuleId,
        rule_name: selection.routingRuleName,
      },
    });
  }

  return updated;
}
