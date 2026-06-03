"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { BillingSettings } from "@/lib/platform/settings-types";
import { billingBypassed, hasActiveAccess } from "@/lib/billing/access-client";

export function BillingGate({ billing }: { billing: BillingSettings }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (billingBypassed()) return;
    if (pathname.startsWith("/dashboard/billing")) return;
    if (hasActiveAccess(billing)) return;
    router.replace("/dashboard/billing?reason=subscription_required");
  }, [billing, pathname, router]);

  return null;
}
