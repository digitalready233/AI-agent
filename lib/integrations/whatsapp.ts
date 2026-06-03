import { whatsapp as envWhatsapp } from "@/lib/config";
import {
  sendWhatsAppTemplateMessage,
  sendWhatsAppTextMessage,
} from "@/lib/whatsapp/client";
import type { WhatsAppTemplateSendParams } from "@/lib/whatsapp/types";
import { resolveWhatsAppCredentials } from "@/lib/whatsapp/credentials";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings-data";

/** Send WhatsApp text — prefers org-scoped credentials when organizationId is set. */
export async function sendWhatsAppText(
  toPhone: string,
  body: string,
  organizationId?: string
): Promise<{ ok: boolean; error?: string }> {
  if (organizationId) {
    const settings = await getWhatsAppSettings(organizationId);
    if (!settings.phone_number_id) {
      return { ok: false, error: "WhatsApp phone number ID not configured for organization." };
    }
    const credentials = await resolveWhatsAppCredentials({
      organizationId,
      phoneNumberId: settings.phone_number_id,
      wabaId: settings.waba_id,
    });
    if (!credentials) {
      return { ok: false, error: "WhatsApp access token not configured for organization." };
    }
    const res = await sendWhatsAppTextMessage({
      credentials,
      toPhone,
      body,
    });
    return { ok: res.ok, error: res.error };
  }

  if (!envWhatsapp.accessToken || !envWhatsapp.phoneNumberId) {
    return { ok: false, error: "WhatsApp API not configured" };
  }

  const res = await sendWhatsAppTextMessage({
    credentials: {
      organizationId: "env",
      accessToken: envWhatsapp.accessToken,
      phoneNumberId: envWhatsapp.phoneNumberId,
      wabaId: null,
    },
    toPhone,
    body,
  });
  return { ok: res.ok, error: res.error };
}

/** Send a Meta-approved template message (required for outbound campaigns outside the 24h window). */
export async function sendWhatsAppTemplate(
  toPhone: string,
  template: WhatsAppTemplateSendParams,
  organizationId?: string
): Promise<{ ok: boolean; error?: string }> {
  if (organizationId) {
    const settings = await getWhatsAppSettings(organizationId);
    if (!settings.phone_number_id) {
      return { ok: false, error: "WhatsApp phone number ID not configured for organization." };
    }
    const credentials = await resolveWhatsAppCredentials({
      organizationId,
      phoneNumberId: settings.phone_number_id,
      wabaId: settings.waba_id,
    });
    if (!credentials) {
      return { ok: false, error: "WhatsApp access token not configured for organization." };
    }
    const res = await sendWhatsAppTemplateMessage({
      credentials,
      toPhone,
      template,
    });
    return { ok: res.ok, error: res.error };
  }

  if (!envWhatsapp.accessToken || !envWhatsapp.phoneNumberId) {
    return { ok: false, error: "WhatsApp API not configured" };
  }

  const res = await sendWhatsAppTemplateMessage({
    credentials: {
      organizationId: "env",
      accessToken: envWhatsapp.accessToken,
      phoneNumberId: envWhatsapp.phoneNumberId,
      wabaId: null,
    },
    toPhone,
    template,
  });
  return { ok: res.ok, error: res.error };
}
