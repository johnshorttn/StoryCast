import assert from "node:assert/strict";
import test from "node:test";
import { reportReconciles, summarizeFinance } from "./finance-report.ts";

test("combined finance view exactly equals Stripe plus Paddle", () => {
  const rows = summarizeFinance([
    { provider: "stripe", currency: "usd", grossMinor: 1000, refundsMinor: 0, disputesMinor: 0, feesMinor: 59, taxMinor: 0, netMinor: 941 },
    { provider: "paddle", currency: "usd", grossMinor: 2000, refundsMinor: 200, disputesMinor: 0, feesMinor: 150, taxMinor: 120, netMinor: 1530 },
  ]);
  assert.equal(reportReconciles(rows), true);
  assert.deepEqual(rows.find((row) => row.provider === "combined"), {
    provider: "combined", currency: "USD", grossMinor: 3000, refundsMinor: 200,
    disputesMinor: 0, feesMinor: 209, taxMinor: 120, netMinor: 2471, transactions: 2,
  });
});

test("currencies remain separate instead of producing a misleading combined amount", () => {
  const rows = summarizeFinance([
    { provider: "stripe", currency: "usd", grossMinor: 1000, refundsMinor: 0, disputesMinor: 0, feesMinor: 59, taxMinor: 0, netMinor: 941 },
    { provider: "paddle", currency: "eur", grossMinor: 1000, refundsMinor: 0, disputesMinor: 0, feesMinor: 100, taxMinor: 100, netMinor: 800 },
  ]);
  assert.equal(rows.filter((row) => row.provider === "combined").length, 2);
  assert.equal(reportReconciles(rows), true);
});
