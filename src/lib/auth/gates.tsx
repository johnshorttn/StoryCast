import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, registerWithEmail, signIn, signInWithEmail, signOut } from "./client";
import { hasGateSessionMarker } from "./gate-session-marker";
import { resolveSignInGateState } from "./sign-in-gate";
import { useCurrentUser, useCurrentUserState } from "./use-current-user";

const subscribeToNothing = () => () => {};
const noGateSessionOnServer = () => false;

export const SIGN_IN_PATH = "/login";

export function SignedIn({ children }: { children: ReactNode }) {
  const { user } = useCurrentUserState();
  return user ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending || user) return null;
  return <>{children}</>;
}

export function RedirectToSignIn({ to = SIGN_IN_PATH }: { to?: string }) {
  return <Navigate to={to} />;
}

export function SignInGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user, isPending } = useCurrentUserState();
  const state = resolveSignInGateState({ isPending, hasUser: user !== null });
  if (state === "pending") return null;
  if (state === "signed_in") return <>{children}</>;
  return <>{fallback ?? <SignInButtons />}</>;
}

export function SignInButtons() {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-3 rounded-lg bg-surface p-5 shadow-[var(--shadow-border)]">
      <h1 className="font-display text-2xl">{mode === "register" ? "Create your account" : "Welcome back"}</h1>
      <p className="text-sm text-muted">
        {mode === "register" ? "Start on Free with private stories and share links." : "Sign in to manage your stories."}
      </p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setWorking(true);
          setStatus("");
          const action = mode === "register"
            ? registerWithEmail({ name, email, password })
            : signInWithEmail({ email, password });
          void action
            .then(() => { window.location.href = "/admin"; })
            .catch((error) => setStatus(error instanceof Error ? error.message : "Could not continue"))
            .finally(() => setWorking(false));
        }}
      >
        {mode === "register" ? (
          <label className="block text-sm text-muted">
            Name
            <input required autoComplete="name" className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        ) : null}
        <label className="block text-sm text-muted">
          Email
          <input required type="email" autoComplete="email" className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm text-muted">
          Password
          <input required minLength={8} type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button disabled={working} type="submit" className="min-h-11 w-full rounded-md bg-primary px-4 font-semibold text-primary-fg disabled:opacity-60">
          {working ? "Working…" : mode === "register" ? "Create free account" : "Sign in"}
        </button>
      </form>
      {status ? <p className="text-sm text-danger">{status}</p> : null}
      <button type="button" className="text-sm text-primary underline-offset-4 hover:underline" onClick={() => setMode(mode === "register" ? "signin" : "register")}>
        {mode === "register" ? "Already registered? Sign in" : "New here? Create an account"}
      </button>
      <div className="my-1 h-px bg-border" />
      {GROK_PROVIDERS.map((p) => (
        <button
          key={p.providerId}
          type="button"
          onClick={() => signIn(p.providerId, { callbackURL: "/" })}
          className="w-full cursor-pointer rounded-md border border-neutral-300 px-4 py-2 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Continue with {p.label}
        </button>
      ))}
    </div>
  );
}

export function UserButton() {
  const user = useCurrentUser();
  const [signingOut, setSigningOut] = useState(false);
  const gateSession = useSyncExternalStore(
    subscribeToNothing,
    hasGateSessionMarker,
    noGateSessionOnServer,
  );
  if (!user) return null;
  const label = user.displayName ?? user.primaryEmail ?? "Account";
  return (
    <div className="flex items-center gap-2">
      {user.profileImageUrl ? (
        <img
          src={user.profileImageUrl}
          alt=""
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20">
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="text-sm font-medium">{label}</span>
      {authEnabled && !gateSession && (
        <button
          type="button"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void signOut().catch(() => setSigningOut(false));
          }}
          className="cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline disabled:cursor-wait disabled:no-underline"
        >
          {signingOut ? "Signing out\u2026" : "Sign out"}
        </button>
      )}
    </div>
  );
}
