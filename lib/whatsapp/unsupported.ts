import { messageExistsByWhatsAppId } from "@/lib/platform/data";
import { resolveWhatsAppCredentials } from "./credentials";
import { sendWhatsAppTextMessage } from "./client";
import { findOrganizationByPhoneNumberId } from "./settings-data";
import type { InboundUnsupportedWhatsAppMessage } from "./types";

const AUTO_REPLIES: Record<string, string> = {
  image:
    "Thanks for your message. I can read text messages here — please type your question and I'll help right away.",
  audio:
    "Thanks for the voice note. Please send your message as text so our assistant can respond accurately.",
  video:
    "Thanks for the video. Please send a short text message describing what you need and we'll assist you.",
  document:
    "Thanks for the file. Please describe your request in a text message so we can help you properly.",
  sticker:
    "Thanks! How can we help you today? Send a text message and our assistant will reply.",
  location:
    "Thanks for sharing your location. Please tell us what you need in a text message.",
  contacts:
    "Thanks for the contact. Please send your question as text and we'll get back to you.",
  unknown:
    "Thanks for your message. Please send text so our AI assistant can help you.",
};

function autoReplyForType(messageType: string): string {
  return AUTO_REPLIES[messageType] ?? AUTO_REPLIES.unknown;
}

export async function processUnsupportedWhatsAppMessage(
  inbound: InboundUnsupportedWhatsAppMessage
): Promise<{ status: "ok" | "ignored" | "error" }> {
  console.info("[whatsapp] unsupported inbound", {
    type: inbound.messageType,
    wamid: inbound.whatsappMessageId,
    from: inbound.fromPhone,
  });

  if (await messageExistsByWhatsAppId(inbound.whatsappMessageId)) {
    return { status: "ignored" };
  }

  const orgSettings = await findOrganizationByPhoneNumberId(inbound.phoneNumberId);
  if (!orgSettings) {
    return { status: "ignored" };
  }

  const credentials = await resolveWhatsAppCredentials({
    organizationId: orgSettings.organization_id,
    phoneNumberId: inbound.phoneNumberId,
    wabaId: orgSettings.waba_id,
  });

  if (!credentials) {
    return { status: "error" };
  }

  const res = await sendWhatsAppTextMessage({
    credentials,
    toPhone: inbound.fromPhone,
    body: autoReplyForType(inbound.messageType),
  });

  return res.ok ? { status: "ok" } : { status: "error" };
}
