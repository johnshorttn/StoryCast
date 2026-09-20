import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { TEMPORARILY_GRANTABLE_CAPABILITIES, type PlatformCapability } from "./platform-roles";
import { ensurePlatformRole, requirePermanentOwner } from "./platform-roles.server";

export const requestTemporaryAdmin = createServerFn({ method: "POST" })
  .validator((input: { capabilities: PlatformCapability[]; reason: string }) => input)
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth/verify.server");
    const user = await requireUser();
    const role = await ensurePlatformRole(user);
    if (role !== "developer" && role !== "moderator") {
      throw new Error("Only developers and moderators can request temporary administrator access");
    }
    const capabilities = [...new Set(data.capabilities)].filter((capability) =>
      TEMPORARILY_GRANTABLE_CAPABILITIES.includes(capability));
    const reason = data.reason.trim();
    if (!capabilities.length) throw new Error("Choose at least one grantable administrator capability");
    if (reason.length < 10 || reason.length > 500) throw new Error("Provide a reason between 10 and 500 characters");
    const { getSql } = await import("./db");
    const sql = await getSql();
    const id = randomUUID();
    await sql.query(
      `insert into privilege_elevation_requests (id, user_id, requested_capabilities, reason)
       values ($1, $2, $3::jsonb, $4)`,
      [id, user.id, JSON.stringify(capabilities), reason],
    );
    return { id, status: "pending" as const, capabilities };
  });

export const listTemporaryAdminRequests = createServerFn({ method: "GET" }).handler(async () => {
  await requirePermanentOwner();
  const { getSql } = await import("./db");
  const sql = await getSql();
  return sql.query<{
    id: string; user_id: string; name: string; email: string; requested_capabilities: PlatformCapability[];
    reason: string; status: string; requested_at: string; approved_until: string | null;
  }>(
    `select r.id, r.user_id, u.name, u.email, r.requested_capabilities, r.reason,
       case when r.status = 'approved' and r.approved_until <= now() then 'expired' else r.status end as status,
       r.requested_at::text, r.approved_until::text
     from privilege_elevation_requests r join "user" u on u.id = r.user_id
     order by case r.status when 'pending' then 1 when 'approved' then 2 else 3 end, r.requested_at desc`,
  );
});

export const reviewTemporaryAdminRequest = createServerFn({ method: "POST" })
  .validator((input: { requestId: string; decision: "approve" | "deny"; minutes?: number }) => input)
  .handler(async ({ data }) => {
    const owner = await requirePermanentOwner();
    const minutes = Math.max(15, Math.min(240, Math.floor(data.minutes || 60)));
    const { getSql } = await import("./db");
    const sql = await getSql();
    const rows = await sql.query<{ id: string }>(
      data.decision === "approve"
        ? `update privilege_elevation_requests set status = 'approved', reviewed_by = $2,
             reviewed_at = now(), approved_until = now() + ($3 * interval '1 minute')
           where id = $1 and status = 'pending' returning id`
        : `update privilege_elevation_requests set status = 'denied', reviewed_by = $2,
             reviewed_at = now(), approved_until = null
           where id = $1 and status = 'pending' returning id`,
      data.decision === "approve" ? [data.requestId, owner.user.id, minutes] : [data.requestId, owner.user.id],
    );
    if (!rows[0]) throw new Error("Pending request not found");
    return { requestId: data.requestId, status: data.decision === "approve" ? "approved" : "denied", minutes: data.decision === "approve" ? minutes : null };
  });

export const revokeTemporaryAdmin = createServerFn({ method: "POST" })
  .validator((input: { requestId: string }) => input)
  .handler(async ({ data }) => {
    const owner = await requirePermanentOwner();
    const { getSql } = await import("./db");
    const sql = await getSql();
    await sql.query(
      `update privilege_elevation_requests set status = 'revoked', revoked_by = $2, revoked_at = now()
       where id = $1 and status = 'approved'`,
      [data.requestId, owner.user.id],
    );
    return { requestId: data.requestId, status: "revoked" as const };
  });
