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
