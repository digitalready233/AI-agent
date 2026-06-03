import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { BillingSettings } from "@/lib/platform/settings-types";

export function isBillingEnforced(): boolean {
  return process.env.BILLING_ENFORCEMENT?.trim() === "true";
}

export function billingBypassed(): boolean {
  return !isSupabaseConfigured() || !isBillingEnforced();
}

export function hasActiveAccess(billing: BillingSettings): boolean {
  if (billing.subscription_status === "active") return true;
  if (billing.trial_ends_at) {
    return new Date(billing.trial_ends_at).getTime() > Date.now();
  }
  if (billing.subscription_status === "trial") return true;
  if (!billing.subscription_status && !billing.trial_ends_at) {
    return !isBillingEnforced();
  }
  return false;
}

export function defaultTrialEndsAt(days = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
