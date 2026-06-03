import { createHmac } from "node:crypto";
import { PAYSTACK_PLANS, type PaystackPlan } from "./paystack-plans";

export type { PaystackPlan };
export { PAYSTACK_PLANS };

const PAYSTACK_BASE = "https://api.paystack.co";
function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  return key;
}

export function paystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());
}

export async function initializePaystackTransaction(params: {
  email: string;
  amountGhs: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, string>;
}): Promise<{ authorization_url: string; access_code: string; reference: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: Math.round(params.amountGhs * 100),
      currency: process.env.PAYSTACK_CURRENCY?.trim() || "GHS",
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata ?? {},
    }),
  });

  const data = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: { authorization_url: string; access_code: string; reference: string };
  };

  if (!res.ok || !data.status || !data.data) {
    throw new Error(data.message ?? "Paystack initialization failed");
  }

  return data.data;
}

export async function verifyPaystackTransaction(reference: string): Promise<{
  status: string;
  amount: number;
  currency: string;
  paid_at?: string;
  metadata?: Record<string, unknown>;
}> {
  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secretKey()}` },
    }
  );

  const data = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: {
      status: string;
      amount: number;
      currency: string;
      paid_at?: string;
      metadata?: Record<string, unknown>;
    };
  };

  if (!res.ok || !data.status || !data.data) {
    throw new Error(data.message ?? "Paystack verification failed");
  }

  return data.data;
}

export function verifyPaystackWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET?.trim() || secretKey();
  if (!signature) return false;
  const hash = createHmac("sha512", secret).update(rawBody).digest("hex");
  return hash === signature;
}
