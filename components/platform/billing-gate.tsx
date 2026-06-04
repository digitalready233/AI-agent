"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { BillingSettings } from "@/lib/platform/settings-types";
import { billingBypassed, hasActiveAccess } from "@/lib/billing/access-client";
import { isBillingExemptRole } from "@/lib/billing/exempt";
import type { UserRole } from "@/lib/platform/types";

export function BillingGate({
  billing,
  role,
}: {
  billing: BillingSettings;
  role?: UserRole;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isBillingExemptRole(role)) return;
    if (billingBypassed()) return;
    if (pathname.startsWith("/dashboard/billing")) return;
    if (hasActiveAccess(billing)) return;
    router.replace("/dashboard/billing?reason=subscription_required");
  }, [billing, pathname, role, router]);

  return null;
}
