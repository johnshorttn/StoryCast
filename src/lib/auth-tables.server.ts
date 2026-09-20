import type { Sql } from "./db";

export async function hasAuthUserTable(sql: Sql) {
  const rows = await sql.query<{ exists: boolean }>(
    `select exists (
       select 1 from information_schema.tables
       where table_schema = current_schema() and table_name = 'user'
     ) as exists`,
  );
  return Boolean(rows[0]?.exists);
}

export async function countAuthUsers(sql: Sql) {
  if (!(await hasAuthUserTable(sql))) {
    const rows = await sql<{ count: number }>`select count(*)::int as count from user_roles`;
    return rows[0]?.count ?? 0;
  }
  const rows = await sql<{ count: number }>`select count(*)::int as count from "user"`;
  return rows[0]?.count ?? 0;
}
