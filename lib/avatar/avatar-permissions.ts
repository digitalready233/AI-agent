import type { UserRole } from "@/lib/platform/types";

const CREDENTIAL_ROLES: UserRole[] = ["super_admin", "company_admin"];

const AGENT_AVATAR_CONFIG_ROLES: UserRole[] = [
  "super_admin",
  "company_admin",
  "sales_manager",
];

export function canManageAvatarCredentials(role: UserRole): boolean {
  return CREDENTIAL_ROLES.includes(role);
}

export function canConfigureAgentAvatar(role: UserRole): boolean {
  return AGENT_AVATAR_CONFIG_ROLES.includes(role);
}

export function canUseAvatarInDemo(role: UserRole): boolean {
  return role !== "viewer";
}

export function canForceAvatarFallback(role: UserRole): boolean {
  return AGENT_AVATAR_CONFIG_ROLES.includes(role) || role === "sales_agent";
}

export function canConfigureAvatarRouting(role: UserRole): boolean {
  return AGENT_AVATAR_CONFIG_ROLES.includes(role);
}

export function canSwitchAvatarProviderDuringDemo(role: UserRole): boolean {
  return AGENT_AVATAR_CONFIG_ROLES.includes(role) || role === "sales_agent";
}
