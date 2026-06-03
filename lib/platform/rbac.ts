import { redirect } from "next/navigation";
import type { SessionContext, UserRole } from "./types";

export type Permission =
  | "dashboard.view"
  | "analytics.view"
  | "agents.view"
  | "agents.manage"
  | "knowledge.view"
  | "knowledge.manage"
  | "leads.view"
  | "leads.manage"
  | "conversations.view"
  | "conversations.manage"
  | "bookings.view"
  | "bookings.manage"
  | "campaigns.view"
  | "campaigns.manage"
  | "webhooks.manage"
  | "integrations.manage"
  | "team.view"
  | "team.manage"
  | "settings.view"
  | "settings.manage";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    "dashboard.view",
    "analytics.view",
    "agents.view",
    "agents.manage",
    "knowledge.view",
    "knowledge.manage",
    "leads.view",
    "leads.manage",
    "conversations.view",
    "conversations.manage",
    "bookings.view",
    "bookings.manage",
    "campaigns.view",
    "campaigns.manage",
    "webhooks.manage",
    "integrations.manage",
    "team.view",
    "team.manage",
    "settings.view",
    "settings.manage",
  ],
  sales_manager: [
    "dashboard.view",
    "analytics.view",
    "agents.view",
    "agents.manage",
    "knowledge.view",
    "knowledge.manage",
    "leads.view",
    "leads.manage",
    "conversations.view",
    "conversations.manage",
    "bookings.view",
    "bookings.manage",
    "campaigns.view",
    "campaigns.manage",
    "webhooks.manage",
    "integrations.manage",
    "team.view",
    "team.manage",
    "settings.view",
    "settings.manage",
  ],
  company_admin: [
    "dashboard.view",
    "analytics.view",
    "agents.view",
    "agents.manage",
    "knowledge.view",
    "knowledge.manage",
    "leads.view",
    "leads.manage",
    "conversations.view",
    "conversations.manage",
    "bookings.view",
    "bookings.manage",
    "campaigns.view",
    "campaigns.manage",
    "webhooks.manage",
    "integrations.manage",
    "team.view",
    "team.manage",
    "settings.view",
    "settings.manage",
  ],
  sales_agent: [
    "dashboard.view",
    "analytics.view",
    "agents.view",
    "agents.manage",
    "knowledge.view",
    "knowledge.manage",
    "leads.view",
    "leads.manage",
    "conversations.view",
    "conversations.manage",
    "bookings.view",
    "bookings.manage",
    "campaigns.view",
    "settings.view",
  ],
  support_agent: [
    "dashboard.view",
    "analytics.view",
    "agents.view",
    "knowledge.view",
    "knowledge.manage",
    "leads.view",
    "conversations.view",
    "conversations.manage",
    "bookings.view",
    "bookings.manage",
    "settings.view",
  ],
  viewer: [
    "dashboard.view",
    "analytics.view",
    "agents.view",
    "knowledge.view",
    "leads.view",
    "conversations.view",
    "bookings.view",
    "campaigns.view",
    "settings.view",
  ],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Platform Admin",
  company_admin: "Company Admin",
  sales_manager: "Sales Manager",
  sales_agent: "Sales Agent",
  support_agent: "Support Agent",
  viewer: "Viewer",
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function requirePermission(
  session: SessionContext,
  permission: Permission
): void {
  if (!can(session.profile.role, permission)) {
    redirect("/dashboard?error=forbidden");
  }
}

/** Nav href → permission required to see the link */
export const NAV_PERMISSIONS: Record<string, Permission> = {
  "/dashboard": "dashboard.view",
  "/dashboard/analytics": "analytics.view",
  "/dashboard/agents": "agents.view",
  "/dashboard/agents/new": "agents.manage",
  "/dashboard/knowledge": "knowledge.view",
  "/dashboard/leads": "leads.view",
  "/dashboard/conversations": "conversations.view",
  "/dashboard/bookings": "bookings.view",
  "/dashboard/campaigns": "campaigns.view",
  "/dashboard/webhooks": "webhooks.manage",
  "/dashboard/integrations": "integrations.manage",
  "/dashboard/team": "team.view",
  "/dashboard/billing": "settings.view",
  "/dashboard/settings": "settings.view",
};

export function canAccessNav(role: UserRole, href: string): boolean {
  const permission = NAV_PERMISSIONS[href];
  if (!permission) return true;
  return can(role, permission);
}
