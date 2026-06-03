import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import { jsonStore } from "@/lib/platform/json-store";
import { hasOrganizationSecret } from "@/lib/platform/settings-data";
import {
  hasWhatsAppAccessToken,
  WHATSAPP_SECRET_KEYS,
} from "./credentials";
import type { WhatsAppConnectionStatus, WhatsAppSettings } from "./types";

function defaultSettings(organizationId: string): WhatsAppSettings {
  return {
    organization_id: organizationId,
    phone_number_id: "",
    waba_id: null,
    business_phone_number: null,
    default_agent_id: null,
    webhook_verify_token: null,
    webhook_callback_url: null,
    connection_status: "not_connected",
    last_tested_at: null,
    message_templates: [],
    updated_at: new Date().toISOString(),
  };
}

export async function getWhatsAppSettings(
  organizationId: string
): Promise<WhatsAppSettings> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (error) {
      const fallback = await jsonStore.getWhatsAppSettings(organizationId);
      return fallback ?? defaultSettings(organizationId);
    }
    if (!data) return defaultSettings(organizationId);
    return normalize(data as WhatsAppSettings);
  }

  const stored = await jsonStore.getWhatsAppSettings(organizationId);
  return stored ? normalize(stored) : defaultSettings(organizationId);
}

function normalize(raw: WhatsAppSettings): WhatsAppSettings {
  const status = raw.connection_status ?? "not_connected";
  return {
    ...raw,
    business_phone_number: raw.business_phone_number ?? null,
    webhook_callback_url: raw.webhook_callback_url ?? null,
    connection_status:
      status === "connected" || status === "error" ? status : "not_connected",
    last_tested_at: raw.last_tested_at ?? null,
    message_templates: raw.message_templates ?? [],
  };
}

export async function saveWhatsAppSettings(
  settings: WhatsAppSettings
): Promise<WhatsAppSettings> {
  const normalized = normalize({
    ...settings,
    updated_at: new Date().toISOString(),
  });

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("whatsapp_settings")
      .upsert(normalized)
      .select()
      .single();

    if (error) {
      await jsonStore.setWhatsAppSettings(normalized);
      return normalized;
    }
    return normalize(data as WhatsAppSettings);
  }

  await jsonStore.setWhatsAppSettings(normalized);
  return normalized;
}

export async function findOrganizationByPhoneNumberId(
  phoneNumberId: string
): Promise<WhatsAppSettings | null> {
  if (!phoneNumberId.trim()) return null;

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .eq("phone_number_id", phoneNumberId.trim())
      .maybeSingle();

    if (error) {
      const all = await jsonStore.listAllWhatsAppSettings();
      return (
        all.find((s) => s.phone_number_id === phoneNumberId.trim()) ?? null
      );
    }
    return data ? normalize(data as WhatsAppSettings) : null;
  }

  const all = await jsonStore.listAllWhatsAppSettings();
  return all.find((s) => s.phone_number_id === phoneNumberId.trim()) ?? null;
}

function webhookUrls(appOrigin: string): { primary: string; alt: string } {
  const base = appOrigin.replace(/\/$/, "");
  return {
    primary: `${base}/api/whatsapp/webhook`,
    alt: `${base}/api/webhooks/whatsapp`,
  };
}

export async function getWhatsAppConnectionStatus(
  organizationId: string,
  appOrigin: string
): Promise<WhatsAppConnectionStatus> {
  const settings = await getWhatsAppSettings(organizationId);
  const hasToken = await hasWhatsAppAccessToken(organizationId);
  const hasVerify = Boolean(
    settings.webhook_verify_token?.trim() ||
      (await hasOrganizationSecret(organizationId, WHATSAPP_SECRET_KEYS.verifyToken))
  );
  const urls = webhookUrls(appOrigin);
  const configured = Boolean(settings.phone_number_id && hasToken && hasVerify);

  return {
    configured,
    phone_number_id: settings.phone_number_id || null,
    waba_id: settings.waba_id,
    business_phone_number: settings.business_phone_number,
    default_agent_id: settings.default_agent_id,
    has_access_token: hasToken,
    has_verify_token: hasVerify,
    webhook_url:
      settings.webhook_callback_url?.trim() || urls.primary,
    webhook_url_alt: urls.alt,
    connection_status: settings.connection_status,
    last_tested_at: settings.last_tested_at,
  };
}

export async function recordWhatsAppConnectionTest(params: {
  organizationId: string;
  result: import("./test-connection").WhatsAppTestConnectionResult;
  businessPhoneFromMeta?: string | null;
}): Promise<WhatsAppSettings> {
  const current = await getWhatsAppSettings(params.organizationId);
  return saveWhatsAppSettings({
    ...current,
    connection_status: params.result.connection_status,
    last_tested_at: params.result.checked_at,
    business_phone_number:
      params.businessPhoneFromMeta?.trim() ||
      current.business_phone_number,
    updated_at: new Date().toISOString(),
  });
}
