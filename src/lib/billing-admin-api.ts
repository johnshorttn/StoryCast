import { createServerFn } from "@tanstack/react-start";
import { normalizeTier, type AccountTier } from "./account-tiers";
import { assertAdminApiAccess } from "./platform-admin";

async function requireBillingAdmin() {
  const { requirePlatformCapability } = await import("./platform-roles.server");
  const access = await requirePlatformCapability("manage_billing");
  assertAdminApiAccess(access.role, "listBillingAccounts", access.elevatedCapabilities);
  return access;
}

export const listBillingAccounts = createServerFn({ method: "GET" }).handler(async () => {
  await requireBillingAdmin();
  const { getSql } = await import("./db");
  const { hasAuthUserTable } = await import("./auth-tables.server");
  const sql = await getSql();
  if (!(await hasAuthUserTable(sql))) {
    return sql.query<{
      id: string;
      name: string;
      email: string;
      role: string;
      tier: AccountTier;
      status: string | null;
      current_period_end: string | null;
      stories: number;
    }>(
      `select r.user_id as id, r.user_id as name, '' as email, r.role,
         coalesce(t.tier, 'free') as tier, t.status, t.current_period_end::text,
         coalesce(s.stories, 0)::int as stories
       from user_roles r
       left join user_tiers t on t.user_id = r.user_id
       left join (
         select owner_id, count(*)::int as stories from stories group by owner_id
       ) s on s.owner_id = r.user_id
       order by r.user_id`,
    );
  }
  return sql.query<{
    id: string;
    name: string;
    email: string;
    role: string;
    tier: AccountTier;
    status: string | null;
    current_period_end: string | null;
    stories: number;
  }>(
    `select u.id, u.name, u.email, coalesce(r.role, 'user') as role,
       coalesce(t.tier, 'free') as tier, t.status, t.current_period_end::text,
       coalesce(s.stories, 0)::int as stories
     from "user" u
     left join user_roles r on r.user_id = u.id
     left join user_tiers t on t.user_id = u.id
     left join (
       select owner_id, count(*)::int as stories from stories group by owner_id
     ) s on s.owner_id = u.id
     order by lower(u.email)`,
  );
});

export const setAccountTier = createServerFn({ method: "POST" })
  .validator((input: { userId: string; tier: AccountTier; periodDays?: number }) => input)
  .handler(async ({ data }) => {
    const { requirePlatformCapability } = await import("./platform-roles.server");
    const access = await requirePlatformCapability("manage_billing");
    assertAdminApiAccess(access.role, "setAccountTier", access.elevatedCapabilities);
    const userId = data.userId.trim();
    const tier = normalizeTier(data.tier);
    if (!userId) throw new Error("User is required");
    const days = Math.max(0, Math.min(3650, Math.floor(data.periodDays || 0)));
    const { getSql } = await import("./db");
    const sql = await getSql();
    await sql.query(
      `insert into user_tiers (user_id, tier, status, current_period_end)
       values ($1, $2, 'active', case when $3 > 0 then now() + ($3 * interval '1 day') else null end)
       on conflict (user_id) do update set
         tier = excluded.tier, status = 'active',
         current_period_end = excluded.current_period_end, updated_at = now()`,
      [userId, tier, days],
    );
    return { userId, tier, periodDays: days || null };
  });
