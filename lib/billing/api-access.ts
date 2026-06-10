import { hasActiveAccess, isBillingEnforced, billingBypassed } from "@/lib/billing/access-client";
import { isBillingExemptApiPath } from "@/lib/billing/api-exempt-paths";
import { isBillingExemptRole } from "@/lib/billing/exempt";
import { getOrganizationSettings } from "@/lib/platform/settings-data";
import type { SessionContext } from "@/lib/platform/types";

export { BILLING_EXEMPT_API_PREFIXES, isBillingExemptApiPath } from "@/lib/billing/api-exempt-paths";

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
