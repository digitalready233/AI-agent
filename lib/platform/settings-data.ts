import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { platformDb, hasServiceRoleKey } from "./db";
import { jsonStore } from "./json-store";
import { mergeSettings, defaultOrganizationSettings } from "./settings-defaults";
import {
  isMissingSettingsSchemaError,
  SETTINGS_MIGRATION_HINT,
} from "./settings-schema";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret, maskSecret } from "./settings-crypto";
import type {
  OrganizationSettingsRecord,
  SettingsSection,
} from "./settings-types";

type DbRow = {
  organization_id: string;
  workspace: unknown;
  agent_defaults: unknown;
  sales_pipeline: unknown;
  lead_scoring: unknown;
  human_handoff: unknown;
  notifications: unknown;
  security: unknown;
  billing: unknown;
  data_privacy: unknown;
  api_settings: unknown;
  team_settings: unknown;
  updated_at: string;
};

function rowToSettings(row: DbRow): OrganizationSettingsRecord {
  return mergeSettings(row.organization_id, {
    organization_id: row.organization_id,
    workspace: row.workspace as OrganizationSettingsRecord["workspace"],
    agent_defaults: row.agent_defaults as OrganizationSettingsRecord["agent_defaults"],
    sales_pipeline: row.sales_pipeline as OrganizationSettingsRecord["sales_pipeline"],
    lead_scoring: row.lead_scoring as OrganizationSettingsRecord["lead_scoring"],
    human_handoff: row.human_handoff as OrganizationSettingsRecord["human_handoff"],
    notifications: row.notifications as OrganizationSettingsRecord["notifications"],
    security: row.security as OrganizationSettingsRecord["security"],
    billing: row.billing as OrganizationSettingsRecord["billing"],
    data_privacy: row.data_privacy as OrganizationSettingsRecord["data_privacy"],
    api_settings: row.api_settings as OrganizationSettingsRecord["api_settings"],
    team_settings: row.team_settings as OrganizationSettingsRecord["team_settings"],
    updated_at: row.updated_at,
  });
}

async function loadSettingsFromJsonFallback(
  organizationId: string
): Promise<OrganizationSettingsRecord> {
  const stored = await jsonStore.getOrganizationSettings(organizationId);
  return mergeSettings(organizationId, stored);
}

export async function isSettingsSchemaReady(): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  const supabase = await platformDb();
  const { error } = await supabase
    .from("organization_settings")
    .select("organization_id")
    .limit(1);
  if (!error) return true;
  return !isMissingSettingsSchemaError(error);
}

export async function getOrganizationSettings(
  organizationId: string
): Promise<OrganizationSettingsRecord> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("organization_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      if (isMissingSettingsSchemaError(error)) {
        return loadSettingsFromJsonFallback(organizationId);
      }
      throw error;
    }

    if (!data) {
      const defaults = defaultOrganizationSettings(organizationId);
      try {
        await saveOrganizationSettings(defaults);
      } catch (saveErr) {
        if (isMissingSettingsSchemaError(saveErr)) {
          return defaults;
        }
        throw saveErr;
      }
      return defaults;
    }
    return rowToSettings(data as DbRow);
  }

  return loadSettingsFromJsonFallback(organizationId);
}

export async function saveOrganizationSettings(
  settings: OrganizationSettingsRecord
): Promise<OrganizationSettingsRecord> {
  const now = new Date().toISOString();
  const payload = { ...settings, updated_at: now };

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("organization_settings")
      .upsert({
        organization_id: settings.organization_id,
        workspace: settings.workspace,
        agent_defaults: settings.agent_defaults,
        sales_pipeline: settings.sales_pipeline,
        lead_scoring: settings.lead_scoring,
        human_handoff: settings.human_handoff,
        notifications: settings.notifications,
        security: settings.security,
        billing: settings.billing,
        data_privacy: settings.data_privacy,
        api_settings: settings.api_settings,
        team_settings: settings.team_settings,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      if (isMissingSettingsSchemaError(error)) {
        await jsonStore.setOrganizationSettings(payload);
        return payload;
      }
      throw error;
    }
    return rowToSettings(data as DbRow);
  }

  await jsonStore.setOrganizationSettings(payload);
  return payload;
}

export async function patchOrganizationSettingsSection<
  S extends SettingsSection,
>(
  organizationId: string,
  section: S,
  value: OrganizationSettingsRecord[S]
): Promise<OrganizationSettingsRecord> {
  const current = await getOrganizationSettings(organizationId);
  const next = { ...current, [section]: value, updated_at: new Date().toISOString() };
  return saveOrganizationSettings(next);
}

async function secretsClient() {
  if (hasServiceRoleKey()) return createAdminClient();
  return await platformDb();
}

export async function setOrganizationSecret(
  organizationId: string,
  secretKey: string,
  plainValue: string
): Promise<void> {
  const encrypted_value = encryptSecret(plainValue);
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const supabase = await secretsClient();
    const { error } = await supabase.from("organization_secrets").upsert(
      {
        organization_id: organizationId,
        secret_key: secretKey,
        encrypted_value,
        updated_at: now,
      },
      { onConflict: "organization_id,secret_key" }
    );
    if (error) {
      if (isMissingSettingsSchemaError(error)) {
        await jsonStore.setOrganizationSecret(organizationId, secretKey, encrypted_value);
        return;
      }
      throw error;
    }
    return;
  }

  await jsonStore.setOrganizationSecret(organizationId, secretKey, encrypted_value);
}

export async function getOrganizationSecret(
  organizationId: string,
  secretKey: string
): Promise<string | null> {
  if (isSupabaseConfigured()) {
    const supabase = await secretsClient();
    const { data, error } = await supabase
      .from("organization_secrets")
      .select("encrypted_value")
      .eq("organization_id", organizationId)
      .eq("secret_key", secretKey)
      .maybeSingle();

    if (error) {
      if (isMissingSettingsSchemaError(error)) {
        const enc = await jsonStore.getOrganizationSecret(organizationId, secretKey);
        if (!enc) return null;
        try {
          return decryptSecret(enc);
        } catch {
          return null;
        }
      }
      return null;
    }

    if (!data) {
      const enc = await jsonStore.getOrganizationSecret(organizationId, secretKey);
      if (!enc) return null;
      try {
        return decryptSecret(enc);
      } catch {
        return null;
      }
    }

    try {
      return decryptSecret(data.encrypted_value);
    } catch {
      return null;
    }
  }

  const enc = await jsonStore.getOrganizationSecret(organizationId, secretKey);
  if (!enc) return null;
  try {
    return decryptSecret(enc);
  } catch {
    return null;
  }
}

export async function hasOrganizationSecret(
  organizationId: string,
  secretKey: string
): Promise<boolean> {
  const v = await getOrganizationSecret(organizationId, secretKey);
  return Boolean(v);
}

export async function deleteOrganizationSecret(
  organizationId: string,
  secretKey: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await secretsClient();
    const { error } = await supabase
      .from("organization_secrets")
      .delete()
      .eq("organization_id", organizationId)
      .eq("secret_key", secretKey);
    if (error && !isMissingSettingsSchemaError(error)) {
      throw error;
    }
  }
  await jsonStore.deleteOrganizationSecret(organizationId, secretKey);
}

export async function getMaskedOrganizationSecret(
  organizationId: string,
  secretKey: string
): Promise<string | null> {
  const v = await getOrganizationSecret(organizationId, secretKey);
  if (!v) return null;
  return maskSecret(v);
}

export function generateApiToken(): string {
  return `dsa_${randomTokenBody()}`;
}

function randomTokenBody(): string {
  return randomBytes(24).toString("hex");
}

export async function regenerateApiToken(organizationId: string): Promise<string> {
  const token = generateApiToken();
  await setOrganizationSecret(organizationId, "api_token", token);
  return token;
}

export async function regenerateWebhookSecret(
  organizationId: string
): Promise<string> {
  const secret = `whsec_${randomTokenBody()}`;
  await setOrganizationSecret(organizationId, "webhook_secret", secret);
  return secret;
}

export { SETTINGS_MIGRATION_HINT };
