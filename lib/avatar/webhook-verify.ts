import { createHmac, timingSafeEqual } from "node:crypto";
import { isProductionRuntime } from "@/lib/security/production";

function verifyHmacHeader(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  prefix: string
): boolean {
  const header = signatureHeader?.trim();
  if (!header?.startsWith(prefix)) return false;

  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = header.slice(prefix.length);

  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyDidWebhookRequest(
  req: Request,
  rawBody: string
): { ok: boolean; skipped: boolean } {
  const secret = process.env.DID_WEBHOOK_SECRET?.trim();
  if (!secret) {
    if (isProductionRuntime()) {
      console.error("[did webhook] DID_WEBHOOK_SECRET required in production");
      return { ok: false, skipped: false };
    }
    return { ok: true, skipped: true };
  }

  const sig =
    req.headers.get("x-did-signature") ??
    req.headers.get("x-hub-signature-256");
  const valid = verifyHmacHeader(rawBody, sig, secret, "sha256=");
  return { ok: valid, skipped: false };
}

export function verifyTavusWebhookRequest(
  req: Request,
  rawBody: string
): { ok: boolean; skipped: boolean } {
  const secret = process.env.TAVUS_WEBHOOK_SECRET?.trim();
  if (!secret) {
    if (isProductionRuntime()) {
      console.error("[tavus webhook] TAVUS_WEBHOOK_SECRET required in production");
      return { ok: false, skipped: false };
    }
    return { ok: true, skipped: true };
  }

  const sig = req.headers.get("x-tavus-signature");
  const valid = verifyHmacHeader(rawBody, sig, secret, "sha256=");
  return { ok: valid, skipped: false };
}
