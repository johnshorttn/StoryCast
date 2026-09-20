import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Landmark, LayoutDashboard, Server, Settings, Shield, Users } from "lucide-react";
import { Shell } from "@/components/shell";
import { StoryCatalog } from "@/components/admin/story-catalog";
import {
  FinancePanel,
  ModerationPanel,
  OverviewPanel,
  SettingsPanel,
  SystemPanel,
  UsersPanel,
} from "@/components/admin/site-panels";
import { usePlatformAccess } from "@/lib/use-platform-access";
import { SignInGate } from "@/lib/auth/gates";
import {
  canViewAdminPanel,
  defaultAdminPanel,
  visibleAdminPanels,
  type SiteAdminPanel,
} from "@/lib/platform-admin";
import { cn } from "@/lib/utils";

const PANEL_ICONS: Record<SiteAdminPanel, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  stories: BookOpen,
  users: Users,
  moderation: Shield,
  finance: Landmark,
  system: Server,
  settings: Settings,
};

const PANELS = new Set<SiteAdminPanel>([
  "overview", "stories", "users", "moderation", "finance", "system", "settings",
]);

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>): { panel?: SiteAdminPanel } => {
    const panel = typeof search.panel === "string" && PANELS.has(search.panel as SiteAdminPanel)
      ? search.panel as SiteAdminPanel
      : undefined;
    return panel ? { panel } : {};
  },
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <SignInGate>
      <AdminPortal />
    </SignInGate>
  );
}

function AdminPortal() {
  const { panel: requested } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { access, error } = usePlatformAccess();

  const panels = useMemo(
    () => (access ? visibleAdminPanels(access.role, access.capabilities) : []),
    [access],
  );
  const active = useMemo(() => {
    if (!access) return "stories" as SiteAdminPanel;
    const preferred = requested && canViewAdminPanel(access.role, requested, access.capabilities)
      ? requested
      : defaultAdminPanel(access.role, access.capabilities);
    return preferred;
  }, [access, requested]);

  const siteAdmin = Boolean(access && access.role !== "user");

  return (
    <Shell wide>
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      <div className={cn(siteAdmin && "grid gap-6 lg:grid-cols-[220px_1fr]")}>
        {siteAdmin ? (
          <nav className="h-fit rounded-lg bg-surface p-3 shadow-[var(--shadow-border)]" aria-label="Site administration">
            <p className="px-2 pb-2 text-xs uppercase tracking-[0.16em] text-muted">Site admin</p>
            <p className="px-2 pb-3 text-xs text-muted">Role: {access?.role}</p>
            <div className="flex flex-col gap-1">
              {panels.map((item) => {
                const Icon = PANEL_ICONS[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-md px-3 text-left text-sm",
                      active === item.id ? "bg-primary font-semibold text-primary-fg" : "text-fg hover:bg-raised/70",
                    )}
                    onClick={() => {
                      void navigate({ search: item.id === defaultAdminPanel(access!.role, access!.capabilities) ? {} : { panel: item.id } });
                    }}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>
        ) : null}
        <div>
          {!access ? <p className="text-sm text-muted">Loading access…</p> : null}
          {access && active === "overview" ? <OverviewPanel /> : null}
          {access && active === "stories" ? (
            <StoryCatalog
              role={access.role}
              tier={access.tier}
              entitlements={access.entitlements}
            />
          ) : null}
          {access && active === "users" ? <UsersPanel role={access.role} /> : null}
          {access && active === "moderation" ? <ModerationPanel /> : null}
          {access && active === "finance" ? <FinancePanel /> : null}
          {access && active === "system" ? <SystemPanel /> : null}
          {access && active === "settings" ? <SettingsPanel /> : null}
        </div>
      </div>
    </Shell>
  );
}
