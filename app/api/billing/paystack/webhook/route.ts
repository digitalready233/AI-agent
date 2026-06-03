import { NextRequest, NextResponse } from "next/server";
import {
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from "@/lib/billing/paystack";
import { getOrganizationSettings, patchOrganizationSettingsSection } from "@/lib/platform/settings-data";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyPaystackWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    event?: string;
    data?: { reference?: string; status?: string; metadata?: Record<string, unknown> };
  };

  if (event.event !== "charge.success" || !event.data?.reference) {
    return NextResponse.json({ received: true });
  }

  const tx = await verifyPaystackTransaction(event.data.reference);
  if (tx.status !== "success") {
    return NextResponse.json({ received: true });
  }

  const meta = tx.metadata ?? {};
  const orgId = typeof meta.organization_id === "string" ? meta.organization_id : null;
  if (!orgId) {
    return NextResponse.json({ received: true });
  }

  const settings = await getOrganizationSettings(orgId);
  await patchOrganizationSettingsSection(orgId, "billing", {
    ...settings.billing,
    plan_name: typeof meta.plan_name === "string" ? meta.plan_name : settings.billing.plan_name,
    agents_allowed: Number(meta.agents_allowed) || settings.billing.agents_allowed,
    subscription_status: "active",
    paystack_reference: event.data.reference,
    paid_at: tx.paid_at ?? new Date().toISOString(),
  });

  return NextResponse.json({ received: true });
}
