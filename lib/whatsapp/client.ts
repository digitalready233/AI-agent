import type { WhatsAppCredentials, WhatsAppTemplateSendParams } from "./types";
import type { WhatsAppReplyButton } from "./readybot-interactive";

const GRAPH_VERSION = "v21.0";

function normalizePhone(toPhone: string): string {
  return toPhone.replace(/\D/g, "");
}

export async function sendWhatsAppTextMessage(params: {
  credentials: WhatsAppCredentials;
  toPhone: string;
  body: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const to = normalizePhone(params.toPhone);
  const text = params.body.trim();
  if (!to || !text) {
    return { ok: false, error: "Missing recipient or message body." };
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${params.credentials.phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: text.slice(0, 4096) },
      }),
    });

    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number };
    };

    if (!res.ok) {
      const errMsg =
        data.error?.message ?? `WhatsApp API error (${res.status})`;
      console.error("[whatsapp] send failed", {
        status: res.status,
        to,
        phoneNumberId: params.credentials.phoneNumberId,
        error: errMsg,
      });
      return { ok: false, error: errMsg };
    }

    const messageId = data.messages?.[0]?.id;
    console.info("[whatsapp] message sent", {
      to,
      messageId,
      phoneNumberId: params.credentials.phoneNumberId,
    });
    return { ok: true, messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    console.error("[whatsapp] send exception", { to, error: msg });
    return { ok: false, error: msg };
  }
}

export async function sendWhatsAppInteractiveButtons(params: {
  credentials: WhatsAppCredentials;
  toPhone: string;
  body: string;
  buttons: WhatsAppReplyButton[];
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const to = normalizePhone(params.toPhone);
  const body = params.body.trim().slice(0, 1024);
  const buttons = params.buttons.slice(0, 3);
  if (!to || !body || buttons.length === 0) {
    return { ok: false, error: "Missing recipient, body, or buttons." };
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${params.credentials.phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: body },
          action: {
            buttons: buttons.map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title.slice(0, 20) },
            })),
          },
        },
      }),
    });

    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number };
    };

    if (!res.ok) {
      const errMsg =
        data.error?.message ?? `WhatsApp API error (${res.status})`;
      console.error("[whatsapp] interactive send failed", {
        status: res.status,
        to,
        error: errMsg,
      });
      return { ok: false, error: errMsg };
    }

    return { ok: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: msg };
  }
}

export async function sendWhatsAppTemplateMessage(params: {
  credentials: WhatsAppCredentials;
  toPhone: string;
  template: WhatsAppTemplateSendParams;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const to = normalizePhone(params.toPhone);
  if (!to) {
    return { ok: false, error: "Missing recipient phone." };
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${params.credentials.phoneNumberId}/messages`;

  const components =
    params.template.bodyParameters && params.template.bodyParameters.length > 0
      ? [
          {
            type: "body",
            parameters: params.template.bodyParameters.map((text) => ({
              type: "text",
              text: text.slice(0, 1024),
            })),
          },
        ]
      : undefined;

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: params.template.templateName,
      language: { code: params.template.languageCode },
      ...(components ? { components } : {}),
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number };
    };

    if (!res.ok) {
      const errMsg =
        data.error?.message ?? `WhatsApp template API error (${res.status})`;
      console.error("[whatsapp] template send failed", {
        template: params.template.templateName,
        to,
        error: errMsg,
      });
      return { ok: false, error: errMsg };
    }

    console.info("[whatsapp] template sent", {
      template: params.template.templateName,
      to,
      messageId: data.messages?.[0]?.id,
    });
    return { ok: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: msg };
  }
}

export async function markWhatsAppMessageRead(params: {
  credentials: WhatsAppCredentials;
  whatsappMessageId: string;
}): Promise<void> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${params.credentials.phoneNumberId}/messages`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: params.whatsappMessageId,
      }),
    });
  } catch (err) {
    console.warn("[whatsapp] mark read failed", err);
  }
}
