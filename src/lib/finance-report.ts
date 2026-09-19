export type BillingProvider = "stripe" | "paddle";
export type BillingLedgerEntry = {
  provider: BillingProvider;
  currency: string;
  grossMinor: number;
  refundsMinor: number;
  disputesMinor: number;
  feesMinor: number;
  taxMinor: number;
  netMinor: number;
  transactions?: number;
};

export type FinanceTotals = Omit<BillingLedgerEntry, "provider"> & { provider: BillingProvider | "combined" };

function empty(provider: FinanceTotals["provider"], currency: string): FinanceTotals {
  return { provider, currency, grossMinor: 0, refundsMinor: 0, disputesMinor: 0, feesMinor: 0, taxMinor: 0, netMinor: 0, transactions: 0 };
}

export function summarizeFinance(entries: BillingLedgerEntry[]) {
  const currencies = [...new Set(entries.map((entry) => entry.currency.toUpperCase()))].sort();
  return currencies.flatMap((currency) => {
    const byProvider = (["stripe", "paddle"] as const).map((provider) =>
      entries.filter((entry) => entry.currency.toUpperCase() === currency && entry.provider === provider)
        .reduce<FinanceTotals>((total, entry) => ({
          ...total,
          grossMinor: total.grossMinor + entry.grossMinor,
          refundsMinor: total.refundsMinor + entry.refundsMinor,
          disputesMinor: total.disputesMinor + entry.disputesMinor,
          feesMinor: total.feesMinor + entry.feesMinor,
          taxMinor: total.taxMinor + entry.taxMinor,
          netMinor: total.netMinor + entry.netMinor,
          transactions: (total.transactions || 0) + (entry.transactions || 1),
        }), empty(provider, currency)),
    );
    const combined = byProvider.reduce<FinanceTotals>((total, entry) => ({
      ...total,
      grossMinor: total.grossMinor + entry.grossMinor,
      refundsMinor: total.refundsMinor + entry.refundsMinor,
      disputesMinor: total.disputesMinor + entry.disputesMinor,
      feesMinor: total.feesMinor + entry.feesMinor,
      taxMinor: total.taxMinor + entry.taxMinor,
      netMinor: total.netMinor + entry.netMinor,
      transactions: (total.transactions || 0) + (entry.transactions || 0),
    }), empty("combined", currency));
    return [combined, ...byProvider];
  });
}

export function reportReconciles(rows: FinanceTotals[]) {
  const currencies = [...new Set(rows.map((row) => row.currency))];
  return currencies.every((currency) => {
    const combined = rows.find((row) => row.currency === currency && row.provider === "combined");
    const stripe = rows.find((row) => row.currency === currency && row.provider === "stripe");
    const paddle = rows.find((row) => row.currency === currency && row.provider === "paddle");
    if (!combined || !stripe || !paddle) return false;
    return (["grossMinor", "refundsMinor", "disputesMinor", "feesMinor", "taxMinor", "netMinor", "transactions"] as const)
      .every((key) => (combined[key] || 0) === (stripe[key] || 0) + (paddle[key] || 0));
  });
}
