import { isOwnerRole, roleCan, type PlatformCapability, type PlatformRole } from "./platform-roles.ts";

export type AdminApiName =
  | "listPlatformUsers"
  | "setPlatformUserRole"
  | "listTemporaryAdminRequests"
  | "reviewTemporaryAdminRequest"
  | "revokeTemporaryAdmin"
  | "getFinancialReport"
  | "listBillingAccounts"
  | "setAccountTier"
  | "listSiteStories"
  | "moderateSiteStory"
  | "getSystemStatus"
  | "getSiteAdminOverview"
  | "getSiteSettings";

type AdminApiGate =
  | { kind: "permanent_owner" }
  | { kind: "capability"; capability: PlatformCapability };

export const ADMIN_API_GATES: Record<AdminApiName, AdminApiGate> = {
  listPlatformUsers: { kind: "permanent_owner" },
  setPlatformUserRole: { kind: "permanent_owner" },
  listTemporaryAdminRequests: { kind: "permanent_owner" },
  reviewTemporaryAdminRequest: { kind: "permanent_owner" },
  revokeTemporaryAdmin: { kind: "permanent_owner" },
  getFinancialReport: { kind: "capability", capability: "view_finance" },
  listBillingAccounts: { kind: "capability", capability: "manage_billing" },
  setAccountTier: { kind: "capability", capability: "manage_billing" },
  listSiteStories: { kind: "capability", capability: "view_moderation_queue" },
  moderateSiteStory: { kind: "capability", capability: "moderate_public_content" },
  getSystemStatus: { kind: "capability", capability: "view_system_health" },
  getSiteAdminOverview: { kind: "permanent_owner" },
  getSiteSettings: { kind: "permanent_owner" },
};

export const USER_BLOCKED_ADMIN_APIS = Object.keys(ADMIN_API_GATES) as AdminApiName[];

export function canAccessAdminApi(
  role: PlatformRole,
  api: AdminApiName,
  elevated: readonly PlatformCapability[] = [],
) {
  const gate = ADMIN_API_GATES[api];
  if (gate.kind === "permanent_owner") return isOwnerRole(role);
  return roleCan(role, gate.capability) || elevated.includes(gate.capability);
}

export function adminApiDenial(api: AdminApiName) {
  const gate = ADMIN_API_GATES[api];
  if (gate.kind === "permanent_owner") return "Permanent owner access required";
  return `${gate.capability} permission required`;
}

export function assertAdminApiAccess(
  role: PlatformRole,
  api: AdminApiName,
  elevated: readonly PlatformCapability[] = [],
) {
  if (!canAccessAdminApi(role, api, elevated)) {
    throw new Error(adminApiDenial(api));
  }
}

export type SiteAdminPanel =
  | "overview"
  | "stories"
  | "users"
  | "moderation"
  | "finance"
  | "system"
  | "settings";

export type SiteAdminPanelDef = {
  id: SiteAdminPanel;
  label: string;
  description: string;
  capability: PlatformCapability | "permanent_owner" | "manage_own_stories";
};

export const SITE_ADMIN_PANELS: readonly SiteAdminPanelDef[] = [
  { id: "overview", label: "Overview", description: "Site operations snapshot", capability: "permanent_owner" },
  { id: "stories", label: "Stories", description: "Create and edit your catalog", capability: "manage_own_stories" },
  { id: "users", label: "Users & roles", description: "Accounts, roles, and sudo grants", capability: "manage_roles" },
  { id: "moderation", label: "Content", description: "Review and moderate published work", capability: "view_moderation_queue" },
  { id: "finance", label: "Billing & finance", description: "Plans, ledger, and reports", capability: "view_finance" },
  { id: "system", label: "System", description: "Developer health and integrations", capability: "view_system_health" },
  { id: "settings", label: "Settings", description: "Bootstrap owners and site configuration", capability: "permanent_owner" },
];

export function canViewAdminPanel(
  role: PlatformRole,
  panel: SiteAdminPanel,
  capabilities: readonly PlatformCapability[] = [],
) {
  const def = SITE_ADMIN_PANELS.find((item) => item.id === panel);
  if (!def) return false;
  if (def.capability === "permanent_owner") return isOwnerRole(role);
  return roleCan(role, def.capability) || capabilities.includes(def.capability);
}

export function defaultAdminPanel(role: PlatformRole, capabilities: readonly PlatformCapability[] = []): SiteAdminPanel {
  if (isOwnerRole(role)) return "overview";
  if (canViewAdminPanel(role, "moderation", capabilities)) return "moderation";
  if (canViewAdminPanel(role, "system", capabilities)) return "system";
  return "stories";
}

export function visibleAdminPanels(role: PlatformRole, capabilities: readonly PlatformCapability[] = []) {
  return SITE_ADMIN_PANELS.filter((panel) => canViewAdminPanel(role, panel.id, capabilities));
}

export function parseOwnerEmails(raw: string | undefined | null) {
  return (raw || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isBootstrapOwnerEmail(email: string | null | undefined, configuredEmails: readonly string[]) {
  if (!email) return false;
  return configuredEmails.includes(email.trim().toLowerCase());
}

export function resolveDefaultPlatformRole(
  user: { id: string; email: string | null },
  options: { dbSource: string; ownerEmails: readonly string[] },
): PlatformRole {
  const configuredOwner = isBootstrapOwnerEmail(user.email, options.ownerEmails);
  const devOwner = options.dbSource === "pglite" && user.id === "dev-user";
  return configuredOwner || devOwner ? "owner" : "user";
}
