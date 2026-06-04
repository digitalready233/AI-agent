import type { UserRole } from "@/lib/platform/types";

/** Platform operator — built the product; no trial / subscription gate. */
export function isBillingExemptRole(role: UserRole | string | null | undefined): boolean {
  return role === "super_admin";
}

export const PLATFORM_BILLING_ACTIVE = {
  plan_name: "Platform",
  agents_allowed: 999,
  subscription_status: "active" as const,
  trial_ends_at: null,
  paystack_reference: null,
  paid_at: new Date().toISOString(),
};
