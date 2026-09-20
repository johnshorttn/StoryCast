import { createServerFn } from "@tanstack/react-start";
import { normalizeTier } from "./account-tiers";

export const redeemPlanGift = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth/verify.server");
    const user = await requireUser();
    const { getSql } = await import("./db");
    const { giftCodeHash } = await import("./plan-gifts.server");
    const sql = await getSql();
    const rows = await sql.query<{ tier: string; duration_days: number }>(
      `with claimed as (
         update plan_gifts set status = 'redeemed', redeemed_by = $1, redeemed_at = now()
         where code_hash = $2 and status = 'active' and expires_at > now()
           and (recipient_email is null or recipient_email = lower($3))
         returning tier, duration_days
       ), applied as (
         insert into user_tiers (user_id, tier, status, current_period_end)
         select $1, tier, 'active', now() + (duration_days * interval '1 day') from claimed
         on conflict (user_id) do update set
           tier = case
             when user_tiers.tier = 'studio' or excluded.tier = 'studio' then 'studio'
             else 'creator'
           end,
           status = 'active',
           current_period_end = greatest(coalesce(user_tiers.current_period_end, now()), now())
             + ((select duration_days from claimed) * interval '1 day'),
           updated_at = now()
         returning tier
       )
       select claimed.tier, claimed.duration_days from claimed, applied`,
      [user.id, giftCodeHash(data.code), user.email || ""],
    );
    const gift = rows[0];
    if (!gift) throw new Error("Gift code is invalid, expired, already used, or belongs to another email");
    const tier = normalizeTier(gift.tier);
    return { tier, durationDays: gift.duration_days };
  });
