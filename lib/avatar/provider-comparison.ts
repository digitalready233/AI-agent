import { getDemoProviderSettings } from "@/lib/demo/demo-provider";
import { listDemoSessions } from "@/lib/demo/demo-data";
import {
  hasAvatarProviderApiKey,
  getMaskedAvatarApiKey,
} from "./avatar-credentials";
import { listAvatarIntegrations } from "./avatar-integrations-data";
import { aggregateProviderStats } from "./provider-metrics-data";
import { testAvatarProviderConnection } from "./avatar-session-service";
import {
  AVATAR_PROVIDER_IDS,
  AVATAR_PROVIDER_LABELS,
  DEFAULT_AVATAR_ORG_SETTINGS,
  type AvatarProviderId,
} from "./types";

export type ProviderComparisonCard = {
  id: AvatarProviderId;
  label: string;
  status: "connected" | "not_connected" | "needs_attention" | "builtin";
  configured: boolean;
  masked_api_key: string | null;
  is_default: boolean;
  last_tested_at: string | null;
  demos_started: number;
  failures: number;
  fallbacks: number;
  bookings: number;
  handoffs: number;
  avg_start_time_ms: number | null;
  success_rate: number;
  failure_rate: number;
  conversion_rate: number;
};

export async function buildProviderComparison(
  organizationId: string
): Promise<{
  settings: typeof DEFAULT_AVATAR_ORG_SETTINGS;
  providers: ProviderComparisonCard[];
  most_reliable: string | null;
  best_converting: string | null;
}> {
  const demoSettings = await getDemoProviderSettings(organizationId);
  const orgSettings = {
    ...DEFAULT_AVATAR_ORG_SETTINGS,
    ...demoSettings.avatar,
  };
  const integrations = await listAvatarIntegrations(organizationId);
  const aggregates = await aggregateProviderStats(organizationId);
  const sessions = await listDemoSessions(organizationId);

  const sessionCounts = new Map<string, number>();
  for (const s of sessions) {
    const p = s.avatar_provider ?? "internal_card";
    sessionCounts.set(p, (sessionCounts.get(p) ?? 0) + 1);
  }

  const providers: ProviderComparisonCard[] = await Promise.all(
    AVATAR_PROVIDER_IDS.map(async (id) => {
      const integration = integrations.find((i) => i.provider === id);
      const agg = aggregates.find((a) => a.provider === id);
      const configured =
        id === "internal_card" ||
        (await hasAvatarProviderApiKey(organizationId, id)) ||
        Boolean(integration?.api_key_encrypted);
      const masked =
        id === "internal_card"
          ? null
          : await getMaskedAvatarApiKey(organizationId, id);

      let status: ProviderComparisonCard["status"] =
        id === "internal_card"
          ? "builtin"
          : integration?.status === "connected"
            ? "connected"
            : configured
              ? "needs_attention"
              : "not_connected";

      if (id !== "internal_card" && configured && integration?.status !== "connected") {
        status = configured ? "connected" : "not_connected";
      }

      const demosFromSessions = sessionCounts.get(id) ?? 0;

      return {
        id,
        label: AVATAR_PROVIDER_LABELS[id],
        status,
        configured,
        masked_api_key: masked,
        is_default: orgSettings.default_avatar_provider === id,
        last_tested_at: integration?.last_tested_at ?? null,
        demos_started: agg?.demosStarted ?? demosFromSessions,
        failures: agg?.failures ?? 0,
        fallbacks: agg?.fallbacks ?? 0,
        bookings: agg?.bookings ?? 0,
        handoffs: agg?.handoffs ?? 0,
        avg_start_time_ms: agg?.avgStartTimeMs ?? null,
        success_rate: agg?.successRate ?? (id === "internal_card" ? 100 : 0),
        failure_rate: agg?.failureRate ?? 0,
        conversion_rate: agg?.conversionRate ?? 0,
      };
    })
  );

  const external = providers.filter(
    (p) => p.id !== "internal_card" && p.id !== "heygen" && p.id !== "custom_future"
  );
  const mostReliable = [...external].sort(
    (a, b) => b.success_rate - a.success_rate || a.failure_rate - b.failure_rate
  )[0];
  const bestConverting = [...external].sort(
    (a, b) => b.conversion_rate - a.conversion_rate
  )[0];

  return {
    settings: orgSettings,
    providers,
    most_reliable: mostReliable?.id ?? null,
    best_converting: bestConverting?.id ?? null,
  };
}

export async function runProviderTest(
  organizationId: string,
  provider: AvatarProviderId,
  overrides?: {
    agent_id?: string;
    replica_id?: string;
    persona_id?: string;
  }
) {
  const start = Date.now();
  const result = await testAvatarProviderConnection(organizationId, provider, {
    avatar_id: overrides?.agent_id,
    avatar_replica_id: overrides?.replica_id,
    avatar_persona_id: overrides?.persona_id,
    avatar_provider: provider,
    avatar_enabled: true,
  });
  return {
    ...result,
    response_time_ms: Date.now() - start,
  };
}
