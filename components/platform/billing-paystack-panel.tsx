"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PAYSTACK_PLANS } from "@/lib/billing/paystack-plans";
import type { BillingSettings } from "@/lib/platform/settings-types";
import { hasActiveAccess } from "@/lib/billing/access-client";

export function BillingPaystackPanel({ billing }: { billing: BillingSettings }) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const active = hasActiveAccess(billing);

  useEffect(() => {
    const ref = searchParams.get("reference");
    if (!ref) return;
    void (async () => {
      try {
        const res = await fetch(
          `/api/billing/paystack/initialize?reference=${encodeURIComponent(ref)}`
        );
        const data = await res.json();
        if (data.verified) {
          toast.success(`Payment confirmed — ${data.planName} plan active.`);
          window.location.href = "/dashboard/billing";
        }
      } catch {
        toast.error("Could not verify payment.");
      }
    })();
  }, [searchParams]);

  async function checkout(planId: string) {
    setLoading(planId);
    try {
      const res = await fetch("/api/billing/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.authorization_url as string;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card className="platform-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-amber-400" />
            Subscription & access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p>
            Plan: <strong>{billing.plan_name}</strong> · Agents allowed:{" "}
            <strong>{billing.agents_allowed}</strong>
          </p>
          <p>
            Status:{" "}
            <Badge variant={active ? "default" : "destructive"}>
              {billing.subscription_status ?? "trial"}
            </Badge>
          </p>
          {billing.trial_ends_at ? (
            <p className="text-slate-400">
              Trial ends: {new Date(billing.trial_ends_at).toLocaleString()}
            </p>
          ) : null}
          {searchParams.get("reason") === "subscription_required" ? (
            <p className="text-amber-200/90">
              Full workspace access requires an active trial or paid plan. Choose a plan below.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {PAYSTACK_PLANS.map((plan) => (
          <Card key={plan.id} className="platform-card-hover">
            <CardHeader>
              <CardTitle className="text-base">{plan.name}</CardTitle>
              <p className="text-2xl font-bold text-amber-200">
                GHS {plan.amountGhs}
                <span className="text-xs font-normal text-slate-500"> / mo</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-slate-400">{plan.description}</p>
              <p className="text-xs text-slate-500">Up to {plan.agentsAllowed} agents</p>
              <Button
                className="w-full"
                onClick={() => checkout(plan.id)}
                disabled={loading !== null}
              >
                {loading === plan.id ? (
                  "Redirecting…"
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pay with Paystack
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Secure checkout via Paystack. Configure PAYSTACK_SECRET_KEY and webhook URL{" "}
        <code className="text-slate-400">/api/billing/paystack/webhook</code> in production.
      </p>
    </div>
  );
}
