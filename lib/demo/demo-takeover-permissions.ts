import type { UserRole } from "@/lib/platform/types";
import type { DemoSession } from "./types";

const TAKEOVER_ROLES: UserRole[] = [
  "super_admin",
  "company_admin",
  "sales_manager",
  "sales_agent",
];

export function canJoinLiveDemo(role: UserRole, session?: DemoSession): boolean {
  if (TAKEOVER_ROLES.includes(role)) return true;
  if (role === "support_agent") {
    return isSupportRelatedDemo(session);
  }
  return false;
}

export function isSupportRelatedDemo(session?: DemoSession): boolean {
  if (!session) return false;
  const intent = (session.detected_intent ?? "").toLowerCase();
  const meta = session.metadata ?? {};
  if (meta.support_demo === true) return true;
  if (intent.includes("support") || intent.includes("complaint")) return true;
  if (session.handoff_reason === "complaint") return true;
  return false;
}
