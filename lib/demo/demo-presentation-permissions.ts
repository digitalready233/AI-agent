import type { SessionContext } from "@/lib/platform/types";
import type { DemoSession } from "./types";

const SCREEN_SHARE_ROLES = new Set([
  "platform_admin",
  "company_admin",
  "sales_manager",
  "sales_agent",
  "support_agent",
]);

const PRESENTATION_CONTROL_ROLES = new Set([
  "platform_admin",
  "company_admin",
  "sales_manager",
  "sales_agent",
]);

export function canShareDemoScreen(ctx: SessionContext, session?: DemoSession): boolean {
  const role = ctx.profile.role;
  if (!SCREEN_SHARE_ROLES.has(role)) return false;
  if (role === "support_agent" && session?.demo_type === "sales") return false;
  return true;
}

export function canControlDemoPresentation(
  ctx: SessionContext,
  _session?: DemoSession
): boolean {
  return PRESENTATION_CONTROL_ROLES.has(ctx.profile.role);
}

export function canViewPresentationEvents(ctx: SessionContext): boolean {
  return ctx.profile.role !== "viewer";
}
