import { whatsapp } from "@/lib/config";
import { renderCampaignMessage } from "@/lib/platform/campaign-message";
import type { CampaignFollowUpRules } from "@/lib/platform/campaign-types";
import type { Lead } from "@/lib/platform/types";
import { hasWhatsAppAccessToken } from "@/lib/whatsapp/credentials";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings-data";
import type { WhatsAppMessageTemplate } from "@/lib/whatsapp/types";
import { sendWhatsAppTemplate, sendWhatsAppText } from "./whatsapp";

export async function whatsappCampaignConfigured(
  organizationId?: string
): Promise<boolean> {
  if (organizationId) {
    const settings = await getWhatsAppSettings(organizationId);
    const hasToken = await hasWhatsAppAccessToken(organizationId);
    return Boolean(settings.phone_number_id?.trim() && hasToken);
  }
  return Boolean(whatsapp.accessToken?.trim() && whatsapp.phoneNumberId?.trim());
}

function toMetaLanguageCode(language: string): string {
  const normalized = language.trim().replace("-", "_");
  if (normalized.includes("_")) return normalized;
  if (normalized === "en") return "en_US";
  return normalized;
}

function resolveApprovedTemplate(
  templates: WhatsAppMessageTemplate[],
  rules: CampaignFollowUpRules
): WhatsAppMessageTemplate | null {
  if (!rules.whatsapp_template_id) return null;
  const t = templates.find((x) => x.id === rules.whatsapp_template_id);
  if (!t || t.status !== "approved") return null;
  const metaName = t.meta_template_name?.trim() || t.name.trim();
  if (!metaName) return null;
  return t;
}

export async function sendCampaignWhatsApp(
  phone: string,
  body: string,
  organizationId?: string,
  options?: {
    lead?: Lead;
    followUpRules?: CampaignFollowUpRules;
    companyName?: string;
  }
): Promise<{ ok: boolean; error?: string; usedTemplate?: boolean }> {
  const configured = await whatsappCampaignConfigured(organizationId);
  if (!configured) {
    return {
      ok: false,
      error: organizationId
        ? "WhatsApp not configured for this organization. Set credentials in Integrations → WhatsApp."
        : "WhatsApp not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.",
    };
  }

  if (organizationId && options?.followUpRules) {
    const settings = await getWhatsAppSettings(organizationId);
    const template = resolveApprovedTemplate(
      settings.message_templates,
      options.followUpRules
    );

    if (template) {
      const metaName = template.meta_template_name?.trim() || template.name.trim();
      const lead = options.lead;
      const bodyParams =
        options.followUpRules.whatsapp_template_parameters ??
        (lead
          ? [
              renderCampaignMessage("{{name}}", lead, {
                companyName: options.companyName,
              }),
            ]
          : undefined);

      const res = await sendWhatsAppTemplate(
        phone,
        {
          templateName: metaName,
          languageCode: toMetaLanguageCode(template.language),
          bodyParameters: bodyParams,
        },
        organizationId
      );
      if (res.ok) {
        return { ok: true, usedTemplate: true };
      }
      console.warn("[campaign] template send failed, falling back to text", res.error);
    }
  }

  const res = await sendWhatsAppText(phone, body, organizationId);
  return { ok: res.ok, error: res.error, usedTemplate: false };
}
