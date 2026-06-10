import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/platform/auth";
import {
  initializePaystackTransaction,
  PAYSTACK_PLANS,
  paystackConfigured,
} from "@/lib/billing/paystack";
import { getOrganizationSettings, patchOrganizationSettingsSection } from "@/lib/platform/settings-data";

export async function POST(req: NextRequest) {
  if (!paystackConfigured()) {
    return NextResponse.json(
      { error: "Paystack is not configured. Add PAYSTACK_SECRET_KEY." },
      { status: 503 }
    );
  }

  const session = await requireSession();
  const body = (await req.json()) as { planId?: string };
  const plan = PAYSTACK_PLANS.find((p) => p.id === body.planId) ?? PAYSTACK_PLANS[0]!;

  const reference = `ds_${session.organization.id.slice(0, 8)}_${randomBytes(6).toString("hex")}`;
  const origin = req.nextUrl.origin;
  const callbackUrl = `${origin}/dashboard/billing?reference=${encodeURIComponent(reference)}`;

  try {
    const tx = await initializePaystackTransaction({
      email: session.email,
      amountGhs: plan.amountGhs,
      reference,
      callbackUrl,
      metadata: {
        organization_id: session.organization.id,
        plan_id: plan.id,
        plan_name: plan.name,
        agents_allowed: String(plan.agentsAllowed),
      },
    });
    return NextResponse.json({
      authorization_url: tx.authorization_url,
      reference: tx.reference,
      plan,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Payment initialization failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("reference");
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const session = await requireSession();
  const { verifyPaystackTransaction } = await import("@/lib/billing/paystack");

  try {
    const tx = await verifyPaystackTransaction(reference);
    if (tx.status !== "success") {
      return NextResponse.json({ status: tx.status, verified: false });
    }

    const meta = tx.metadata ?? {};
    const orgFromMeta =
      typeof meta.organization_id === "string" ? meta.organization_id.trim() : "";
    if (!orgFromMeta || orgFromMeta !== session.organization.id) {
      return NextResponse.json(
        { error: "Payment reference does not belong to this organization." },
        { status: 403 }
      );
    }

    const planName =
      typeof meta.plan_name === "string" ? meta.plan_name : "Growth";
    const agentsAllowed = Number(meta.agents_allowed) || 10;

    const settings = await getOrganizationSettings(session.organization.id);

    if (
      settings.billing.paystack_reference === reference &&
      settings.billing.subscription_status === "active"
    ) {
      return NextResponse.json({
        status: "success",
        verified: true,
        planName: settings.billing.plan_name ?? planName,
        alreadyApplied: true,
      });
    }
    await patchOrganizationSettingsSection(session.organization.id, "billing", {
      ...settings.billing,
      plan_name: planName,
      agents_allowed: agentsAllowed,
      subscription_status: "active",
      paystack_reference: reference,
      paid_at: tx.paid_at ?? new Date().toISOString(),
    });

    return NextResponse.json({ status: "success", verified: true, planName });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verification failed" },
      { status: 500 }
    );
  }
}
