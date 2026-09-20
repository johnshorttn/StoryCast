import { createServerFn } from "@tanstack/react-start";
import { effectiveEntitlements, normalizeTier, type AccountTier } from "./account-tiers";
import { assertAdminApiAccess } from "./platform-admin";
import { normalizePlatformRole, type PlatformRole } from "./platform-roles";
import { currentPlatformAccess, requirePermanentOwner } from "./platform-roles.server";

async function accountTierFor(userId: string): Promise<AccountTier> {
  const { getSql } = await import("./db");
  const sql = await getSql();
  await sql`insert into user_tiers (user_id) values (${userId}) on conflict (user_id) do nothing`;
  const rows = await sql<{ tier: string }>`select tier from user_tiers where user_id = ${userId} and status = 'active'
    and (current_period_end is null or current_period_end > now())`;
  return normalizeTier(rows[0]?.tier);
}

export const getCurrentPlatformRole = createServerFn({ method: "GET" }).handler(async () => {
  const access = await currentPlatformAccess();
  const tier = await accountTierFor(access.user.id);
  return {
    role: access.role,
    capabilities: access.capabilities,
    elevatedCapabilities: access.elevatedCapabilities,
    tier,
    entitlements: effectiveEntitlements(access.role, tier),
  };
});

export const listPlatformUsers = createServerFn({ method: "GET" }).handler(async () => {
  const access = await requirePermanentOwner();
  assertAdminApiAccess(access.role, "listPlatformUsers");
  const { getSql } = await import("./db");
  const sql = await getSql();
  return sql.query<{
    id: string;
    name: string;
    email: string;
    role: PlatformRole;
    tier: AccountTier;
    tier_status: string | null;
    current_period_end: string | null;
  }>(
    `select u.id, u.name, u.email, coalesce(r.role, 'user') as role,
       coalesce(t.tier, 'free') as tier, t.status as tier_status, t.current_period_end::text
     from "user" u
     left join user_roles r on r.user_id = u.id
     left join user_tiers t on t.user_id = u.id
     order by case coalesce(r.role, 'user')
       when 'owner' then 1 when 'developer' then 2 when 'moderator' then 3 else 4 end,
       lower(u.email)`,
  );
});

export const setPlatformUserRole = createServerFn({ method: "POST" })
  .validator((input: { userId: string; role: PlatformRole }) => input)
  .handler(async ({ data }) => {
    const actor = await requirePermanentOwner();
    assertAdminApiAccess(actor.role, "setPlatformUserRole");
    const role = normalizePlatformRole(data.role);
    const userId = data.userId.trim();
    if (!userId) throw new Error("User is required");
    const { getSql } = await import("./db");
    const sql = await getSql();
    const current = await sql<{ role: string }>`select role from user_roles where user_id = ${userId}`;
    if (normalizePlatformRole(current[0]?.role) === "owner" && role !== "owner") {
      const owners = await sql<{ count: number }>`select count(*)::int as count from user_roles where role = 'owner'`;
      if ((owners[0]?.count ?? 0) <= 1) throw new Error("StoryCast must retain at least one owner");
    }
    await sql.query(
      `insert into user_roles (user_id, role, assigned_by) values ($1, $2, $3)
       on conflict (user_id) do update set role = excluded.role, assigned_by = excluded.assigned_by, updated_at = now()`,
      [userId, role, actor.user.id],
    );
    return { userId, role };
  });
