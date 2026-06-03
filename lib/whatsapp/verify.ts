import { whatsapp as envWhatsapp } from "@/lib/config";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { platformDb } from "@/lib/platform/db";
import { jsonStore } from "@/lib/platform/json-store";

export async function verifyWhatsAppWebhookToken(
  token: string | null
): Promise<boolean> {
  if (!token) return false;

  const envToken = envWhatsapp.verifyToken?.trim();
  if (envToken && token === envToken) return true;

  if (isSupabaseConfigured()) {
    const supabase = await platformDb();
    const { data } = await supabase
      .from("whatsapp_settings")
      .select("organization_id")
      .eq("webhook_verify_token", token)
      .limit(1);
    if (data?.length) return true;
  }

  const all = await jsonStore.listAllWhatsAppSettings();
  return all.some((s) => s.webhook_verify_token === token);
}
