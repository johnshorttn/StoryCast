import { randomUUID } from "node:crypto";
import type { BillingProvider } from "./finance-report";

export type BillingLedgerWrite = {
  provider: BillingProvider;
  providerEventId: string;
  providerTransactionId: string;
  eventType: "payment" | "refund" | "dispute" | "adjustment";
  userId?: string;
  giftId?: string;
  billingCountry?: string;
  currency: string;
  grossMinor?: number;
  refundsMinor?: number;
  disputesMinor?: number;
  feesMinor?: number;
  taxMinor?: number;
  netMinor: number;
  occurredAt: string | Date;
  metadata?: Record<string, string | number | boolean | null>;
};

function minor(value: number | undefined) {
  const amount = value ?? 0;
  if (!Number.isSafeInteger(amount)) throw new Error("Billing amounts must be safe integers in minor currency units");
  return amount;
}

export async function recordBillingLedgerEntry(input: BillingLedgerWrite) {
  const eventId = input.providerEventId.trim();
  const transactionId = input.providerTransactionId.trim();
  const currency = input.currency.trim().toUpperCase();
  const occurredAt = new Date(input.occurredAt);
  if (!eventId || !transactionId) throw new Error("Provider event and transaction IDs are required");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO code");
  if (Number.isNaN(occurredAt.getTime())) throw new Error("Billing event time is invalid");
  const { getSql } = await import("./db");
  const sql = await getSql();
  const rows = await sql.query<{ id: string }>(
    `insert into billing_ledger
     (id, provider, provider_event_id, provider_transaction_id, event_type, user_id, gift_id,
      billing_country, currency, gross_minor, refunds_minor, disputes_minor, fees_minor,
      tax_minor, net_minor, occurred_at, raw_event)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)
     on conflict (provider, provider_event_id) do nothing returning id`,
    [randomUUID(), input.provider, eventId, transactionId, input.eventType, input.userId || null,
      input.giftId || null, input.billingCountry?.trim().toUpperCase() || null, currency,
      minor(input.grossMinor), minor(input.refundsMinor), minor(input.disputesMinor),
      minor(input.feesMinor), minor(input.taxMinor), minor(input.netMinor), occurredAt.toISOString(),
      JSON.stringify(input.metadata ?? {})],
  );
  return { inserted: Boolean(rows[0]), id: rows[0]?.id ?? null };
}
