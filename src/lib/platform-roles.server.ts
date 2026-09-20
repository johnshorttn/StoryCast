import { capabilitiesForRole, normalizePlatformRole, roleCan, type PlatformCapability, type PlatformRole } from "./platform-roles";
import { parseOwnerEmails, resolveDefaultPlatformRole } from "./platform-admin";
import type { VerifiedUser } from "./auth/verify.server";

export function configuredOwnerEmails() {
  return parseOwnerEmails(process.env.STORYCAST_OWNER_EMAILS);
}

export async function ensurePlatformRole(user: VerifiedUser): Promise<PlatformRole> {
  const { getSql, dbSource } = await import("./db");
  const sql = await getSql();
  const defaultRole = resolveDefaultPlatformRole(user, {
    dbSource,
    ownerEmails: configuredOwnerEmails(),
  });
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

export async function currentPlatformAccess() {
  const { requireUser } = await import("./auth/verify.server");
  const user = await requireUser();
  const role = await ensurePlatformRole(user);
  const elevatedCapabilities = await activeElevatedCapabilities(user.id);
  const capabilities = [...new Set([...capabilitiesForRole(role), ...elevatedCapabilities])];
  return { user, role, capabilities, elevatedCapabilities, elevated: elevatedCapabilities.length > 0 };
}

export async function requirePlatformCapability(capability: PlatformCapability) {
  const access = await currentPlatformAccess();
  if (roleCan(access.role, capability) || access.elevatedCapabilities.includes(capability)) {
    return access;
  }
  throw new Error(`${capability} permission required`);
}

export async function requirePermanentOwner() {
  const access = await currentPlatformAccess();
  if (access.role !== "owner") throw new Error("Permanent owner access required");
  return access;
}
