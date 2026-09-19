export type PlatformRole = "owner" | "developer" | "moderator" | "user";
export type PlatformCapability =
  | "manage_own_stories"
  | "redeem_gifts"
  | "moderate_public_content"
  | "view_moderation_queue"
  | "view_system_health"
  | "manage_integrations"
  | "view_finance"
  | "manage_billing"
  | "manage_roles";

const ROLE_CAPABILITIES: Record<PlatformRole, readonly PlatformCapability[]> = {
  user: ["manage_own_stories", "redeem_gifts"],
  moderator: ["manage_own_stories", "redeem_gifts", "moderate_public_content", "view_moderation_queue"],
  developer: ["manage_own_stories", "redeem_gifts", "view_system_health", "manage_integrations"],
  owner: [
    "manage_own_stories", "redeem_gifts", "moderate_public_content", "view_moderation_queue",
    "view_system_health", "manage_integrations", "view_finance", "manage_billing", "manage_roles",
  ],
};

export function normalizePlatformRole(value: unknown): PlatformRole {
  return value === "owner" || value === "developer" || value === "moderator" ? value : "user";
}

export function roleCan(role: PlatformRole, capability: PlatformCapability) {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export function capabilitiesForRole(role: PlatformRole) {
  return [...ROLE_CAPABILITIES[role]];
}

export const TEMPORARILY_GRANTABLE_CAPABILITIES: readonly PlatformCapability[] = [
  "moderate_public_content", "view_moderation_queue", "view_system_health",
  "manage_integrations", "view_finance", "manage_billing",
];
