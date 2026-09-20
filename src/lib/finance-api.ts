import { createServerFn } from "@tanstack/react-start";
import { assertAdminApiAccess } from "./platform-admin";
import { reportReconciles, summarizeFinance, type BillingLedgerEntry } from "./finance-report";

async function requireFinanceAdmin() {
  const { requirePlatformCapability } = await import("./platform-roles.server");
  const access = await requirePlatformCapability("view_finance");
  assertAdminApiAccess(access.role, "getFinancialReport", access.elevatedCapabilities);
  return access;
}

export const getFinancialReport = createServerFn({ method: "GET" })
  .validator((input: { from: string; to: string }) => input)
  .handler(async ({ data }) => {
    await requireFinanceAdmin();
    const from = new Date(data.from);
    const to = new Date(data.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
      throw new Error("A valid report date range is required");
    }
    if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
      throw new Error("Reports are limited to 366 days");
    }
    const { getSql } = await import("./db");
    const sql = await getSql();
    const raw = await sql.query<{
      provider: "stripe" | "paddle"; currency: string; gross_minor: number;
      refunds_minor: number; disputes_minor: number; fees_minor: number;
      tax_minor: number; net_minor: number; transactions: number;
    }>(
      `select provider, currency, sum(gross_minor)::bigint as gross_minor,
        sum(refunds_minor)::bigint as refunds_minor, sum(disputes_minor)::bigint as disputes_minor,
        sum(fees_minor)::bigint as fees_minor, sum(tax_minor)::bigint as tax_minor,
        sum(net_minor)::bigint as net_minor, count(*)::bigint as transactions
       from billing_ledger where occurred_at >= $1 and occurred_at < $2
       group by provider, currency order by currency, provider`,
      [from.toISOString(), to.toISOString()],
    );
    const entries: BillingLedgerEntry[] = raw.map((row) => ({
      provider: row.provider, currency: row.currency, grossMinor: row.gross_minor,
      refundsMinor: row.refunds_minor, disputesMinor: row.disputes_minor,
      feesMinor: row.fees_minor, taxMinor: row.tax_minor, netMinor: row.net_minor,
      transactions: row.transactions,
    }));
    const rows = summarizeFinance(entries);
    return { from: from.toISOString(), to: to.toISOString(), rows, reconciles: reportReconciles(rows) };
  });
