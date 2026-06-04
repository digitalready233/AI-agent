import { redirect } from "next/navigation";
import { listAgents } from "@/lib/platform/data";
import { getOrganizationSettings } from "@/lib/platform/settings-data";
import type { BillingSettings } from "@/lib/platform/settings-types";
import type { UserRole } from "@/lib/platform/types";
import { isBillingExemptRole } from "./exempt";
import {
  billingBypassed,
  defaultTrialEndsAt,
  hasActiveAccess,
  isBillingEnforced,
} from "./access-client";

export {
  billingBypassed,
  defaultTrialEndsAt,
  hasActiveAccess,
  isBillingEnforced,
} from "./access-client";

export async function requirePlatformAccess(
  organizationId: string,
  pathname?: string,
  role?: UserRole
): Promise<BillingSettings> {
  if (isBillingExemptRole(role)) {
    const settings = await getOrganizationSettings(organizationId);
    return settings.billing;
  }

  if (billingBypassed()) {
    const settings = await getOrganizationSettings(organizationId);
    return settings.billing;
  }

  const settings = await getOrganizationSettings(organizationId);
  const billing = settings.billing;

  if (pathname?.startsWith("/dashboard/billing")) {
    return billing;
  }

  if (!hasActiveAccess(billing)) {
    redirect("/dashboard/billing?reason=subscription_required");
  }

  return billing;
}

export async function assertCanCreateAgent(
  organizationId: string,
  role?: UserRole
): Promise<void> {
  if (isBillingExemptRole(role)) return;
  if (billingBypassed()) return;

  const settings = await getOrganizationSettings(organizationId);
  const billing = settings.billing;

  if (!hasActiveAccess(billing)) {
    throw new Error("Active subscription or trial required to create agents.");
  }

  const agents = await listAgents(organizationId);
  const limit = Math.max(1, billing.agents_allowed ?? 1);
  if (agents.length >= limit) {
    throw new Error(
      `Agent limit reached (${limit}). Upgrade your plan in Billing settings.`
    );
  }
}
