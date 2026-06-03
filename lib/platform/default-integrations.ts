import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "./db";
import { jsonStore } from "./json-store";
import type { Integration, IntegrationStatus } from "./types";

async function persistIntegration(integration: Integration): Promise<Integration> {
  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data, error } = await supabase
      .from("integrations")
      .upsert(integration)
      .select()
      .single();
    if (error) throw error;
    return data as Integration;
  }
  return jsonStore.upsertIntegration(integration);
}

/** Integration cards shown on /dashboard/integrations */
export const DEFAULT_INTEGRATION_TYPES: {
  integration_type: string;
  status: IntegrationStatus;
}[] = [
  { integration_type: "openai", status: "not_connected" },
  { integration_type: "whatsapp", status: "not_connected" },
  { integration_type: "twilio_voice", status: "not_connected" },
  { integration_type: "google_calendar", status: "needs_attention" },
  { integration_type: "hubspot", status: "not_connected" },
  { integration_type: "salesforce", status: "not_connected" },
  { integration_type: "calendly", status: "not_connected" },
  { integration_type: "airtable", status: "not_connected" },
  { integration_type: "google_sheets", status: "not_connected" },
  { integration_type: "slack", status: "not_connected" },
  { integration_type: "email_smtp", status: "not_connected" },
  { integration_type: "zoom", status: "not_connected" },
  { integration_type: "website_chat", status: "connected" },
  { integration_type: "webhook_api", status: "not_connected" },
];

/**
 * Seed integration rows for an org when none exist (Supabase sign-up path).
 */
export async function ensureDefaultIntegrations(
  organizationId: string
): Promise<Integration[]> {
  const now = new Date().toISOString();
  const created: Integration[] = [];

  for (const row of DEFAULT_INTEGRATION_TYPES) {
    const integration = await persistIntegration({
      id: crypto.randomUUID(),
      organization_id: organizationId,
      integration_type: row.integration_type,
      status: row.status,
      created_at: now,
      updated_at: now,
    });
    created.push(integration);
  }

  return created;
}
