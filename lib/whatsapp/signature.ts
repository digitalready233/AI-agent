import { createHmac, timingSafeEqual } from "node:crypto";
import { isProductionRuntime } from "@/lib/security/production";

export function verifyWhatsAppWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string | null;
  appSecret?: string | null;
}): { valid: boolean; skipped: boolean } {
  const secret =
    params.appSecret?.trim() || process.env.WHATSAPP_APP_SECRET?.trim() || null;

  if (!secret) {
    if (isProductionRuntime()) {
      console.error("[whatsapp] WHATSAPP_APP_SECRET required in production");
      return { valid: false, skipped: false };
    }
    console.warn(
      "[whatsapp] WHATSAPP_APP_SECRET not set — webhook signature verification skipped"
    );
    return { valid: true, skipped: true };
  }

  const header = params.signatureHeader?.trim();
  if (!header?.startsWith("sha256=")) {
    console.warn("[whatsapp] missing or invalid X-Hub-Signature-256 header");
    return { valid: false, skipped: false };
  }

  const expected = createHmac("sha256", secret).update(params.rawBody, "utf8").digest("hex");
  const received = header.slice("sha256=".length);

  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    if (a.length !== b.length) {
      return { valid: false, skipped: false };
    }
    const valid = timingSafeEqual(a, b);
    if (!valid) {
      console.warn("[whatsapp] webhook signature mismatch");
    }
    return { valid, skipped: false };
  } catch {
    return { valid: false, skipped: false };
  }
}
