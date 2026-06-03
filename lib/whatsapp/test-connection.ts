import type { WhatsAppCredentials } from "./types";

const GRAPH_VERSION = "v21.0";

export type WhatsAppTestConnectionResult = {
  ok: boolean;
  connection_status: "connected" | "error" | "not_connected";
  display_phone_number?: string | null;
  verified_name?: string | null;
  error?: string;
  checked_at: string;
};

/** Verify token and phone number ID against Meta Graph API. */
export async function testWhatsAppConnection(params: {
  credentials: WhatsAppCredentials;
  webhookUrl: string;
  hasVerifyToken: boolean;
}): Promise<WhatsAppTestConnectionResult> {
  const checked_at = new Date().toISOString();

  if (!params.credentials.accessToken?.trim()) {
    return {
      ok: false,
      connection_status: "not_connected",
      error: "Access token is missing.",
      checked_at,
    };
  }

  if (!params.credentials.phoneNumberId?.trim()) {
    return {
      ok: false,
      connection_status: "not_connected",
      error: "Phone number ID is missing.",
      checked_at,
    };
  }

  if (!params.hasVerifyToken) {
    return {
      ok: false,
      connection_status: "error",
      error: "Webhook verify token is not configured.",
      checked_at,
    };
  }

  if (!params.webhookUrl?.trim()) {
    return {
      ok: false,
      connection_status: "error",
      error: "Webhook callback URL could not be determined.",
      checked_at,
    };
  }

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${params.credentials.phoneNumberId}?fields=display_phone_number,verified_name`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${params.credentials.accessToken}` },
    });

    const data = (await res.json()) as {
      display_phone_number?: string;
      verified_name?: string;
      error?: { message?: string; code?: number };
    };

    if (!res.ok) {
      const errMsg = data.error?.message ?? `Meta API error (${res.status})`;
      console.error("[whatsapp] test connection failed", {
        status: res.status,
        error: errMsg,
      });
      return {
        ok: false,
        connection_status: "error",
        error: errMsg,
        checked_at,
      };
    }

    console.info("[whatsapp] test connection ok", {
      phoneNumberId: params.credentials.phoneNumberId,
      display_phone_number: data.display_phone_number,
    });

    return {
      ok: true,
      connection_status: "connected",
      display_phone_number: data.display_phone_number ?? null,
      verified_name: data.verified_name ?? null,
      checked_at,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    console.error("[whatsapp] test connection exception", { error: msg });
    return {
      ok: false,
      connection_status: "error",
      error: msg,
      checked_at,
    };
  }
}
