import { hasActiveAccess, isBillingEnforced, billingBypassed } from "@/lib/billing/access-client";
import { isBillingExemptRole } from "@/lib/billing/exempt";
import { getOrganizationSettings } from "@/lib/platform/settings-data";
import type { SessionContext } from "@/lib/platform/types";

/** API routes that stay usable without an active subscription (billing UI, settings). */
export const BILLING_EXEMPT_API_PREFIXES = [
  "/api/billing/",
  "/api/platform/settings",
  "/api/platform/organization",
  "/api/auth/",
] as const;

export function isBillingExemptApiPath(pathname: string): boolean {
  return BILLING_EXEMPT_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p)
  );
}

export async function organizationLacksPlatformAccess(
  organizationId: string,
  role?: string | null
): Promise<boolean> {
  if (billingBypassed() || !isBillingEnforced()) return false;
  if (isBillingExemptRole(role)) return false;

  const settings = await getOrganizationSettings(organizationId);
  return !hasActiveAccess(settings.billing);
}

export async function assertPlatformApiBilling(ctx: SessionContext, pathname: string): Promise<void> {
  if (isBillingExemptApiPath(pathname)) return;
  if (await organizationLacksPlatformAccess(ctx.organization.id, ctx.profile.role)) {
    throw new PlatformBillingRequiredError();
  }
}

export class PlatformBillingRequiredError extends Error {
  readonly status = 402;
  constructor() {
    super("Active subscription or trial required.");
    this.name = "PlatformBillingRequiredError";
  }
}
