import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import type { AvatarProviderId, AvatarProviderMetric } from "./types";

const JSON_FILE = "platform/avatar-provider-metrics.json";

async function readAll(): Promise<AvatarProviderMetric[]> {
  return readJsonFile(JSON_FILE, []);
}

async function writeAll(rows: AvatarProviderMetric[]) {
  await writeJsonFile(JSON_FILE, rows);
}

export async function recordAvatarProviderMetric(
  row: {
    organization_id: string;
    provider: string;
    status: string;
    demo_session_id?: string | null;
    start_time_ms?: number | null;
    session_duration_seconds?: number | null;
    failed_reason?: string | null;
    fallback_used?: boolean;
    booking_created?: boolean;
    lead_category?: string | null;
    human_handoff?: boolean;
    id?: string;
    created_at?: string;
  }
): Promise<AvatarProviderMetric> {
  const record: AvatarProviderMetric = {
    id: row.id ?? crypto.randomUUID(),
    organization_id: row.organization_id,
    provider: row.provider,
    demo_session_id: row.demo_session_id ?? null,
    status: row.status,
    start_time_ms: row.start_time_ms ?? null,
    session_duration_seconds: row.session_duration_seconds ?? null,
    failed_reason: row.failed_reason ?? null,
    fallback_used: row.fallback_used ?? false,
    booking_created: row.booking_created ?? false,
    lead_category: row.lead_category ?? null,
    human_handoff: row.human_handoff ?? false,
    created_at: row.created_at ?? new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("avatar_provider_metrics")
      .insert(record)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as AvatarProviderMetric;
  }

  const all = await readAll();
  all.push(record);
  await writeAll(all);
  return record;
}

export async function listAvatarProviderMetrics(
  organizationId: string,
  opts?: { provider?: string; limit?: number }
): Promise<AvatarProviderMetric[]> {
  const limit = opts?.limit ?? 500;
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    let q = supabase
      .from("avatar_provider_metrics")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (opts?.provider) {
      q = q.eq("provider", opts.provider);
    }
    const { data } = await q;
    return (data as AvatarProviderMetric[]) ?? [];
  }
  let rows = (await readAll()).filter((r) => r.organization_id === organizationId);
  if (opts?.provider) {
    rows = rows.filter((r) => r.provider === opts.provider);
  }
  return rows
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export type ProviderAggregateStats = {
  provider: AvatarProviderId | string;
  demosStarted: number;
  failures: number;
  fallbacks: number;
  bookings: number;
  handoffs: number;
  completed: number;
  avgStartTimeMs: number | null;
  successRate: number;
  failureRate: number;
  conversionRate: number;
};

export async function aggregateProviderStats(
  organizationId: string
): Promise<ProviderAggregateStats[]> {
  const metrics = await listAvatarProviderMetrics(organizationId, { limit: 2000 });
  const byProvider = new Map<string, ProviderAggregateStats>();

  for (const m of metrics) {
    const p = m.provider;
    if (!byProvider.has(p)) {
      byProvider.set(p, {
        provider: p,
        demosStarted: 0,
        failures: 0,
        fallbacks: 0,
        bookings: 0,
        handoffs: 0,
        completed: 0,
        avgStartTimeMs: null,
        successRate: 0,
        failureRate: 0,
        conversionRate: 0,
      });
    }
    const s = byProvider.get(p)!;
    if (m.status === "session_started" || m.status === "started") s.demosStarted += 1;
    if (m.status === "session_failed" || m.status === "failed") s.failures += 1;
    if (m.fallback_used) s.fallbacks += 1;
    if (m.booking_created) s.bookings += 1;
    if (m.human_handoff) s.handoffs += 1;
    if (m.status === "demo_completed" || m.status === "completed") s.completed += 1;
  }

  const startTimes = new Map<string, number[]>();
  for (const m of metrics) {
    if (m.start_time_ms != null) {
      const arr = startTimes.get(m.provider) ?? [];
      arr.push(m.start_time_ms);
      startTimes.set(m.provider, arr);
    }
  }

  for (const s of byProvider.values()) {
    const times = startTimes.get(String(s.provider)) ?? [];
    if (times.length) {
      s.avgStartTimeMs = Math.round(
        times.reduce((a, b) => a + b, 0) / times.length
      );
    }
    const total = s.demosStarted + s.failures;
    s.successRate =
      total > 0 ? Math.round((s.demosStarted / total) * 1000) / 10 : 0;
    s.failureRate =
      total > 0 ? Math.round((s.failures / total) * 1000) / 10 : 0;
    s.conversionRate =
      s.demosStarted > 0
        ? Math.round((s.bookings / s.demosStarted) * 1000) / 10
        : 0;
  }

  return Array.from(byProvider.values());
}
