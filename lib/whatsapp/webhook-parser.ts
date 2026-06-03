import { resolveReadybotButtonReplyText } from "./readybot-interactive";
import type { InboundUnsupportedWhatsAppMessage, InboundWhatsAppMessage } from "./types";

type WebhookBody = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          interactive?: {
            type?: string;
            button_reply?: { id?: string; title?: string };
            list_reply?: { id?: string; title?: string };
          };
        }>;
        statuses?: unknown[];
      };
    }>;
  }>;
};

export function parseInboundWhatsAppMessages(
  body: WebhookBody
): InboundWhatsAppMessage[] {
  if (body.object !== "whatsapp_business_account") return [];

  const results: InboundWhatsAppMessage[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const contactName =
        value?.contacts?.[0]?.profile?.name?.trim() ??
        value?.contacts?.find((c) => c.wa_id)?.profile?.name?.trim() ??
        null;

      for (const msg of value?.messages ?? []) {
        if (!msg.id || !msg.from) continue;

        if (msg.type === "interactive" && msg.interactive) {
          const buttonId =
            msg.interactive.button_reply?.id ??
            msg.interactive.list_reply?.id ??
            null;
          const mapped = buttonId
            ? resolveReadybotButtonReplyText(buttonId)
            : null;
          const title =
            msg.interactive.button_reply?.title ??
            msg.interactive.list_reply?.title ??
            "";
          const text =
            mapped?.trim() ||
            title.trim() ||
            (buttonId ? `Selected: ${buttonId}` : "");
          if (!text) continue;

          results.push({
            whatsappMessageId: msg.id,
            fromPhone: msg.from,
            phoneNumberId,
            text,
            customerName: contactName,
            timestamp: msg.timestamp ?? new Date().toISOString(),
            interactiveButtonId: buttonId,
          });
          continue;
        }

        if (msg.type !== "text" || !msg.text?.body?.trim()) continue;

        results.push({
          whatsappMessageId: msg.id,
          fromPhone: msg.from,
          phoneNumberId,
          text: msg.text.body.trim(),
          customerName: contactName,
          timestamp: msg.timestamp ?? new Date().toISOString(),
        });
      }
    }
  }

  return results;
}

export function parseUnsupportedWhatsAppMessages(
  body: WebhookBody
): InboundUnsupportedWhatsAppMessage[] {
  if (body.object !== "whatsapp_business_account") return [];

  const results: InboundUnsupportedWhatsAppMessage[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const contactName =
        value?.contacts?.[0]?.profile?.name?.trim() ??
        value?.contacts?.find((c) => c.wa_id)?.profile?.name?.trim() ??
        null;

      for (const msg of value?.messages ?? []) {
        if (!msg.id || !msg.from) continue;
        if (msg.type === "text" || msg.type === "interactive") continue;

        results.push({
          whatsappMessageId: msg.id,
          fromPhone: msg.from,
          phoneNumberId,
          messageType: msg.type ?? "unknown",
          customerName: contactName,
          timestamp: msg.timestamp ?? new Date().toISOString(),
        });
      }
    }
  }

  return results;
}

export function isWhatsAppStatusOnlyWebhook(body: WebhookBody): boolean {
  if (body.object !== "whatsapp_business_account") return false;
  let hasStatus = false;
  let hasMessage = false;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (value?.statuses?.length) hasStatus = true;
      if (value?.messages?.length) hasMessage = true;
    }
  }
  return hasStatus && !hasMessage;
}
