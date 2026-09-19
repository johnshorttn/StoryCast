import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AccountTier } from "./account-tiers";

export function giftCodeHash(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export async function issuePaidPlanGift(input: {
  purchaserUserId?: string;
  recipientEmail?: string;
  tier: Exclude<AccountTier, "free">;
  durationDays: number;
  paymentProvider: string;
  paymentReference: string;
}) {
  const { getSql } = await import("./db");
  const sql = await getSql();
  const code = randomBytes(18).toString("base64url").toUpperCase();
  const days = Math.max(1, Math.min(730, Math.floor(input.durationDays)));
  await sql.query(
    `insert into plan_gifts
     (id, purchaser_user_id, recipient_email, tier, duration_days, code_hash,
      payment_provider, payment_reference, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now() + interval '1 year')`,
    [randomUUID(), input.purchaserUserId || null, input.recipientEmail?.trim().toLowerCase() || null,
      input.tier, days, giftCodeHash(code), input.paymentProvider, input.paymentReference],
  );
  return { code, tier: input.tier, durationDays: days };
}
