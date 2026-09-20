import { useEffect, useState } from "react";
import { listBillingAccounts, setAccountTier } from "@/lib/billing-admin-api";
import { getFinancialReport } from "@/lib/finance-api";
import { listPlatformUsers, setPlatformUserRole } from "@/lib/platform-roles-api";
import { listTemporaryAdminRequests, requestTemporaryAdmin, reviewTemporaryAdminRequest, revokeTemporaryAdmin } from "@/lib/privilege-elevation-api";
import { listSiteStories, moderateSiteStory } from "@/lib/story-api";
import { getSiteAdminOverview, getSiteSettings, getSystemStatus } from "@/lib/system-admin-api";
import type { AccountTier } from "@/lib/account-tiers";
import { TEMPORARILY_GRANTABLE_CAPABILITIES, type PlatformCapability, type PlatformRole } from "@/lib/platform-roles";
import type { FinanceTotals } from "@/lib/finance-report";

function PanelStatus({ error, empty }: { error: string; empty?: string }) {
  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (empty) return <p className="text-sm text-muted">{empty}</p>;
  return <p className="text-sm text-muted">Loading…</p>;
}

function money(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

export function OverviewPanel() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getSiteAdminOverview>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void getSiteAdminOverview()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load overview"));
  }, []);
  if (!data) return <PanelStatus error={error} />;
  const cards = [
    ["Accounts", data.users],
    ["Owners", data.owners],
    ["Stories", data.stories],
    ["Public", data.publicStories],
    ["Pending sudo", data.pendingElevations],
    ["Ledger (30d)", data.ledgerEntries30d],
  ] as const;
  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">Site administration</h1>
      <p className="mt-1 max-w-2xl text-muted">
        Owners have unrestricted access to users, content, billing, and developer tools. Regular-user plan limits do not apply here.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
            <p className="mt-2 font-display text-3xl">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        Trailing 30-day ledger net: {money(data.netMinor30d, "USD")}. Bootstrap owner emails configured: {data.ownerEmailsConfigured}.
      </p>
    </div>
  );
}

export function UsersPanel({ role }: { role: PlatformRole }) {
  const [users, setUsers] = useState<Awaited<ReturnType<typeof listPlatformUsers>>>([]);
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof listTemporaryAdminRequests>>>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [elevationCapability, setElevationCapability] = useState<PlatformCapability>("view_finance");
  const [elevationReason, setElevationReason] = useState("");

  async function refresh() {
    if (role === "owner") {
      const [nextUsers, nextRequests] = await Promise.all([listPlatformUsers(), listTemporaryAdminRequests()]);
      setUsers(nextUsers);
      setRequests(nextRequests);
      return;
    }
    setUsers([]);
    setRequests([]);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (role !== "owner") return;
        const [nextUsers, nextRequests] = await Promise.all([listPlatformUsers(), listTemporaryAdminRequests()]);
        if (!cancelled) {
          setUsers(nextUsers);
          setRequests(nextRequests);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load users");
      }
    })();
    return () => { cancelled = true; };
  }, [role]);

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">Users & roles</h1>
      <p className="mt-1 max-w-2xl text-muted">Assign permanent platform roles. Temporary sudo never creates another owner.</p>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {status ? <p className="mt-3 text-sm text-muted">{status}</p> : null}

      {role === "developer" || role === "moderator" ? (
        <form
          className="mt-4 grid max-w-3xl gap-2 rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] sm:grid-cols-[180px_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void requestTemporaryAdmin({ data: { capabilities: [elevationCapability], reason: elevationReason } })
              .then(() => { setElevationReason(""); setStatus("Temporary administrator access requested"); })
              .catch((err) => setStatus(err instanceof Error ? err.message : "Request failed"));
          }}
        >
          <select className="min-h-11 rounded-md border border-border bg-bg px-2 text-fg" value={elevationCapability} onChange={(event) => setElevationCapability(event.target.value as PlatformCapability)}>
            {TEMPORARILY_GRANTABLE_CAPABILITIES.map((capability) => <option key={capability} value={capability}>{capability.replaceAll("_", " ")}</option>)}
          </select>
          <input required minLength={10} maxLength={500} className="min-h-11 rounded-md border border-border bg-bg px-3 text-fg" value={elevationReason} onChange={(event) => setElevationReason(event.target.value)} placeholder="Why temporary admin access is needed" />
          <button type="submit" className="min-h-11 rounded-md bg-primary px-4 font-semibold text-primary-fg">Request sudo</button>
        </form>
      ) : null}

      {role === "owner" ? (
        <div className="mt-6 overflow-x-auto rounded-lg bg-surface shadow-[var(--shadow-border)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{user.name || "Unnamed"}</p>
                    <p className="text-muted">{user.email}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{user.tier}</td>
                  <td className="px-4 py-3">
                    <select
                      className="min-h-11 rounded-md border border-border bg-bg px-2 text-fg"
                      value={user.role}
                      onChange={(event) => {
                        const next = event.target.value as PlatformRole;
                        void setPlatformUserRole({ data: { userId: user.id, role: next } })
                          .then(() => refresh())
                          .catch((err) => setStatus(err instanceof Error ? err.message : "Could not change role"));
                      }}
                    >
                      {(["owner", "developer", "moderator", "user"] as const).map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length && !error ? <p className="px-4 py-6 text-sm text-muted">No accounts yet.</p> : null}
        </div>
      ) : null}

      {role === "owner" ? (
        <div className="mt-6 rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="font-display text-xl">Temporary administrator requests</p>
          {requests.length ? requests.map((request) => (
            <div key={request.id} className="border-t border-border py-3 first:border-0">
              <p><span className="font-semibold">{request.name}</span> · {request.email} · {request.status}</p>
              <p className="text-sm text-muted">{request.requested_capabilities.join(", ")}</p>
              <p className="text-sm text-muted">{request.reason}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {request.status === "pending" ? (
                  <>
                    <button type="button" className="min-h-11 rounded-md bg-primary px-3 font-semibold text-primary-fg" onClick={async () => {
                      await reviewTemporaryAdminRequest({ data: { requestId: request.id, decision: "approve", minutes: 60 } });
                      await refresh();
                    }}>Approve 1 hour</button>
                    <button type="button" className="min-h-11 rounded-md bg-raised px-3" onClick={async () => {
                      await reviewTemporaryAdminRequest({ data: { requestId: request.id, decision: "deny" } });
                      await refresh();
                    }}>Deny</button>
                  </>
                ) : request.status === "approved" ? (
                  <button type="button" className="min-h-11 rounded-md bg-danger px-3" onClick={async () => {
                    await revokeTemporaryAdmin({ data: { requestId: request.id } });
                    await refresh();
                  }}>Revoke sudo</button>
                ) : null}
              </div>
            </div>
          )) : <p className="mt-2 text-sm text-muted">No elevation requests.</p>}
        </div>
      ) : null}
    </div>
  );
}

export function ModerationPanel() {
  const [stories, setStories] = useState<Awaited<ReturnType<typeof listSiteStories>>>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  async function refresh() {
    setStories(await listSiteStories());
  }
  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : "Could not load stories"));
  }, []);
  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">Content & moderation</h1>
      <p className="mt-1 max-w-2xl text-muted">Review every stored title. Unpublish or remove work that should not stay in the catalog.</p>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {status ? <p className="mt-3 text-sm text-muted">{status}</p> : null}
      <div className="mt-6 overflow-x-auto rounded-lg bg-surface shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Visibility</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stories.map((story) => (
              <tr key={story.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-semibold">{story.title}</p>
                  <p className="text-xs text-muted">{story.id}</p>
                </td>
                <td className="px-4 py-3">
                  <p>{story.owner_name || "Unknown"}</p>
                  <p className="text-xs text-muted">{story.owner_email || story.owner_id}</p>
                </td>
                <td className="px-4 py-3 capitalize">{story.visibility}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="min-h-11 rounded-md bg-raised px-3" onClick={async () => {
                      await moderateSiteStory({ data: { storyId: story.id, action: "unpublish" } });
                      setStatus(`Unpublished ${story.id}`);
                      await refresh();
                    }}>Unpublish</button>
                    <button type="button" className="min-h-11 rounded-md bg-raised px-3" onClick={async () => {
                      await moderateSiteStory({ data: { storyId: story.id, action: "unlist" } });
                      setStatus(`Unlisted ${story.id}`);
                      await refresh();
                    }}>Unlist</button>
                    <button type="button" className="min-h-11 rounded-md bg-danger px-3" onClick={async () => {
                      if (!confirm(`Delete ${story.id} from the live catalog?`)) return;
                      await moderateSiteStory({ data: { storyId: story.id, action: "delete" } });
                      setStatus(`Deleted ${story.id}`);
                      await refresh();
                    }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!stories.length && !error ? <p className="px-4 py-6 text-sm text-muted">No stored stories yet.</p> : null}
      </div>
    </div>
  );
}

export function FinancePanel() {
  const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof listBillingAccounts>>>([]);
  const [rows, setRows] = useState<FinanceTotals[]>([]);
  const [reconciles, setReconciles] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);

  async function refresh() {
    const report = await getFinancialReport({ data: { from: from.toISOString(), to: to.toISOString() } });
    setRows(report.rows);
    setReconciles(report.reconciles);
    try {
      setAccounts(await listBillingAccounts());
    } catch {
      setAccounts([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const report = await getFinancialReport({ data: { from: from.toISOString(), to: to.toISOString() } });
        if (cancelled) return;
        setRows(report.rows);
        setReconciles(report.reconciles);
        try {
          setAccounts(await listBillingAccounts());
        } catch {
          if (!cancelled) setAccounts([]);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load billing");
      }
    })();
    return () => { cancelled = true; };
    // Initial 30-day window only; later refreshes go through explicit actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">Billing & finance</h1>
      <p className="mt-1 max-w-2xl text-muted">Assign paid plans and read the hybrid Stripe/Paddle ledger. Checkout still happens through the configured provider.</p>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {status ? <p className="mt-3 text-sm text-muted">{status}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-lg bg-surface shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Stories</th>
              <th className="px-4 py-3">Plan</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-semibold">{account.name || "Unnamed"}</p>
                  <p className="text-muted">{account.email}</p>
                </td>
                <td className="px-4 py-3">{account.stories}</td>
                <td className="px-4 py-3">
                  <select
                    className="min-h-11 rounded-md border border-border bg-bg px-2 text-fg"
                    value={account.tier}
                    onChange={(event) => {
                      const tier = event.target.value as AccountTier;
                      void setAccountTier({ data: { userId: account.id, tier, periodDays: tier === "free" ? 0 : 365 } })
                        .then(() => { setStatus(`Updated ${account.email} to ${tier}`); return refresh(); })
                        .catch((err) => setStatus(err instanceof Error ? err.message : "Could not update plan"));
                    }}
                  >
                    {(["free", "creator", "studio"] as const).map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!accounts.length && !error ? <p className="px-4 py-6 text-sm text-muted">No billing accounts yet.</p> : null}
      </div>

      <div className="mt-6 rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
        <p className="font-display text-xl">Ledger · last 30 days</p>
        <p className="text-sm text-muted">{reconciles === null ? "Loading reconciliation…" : reconciles ? "Combined totals reconcile." : "Combined totals do not reconcile."}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2 pr-3">View</th>
                <th className="py-2 pr-3">Currency</th>
                <th className="py-2 pr-3">Gross</th>
                <th className="py-2 pr-3">Refunds</th>
                <th className="py-2 pr-3">Fees</th>
                <th className="py-2 pr-3">Net</th>
                <th className="py-2">Txns</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.provider}-${row.currency}`} className="border-t border-border">
                  <td className="py-2 pr-3 capitalize">{row.provider}</td>
                  <td className="py-2 pr-3">{row.currency}</td>
                  <td className="py-2 pr-3">{money(row.grossMinor, row.currency)}</td>
                  <td className="py-2 pr-3">{money(row.refundsMinor, row.currency)}</td>
                  <td className="py-2 pr-3">{money(row.feesMinor, row.currency)}</td>
                  <td className="py-2 pr-3">{money(row.netMinor, row.currency)}</td>
                  <td className="py-2">{row.transactions || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !error ? <p className="mt-3 text-sm text-muted">No ledger activity in this window.</p> : null}
        </div>
      </div>
    </div>
  );
}

export function SystemPanel() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getSystemStatus>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void getSystemStatus()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load system status"));
  }, []);
  if (!data) return <PanelStatus error={error} />;
  const flags = [
    ["Database", data.dbSource],
    ["Auth", data.authConfigured ? "configured" : "disabled"],
    ["Email/password", data.emailPassword ? "enabled" : "off"],
    ["xAI TTS", data.tts.xai ? "configured" : "missing"],
    ["Kokoro", data.tts.kokoro ? "configured" : "missing"],
    ["Sherpa", data.tts.sherpa ? "configured" : "missing"],
    ["Durable audio", data.tts.durableAudio ? "configured" : "in-memory"],
    ["Rewrite model", data.rewriteModel ? "configured" : "missing"],
    ["Owner emails", String(data.ownerEmailsConfigured)],
  ] as const;
  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">System</h1>
      <p className="mt-1 max-w-2xl text-muted">Developer health for auth, TTS, storage, and the rewrite model. Secrets are never shown.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {flags.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
            <p className="mt-2 font-semibold capitalize">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        {data.counts.users} accounts · {data.counts.stories} stories · {data.counts.publicStories} public · {data.counts.pendingElevations} pending sudo requests
      </p>
    </div>
  );
}

export function SettingsPanel() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getSiteSettings>> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void getSiteSettings()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load settings"));
  }, []);
  if (!data) return <PanelStatus error={error} />;
  return (
    <div>
      <h1 className="font-display text-3xl tracking-tight">Settings</h1>
      <p className="mt-1 max-w-2xl text-muted">
        Bootstrap owners come from <code>STORYCAST_OWNER_EMAILS</code>. Email/password and Grok OAuth stay in place.
      </p>
      <div className="mt-6 space-y-3">
        <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="font-display text-xl">Bootstrap owners</p>
          {data.ownerEmails.length ? (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {data.ownerEmails.map((email) => <li key={email}>{email}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">No bootstrap emails are configured. Persisted owner roles still apply.</p>
          )}
        </section>
        <section className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="font-display text-xl">Authentication</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>Better Auth: {data.authConfigured ? "configured" : "disabled"}</li>
            <li>Email/password: {data.emailPassword ? "enabled" : "off"}</li>
            <li>Grok OAuth env: {data.grokOAuth ? "present" : "using preview defaults"}</li>
            <li>Postgres URL: {data.databaseUrlConfigured ? "set" : "local PGLite fallback"}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

