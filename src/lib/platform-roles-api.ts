import { createServerFn } from "@tanstack/react-start";
import { capabilitiesForRole, normalizePlatformRole, type PlatformRole } from "./platform-roles";
import { activeElevatedCapabilities, ensurePlatformRole, requirePermanentOwner } from "./platform-roles.server";

export const getCurrentPlatformRole = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("./auth/verify.server");
  const user = await requireUser();
  const role = await ensurePlatformRole(user);
  const elevatedCapabilities = await activeElevatedCapabilities(user.id);
  return { role, capabilities: [...new Set([...capabilitiesForRole(role), ...elevatedCapabilities])], elevatedCapabilities };
});

export const listPlatformUsers = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermanentOwner();
  const { getSql } = await import("./db");
  const sql = await getSql();
  return sql.query<{ id: string; name: string; email: string; role: PlatformRole }>(
    `select u.id, u.name, u.email, coalesce(r.role, 'user') as role
     from "user" u left join user_roles r on r.user_id = u.id
     order by case coalesce(r.role, 'user')
       when 'owner' then 1 when 'developer' then 2 when 'moderator' then 3 else 4 end,
       lower(u.email)`,
  );
});

export const setPlatformUserRole = createServerFn({ method: "POST" })
  .validator((input: { userId: string; role: PlatformRole }) => input)
  .handler(async ({ data }) => {
    const actor = await requirePermanentOwner();
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
