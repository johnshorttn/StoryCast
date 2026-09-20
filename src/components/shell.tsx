import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { AgeGate } from "@/components/age-gate";
import { cn } from "@/lib/utils";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getCurrentPlatformRole } from "@/lib/platform-roles-api";
import { isOwnerRole, type PlatformRole } from "@/lib/platform-roles";

export function Shell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const user = useCurrentUser();
  const [role, setRole] = useState<PlatformRole | null>(null);
  useEffect(() => {
    if (!user) {
      setRole(null);
      return;
    }
    void getCurrentPlatformRole()
      .then((access) => setRole(access.role))
      .catch(() => setRole("user"));
  }, [user]);
  const adminLabel = role && (isOwnerRole(role) || role === "developer" || role === "moderator")
    ? "Site Admin"
    : "My stories";

  return (
    <AgeGate>
      <div className="min-h-dvh bg-bg text-fg">
        <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-sm">
          <div
            className={cn(
              "mx-auto flex items-center justify-between gap-3 px-4 py-3",
              wide ? "max-w-7xl" : "max-w-5xl",
            )}
          >
            <Link to="/" className="flex items-center gap-2 text-fg no-underline">
              <img
                src="/storycast-logo.png"
                alt=""
                width="40"
                height="40"
                className="size-10 rounded-lg object-cover shadow-[var(--shadow-border)]"
              />
              <span className="font-display text-lg tracking-tight">StoryCast</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                to="/"
                className="inline-flex min-h-11 items-center rounded-md px-3 text-muted no-underline hover:text-fg"
              >
                Catalog
              </Link>
              <Link
                to="/admin"
                className="inline-flex min-h-11 items-center rounded-md px-3 text-muted no-underline hover:text-fg"
              >
                {adminLabel}
              </Link>
              <UserButton />
            </nav>
          </div>
        </header>
        <div className={cn("mx-auto px-4 py-6", wide ? "max-w-7xl" : "max-w-5xl")}>{children}</div>
      </div>
    </AgeGate>
  );
}
