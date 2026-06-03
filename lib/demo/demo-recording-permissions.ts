import type { SessionContext } from "@/lib/platform/types";
import type { DemoSession } from "./types";

const RECORDING_ADMIN_ROLES = new Set([
  "super_admin",
  "company_admin",
  "sales_manager",
]);

function isAssignedSalesAgent(ctx: SessionContext, session: DemoSession): boolean {
  if (ctx.profile.role !== "sales_agent") return false;
  const assigned =
    session.human_takeover_by === ctx.userId ||
    session.metadata?.assigned_staff_id === ctx.userId ||
    session.metadata?.active_staff_user_id === ctx.userId;
  return assigned;
}

/** Start/stop recording in the live demo room or dashboard. */
export function canControlDemoRecording(
  ctx: SessionContext,
  session: DemoSession
): boolean {
  if (session.organization_id !== ctx.organization.id) return false;
  if (RECORDING_ADMIN_ROLES.has(ctx.profile.role)) return true;
  return isAssignedSalesAgent(ctx, session);
}

export function canViewDemoRecording(
  ctx: SessionContext,
  session?: DemoSession
): boolean {
  if (!session) return RECORDING_ADMIN_ROLES.has(ctx.profile.role);
  if (session.organization_id !== ctx.organization.id) return false;
  if (RECORDING_ADMIN_ROLES.has(ctx.profile.role)) return true;
  if (isAssignedSalesAgent(ctx, session)) return true;
  if (ctx.profile.role === "viewer") {
    return session.metadata?.viewer_can_watch_recordings === true;
  }
  return false;
}

export function canDeleteDemoRecording(ctx: SessionContext): boolean {
  return RECORDING_ADMIN_ROLES.has(ctx.profile.role);
}

export function canMarkDemoReviewed(ctx: SessionContext): boolean {
  return RECORDING_ADMIN_ROLES.has(ctx.profile.role);
}

export function canAddFollowUpNotes(ctx: SessionContext, session: DemoSession): boolean {
  if (RECORDING_ADMIN_ROLES.has(ctx.profile.role)) return true;
  return isAssignedSalesAgent(ctx, session);
}
