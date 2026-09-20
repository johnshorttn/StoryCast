import { capabilitiesForRole, normalizePlatformRole, roleCan, type PlatformCapability, type PlatformRole } from "./platform-roles";
import type { VerifiedUser } from "./auth/verify.server";

function configuredOwnerEmails() {
  return (process.env.STORYCAST_OWNER_EMAILS || "")
    .split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export async function ensurePlatformRole(user: VerifiedUser): Promise<PlatformRole> {
  const { getSql, dbSource } = await import("./db");
  const sql = await getSql();
  const configuredOwner = Boolean(user.email && configuredOwnerEmails().includes(user.email.toLowerCase()));
  const devOwner = dbSource === "pglite" && user.id === "dev-user";
  const defaultRole: PlatformRole = configuredOwner || devOwner ? "owner" : "user";
  await sql.query(
    `insert into user_roles (user_id, role) values ($1, $2)
     on conflict (user_id) do update set role = 'owner', updated_at = now()
     where $2 = 'owner' and user_roles.role <> 'owner'`,
    [user.id, defaultRole],
  );
  const rows = await sql<{ role: string }>`select role from user_roles where user_id = ${user.id}`;
  return normalizePlatformRole(rows[0]?.role);
}

export async function activeElevatedCapabilities(userId: string): Promise<PlatformCapability[]> {
  const { getSql } = await import("./db");
  const sql = await getSql();
  const grants = await sql<{ requested_capabilities: PlatformCapability[] | string }>`
    select requested_capabilities from privilege_elevation_requests
    where user_id = ${userId} and status = 'approved' and approved_until > now()
  `;
  return [...new Set(grants.flatMap((grant) => {
    const value = typeof grant.requested_capabilities === "string"
      ? JSON.parse(grant.requested_capabilities) as PlatformCapability[]
      : grant.requested_capabilities;
    return Array.isArray(value) ? value : [];
  }))];
}

export async function requirePlatformCapability(capability: PlatformCapability) {
  const { requireUser } = await import("./auth/verify.server");
  const user = await requireUser();
  const role = await ensurePlatformRole(user);
  const baseCapabilities = capabilitiesForRole(role);
  if (roleCan(role, capability)) return { user, role, capabilities: baseCapabilities, elevated: false };
  const elevatedCapabilities = await activeElevatedCapabilities(user.id);
  if (!elevatedCapabilities.includes(capability)) throw new Error(`${capability} permission required`);
  return { user, role, capabilities: [...new Set([...baseCapabilities, ...elevatedCapabilities])], elevated: true };
}

export async function requirePermanentOwner() {
  const { requireUser } = await import("./auth/verify.server");
  const user = await requireUser();
  const role = await ensurePlatformRole(user);
  if (role !== "owner") throw new Error("Permanent owner access required");
  return { user, role };
}
