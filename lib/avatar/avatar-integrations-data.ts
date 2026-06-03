import { readJsonFile, writeJsonFile } from "@/lib/persistence/json-db";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import { encryptSecret } from "@/lib/platform/settings-crypto";
import type { AvatarIntegration, AvatarProviderId } from "./types";

const JSON_FILE = "platform/avatar-integrations.json";

async function readAll(): Promise<AvatarIntegration[]> {
  return readJsonFile(JSON_FILE, []);
}

async function writeAll(rows: AvatarIntegration[]) {
  await writeJsonFile(JSON_FILE, rows);
}

export async function listAvatarIntegrations(
  organizationId: string
): Promise<AvatarIntegration[]> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("avatar_integrations")
      .select("*")
      .eq("organization_id", organizationId)
      .order("provider");
    return (data as AvatarIntegration[]) ?? [];
  }
  return (await readAll()).filter((r) => r.organization_id === organizationId);
}

export async function getAvatarIntegration(
  organizationId: string,
  provider: string
): Promise<AvatarIntegration | null> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("avatar_integrations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("provider", provider)
      .maybeSingle();
    return (data as AvatarIntegration) ?? null;
  }
  return (
    (await readAll()).find(
      (r) => r.organization_id === organizationId && r.provider === provider
    ) ?? null
  );
}

export async function saveAvatarIntegration(
  row: Omit<AvatarIntegration, "created_at" | "updated_at"> & {
    created_at?: string;
    updated_at?: string;
    api_key_plain?: string | null;
  }
): Promise<AvatarIntegration> {
  const now = new Date().toISOString();
  const api_key_encrypted =
    row.api_key_plain?.trim()
      ? encryptSecret(row.api_key_plain.trim())
      : row.api_key_encrypted ?? null;

  const record: AvatarIntegration = {
    id: row.id ?? crypto.randomUUID(),
    organization_id: row.organization_id,
    provider: row.provider,
    status: row.status,
    api_key_encrypted,
    config: row.config ?? {},
    default_avatar_id: row.default_avatar_id ?? null,
    default_voice_id: row.default_voice_id ?? null,
    last_tested_at: row.last_tested_at ?? null,
    created_at: row.created_at ?? now,
    updated_at: now,
  };

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("avatar_integrations")
      .upsert(record, { onConflict: "organization_id,provider" })
      .select()
      .single();
    if (error) throw error;
    return data as AvatarIntegration;
  }

  const all = await readAll();
  const idx = all.findIndex(
    (r) => r.organization_id === record.organization_id && r.provider === record.provider
  );
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  await writeAll(all);
  return record;
}

export async function ensureAvatarIntegrationRows(
  organizationId: string,
  providers: AvatarProviderId[]
): Promise<AvatarIntegration[]> {
  const existing = await listAvatarIntegrations(organizationId);
  const out = [...existing];
  for (const provider of providers) {
    if (provider === "internal_card") continue;
    if (!existing.find((e) => e.provider === provider)) {
      const created = await saveAvatarIntegration({
        id: crypto.randomUUID(),
        organization_id: organizationId,
        provider,
        status: "not_connected",
        config: {},
      });
      out.push(created);
    }
  }
  return out;
}
