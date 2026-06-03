import { getLead } from "@/lib/platform/data";
import { getDemoProviderSettings } from "@/lib/demo/demo-provider";
import { getDemoSession } from "@/lib/demo/demo-data";
import type { Agent } from "@/lib/platform/types";
import type { DemoSession } from "@/lib/demo/types";
import { hasAvatarProviderApiKey } from "./avatar-credentials";
import { getAvatarIntegration } from "./avatar-integrations-data";
import { listAvatarRoutingRules } from "./routing-rules-data";
import { aggregateProviderStats } from "./provider-metrics-data";
import { isExternalAvatarProvider } from "./registry";
import type {
  AvatarOrgSettings,
  AvatarProviderId,
  AvatarRoutingConditions,
  AvatarRoutingRule,
  AvatarSelectionResult,
} from "./types";
import { AVATAR_PROVIDER_IDS, DEFAULT_AVATAR_ORG_SETTINGS } from "./types";

function normalizeProvider(id: string | null | undefined): AvatarProviderId {
  if (id && (AVATAR_PROVIDER_IDS as readonly string[]).includes(id)) {
    return id as AvatarProviderId;
  }
  return "internal_card";
}

function parseTimeMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function matchesTimeOfDay(
  cond: AvatarRoutingConditions["time_of_day"],
  now = new Date()
): boolean {
  if (!cond?.start && !cond?.end) return true;
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = cond.start ? parseTimeMinutes(cond.start) : 0;
  const end = cond.end ? parseTimeMinutes(cond.end) : 24 * 60 - 1;
  if (start == null || end == null) return true;
  if (start <= end) return mins >= start && mins <= end;
  return mins >= start || mins <= end;
}

function ruleMatches(
  rule: AvatarRoutingRule,
  ctx: {
    agentId?: string | null;
    demoPathId?: string | null;
    demoType?: string | null;
    leadCategory?: string | null;
    industry?: string | null;
    serviceInterest?: string | null;
    language?: string | null;
    country?: string | null;
    clientWorkspace?: string | null;
  }
): boolean {
  const c = rule.conditions ?? {};
  if (c.agent_id && c.agent_id !== ctx.agentId) return false;
  if (c.demo_path_id && c.demo_path_id !== ctx.demoPathId) return false;
  if (c.demo_type && c.demo_type !== ctx.demoType) return false;
  if (c.lead_category && c.lead_category !== ctx.leadCategory) return false;
  if (c.industry && c.industry !== ctx.industry) return false;
  if (c.service_interest && c.service_interest !== ctx.serviceInterest) return false;
  if (c.language && c.language !== ctx.language) return false;
  if (c.country && c.country !== ctx.country) return false;
  if (c.client_workspace && c.client_workspace !== ctx.clientWorkspace) return false;
  if (!matchesTimeOfDay(c.time_of_day)) return false;
  return true;
}

export async function isAvatarProviderAvailable(
  organizationId: string,
  provider: AvatarProviderId
): Promise<boolean> {
  if (provider === "internal_card") return true;
  if (provider === "heygen" || provider === "custom_future") return false;
  const hasKey = await hasAvatarProviderApiKey(organizationId, provider);
  if (!hasKey) return false;
  const integration = await getAvatarIntegration(organizationId, provider);
  return integration?.status === "connected" || hasKey;
}

async function resolveBestPerformingProvider(
  organizationId: string
): Promise<AvatarProviderId> {
  const stats = await aggregateProviderStats(organizationId);
  const external = stats.filter((s) =>
    isExternalAvatarProvider(String(s.provider))
  );
  if (!external.length) return "internal_card";
  const ranked = [...external].sort((a, b) => {
    const scoreA = a.conversionRate * 2 + a.successRate - a.failureRate;
    const scoreB = b.conversionRate * 2 + b.successRate - b.failureRate;
    return scoreB - scoreA;
  });
  return normalizeProvider(String(ranked[0]?.provider ?? "internal_card"));
}

function buildFallbackChain(
  primary: AvatarProviderId,
  explicitFallback?: AvatarProviderId | null,
  orgFallback?: AvatarProviderId
): AvatarProviderId[] {
  const end = explicitFallback ?? orgFallback ?? "internal_card";
  const chain: AvatarProviderId[] = [];
  if (primary !== "internal_card") chain.push(primary);
  if (primary === "tavus" && end !== "tavus" && end !== "internal_card") {
    chain.push("did");
  } else if (primary === "did" && end !== "did" && end !== "internal_card") {
    chain.push("tavus");
  }
  if (!chain.includes("internal_card")) chain.push("internal_card");
  if (end !== "internal_card" && !chain.includes(end)) chain.push(end);
  return [...new Set(chain)];
}

export type SelectAvatarProviderParams = {
  organizationId: string;
  agentId?: string | null;
  demoSessionId?: string | null;
  demoPathId?: string | null;
  leadId?: string | null;
  demoType?: string | null;
  agent?: Agent | null;
  orgSettings?: AvatarOrgSettings;
};

export async function selectAvatarProvider(
  params: SelectAvatarProviderParams
): Promise<AvatarSelectionResult> {
  const demoSettings = await getDemoProviderSettings(params.organizationId);
  const orgSettings: AvatarOrgSettings = {
    ...DEFAULT_AVATAR_ORG_SETTINGS,
    ...demoSettings.avatar,
    ...params.orgSettings,
  };

  const agent = params.agent;
  if (!agent?.avatar_enabled || !orgSettings.enable_ai_avatar) {
    return {
      provider: "internal_card",
      fallbackProvider: "internal_card",
      source: "internal_fallback",
      reason: "Avatar disabled for agent or organization",
    };
  }

  const session = params.demoSessionId
    ? await getDemoSession(params.demoSessionId)
    : null;
  const lead =
    params.leadId != null
      ? await getLead(params.leadId)
      : session?.lead_id
        ? await getLead(session.lead_id)
        : null;

  const matchCtx = {
    agentId: params.agentId ?? agent?.id ?? session?.agent_id ?? null,
    demoPathId: params.demoPathId ?? session?.demo_path_id ?? null,
    demoType: params.demoType ?? session?.demo_type ?? null,
    leadCategory: lead?.lead_category ?? session?.lead_category ?? null,
    industry: null,
    serviceInterest: lead?.service_interest ?? session?.detected_intent ?? null,
    language: agent?.language ?? null,
    country: null,
    clientWorkspace:
      typeof session?.metadata?.client_workspace === "string"
        ? session.metadata.client_workspace
        : null,
  };

  const agentMode =
    (agent?.avatar_provider_mode as string | undefined) ?? "org_default";
  const orgFallback = normalizeProvider(
    orgSettings.default_fallback_provider ?? "internal_card"
  );
  const agentFallback = normalizeProvider(
    agent?.avatar_fallback_mode ?? orgFallback
  );

  let provider: AvatarProviderId = "internal_card";
  let source: AvatarSelectionResult["source"] = "org_default";
  let routingRuleId: string | null = null;
  let routingRuleName: string | null = null;
  let ruleFallback: AvatarProviderId | null = null;

  if (agentMode === "fixed") {
    provider = normalizeProvider(
      agent?.avatar_preferred_provider ?? agent?.avatar_provider ?? "internal_card"
    );
    source = "agent_fixed";
  } else if (agentMode === "smart_routing" || orgSettings.enable_smart_routing) {
    const rules = await listAvatarRoutingRules(params.organizationId);
    const active = rules.filter((r) => r.status === "active");
    for (const rule of active) {
      if (!ruleMatches(rule, matchCtx)) continue;
      if (rule.conditions.use_best_performing_provider) {
        provider = await resolveBestPerformingProvider(params.organizationId);
        source = "best_performing";
      } else {
        provider = normalizeProvider(rule.provider);
        source = "routing_rule";
      }
      routingRuleId = rule.id;
      routingRuleName = rule.name;
      ruleFallback = normalizeProvider(rule.fallback_provider);
      break;
    }
    if (source !== "routing_rule" && source !== "best_performing") {
      provider = normalizeProvider(orgSettings.default_avatar_provider);
      source = "org_default";
    }
  } else if (agentMode === "org_default") {
    provider = normalizeProvider(orgSettings.default_avatar_provider);
    source = "org_default";
  } else {
    provider = normalizeProvider(
      agent?.avatar_preferred_provider ?? agent?.avatar_provider ?? orgSettings.default_avatar_provider
    );
    source = "agent_fixed";
  }

  if (
    matchCtx.leadCategory === "hot" &&
    source !== "routing_rule" &&
    agentMode !== "fixed"
  ) {
    const best = await resolveBestPerformingProvider(params.organizationId);
    if (await isAvatarProviderAvailable(params.organizationId, best)) {
      provider = best;
      source = "best_performing";
    }
  }

  if (isExternalAvatarProvider(provider)) {
    const available = await isAvatarProviderAvailable(
      params.organizationId,
      provider
    );
    if (!available) {
      const alt =
        provider === "tavus"
          ? "did"
          : provider === "did"
            ? "tavus"
            : "internal_card";
      if (await isAvatarProviderAvailable(params.organizationId, alt)) {
        provider = alt;
      } else {
        provider = "internal_card";
        source = "internal_fallback";
      }
    }
  }

  const fallbackProvider =
    ruleFallback ??
    (buildFallbackChain(provider, agentFallback, orgFallback).find(
      (p) => p !== provider
    ) as AvatarProviderId) ??
    "internal_card";

  return {
    provider,
    fallbackProvider,
    source,
    routingRuleId,
    routingRuleName,
    reason:
      routingRuleName != null
        ? `Matched routing rule: ${routingRuleName}`
        : undefined,
  };
}
