import { useEffect, useState, type ReactNode } from "react";
import { needsAgeGate, useStoryStore } from "@/lib/story-store";

export function AgeGate({ children }: { children: ReactNode }) {
  const hydrate = useStoryStore((s) => s.hydrate);
  const ready = useStoryStore((s) => s.ready);
  const ageOk = useStoryStore((s) => s.ageOk);
  const verifyAge = useStoryStore((s) => s.verifyAge);
  const stories = useStoryStore((s) => s.custom);
  const [dob, setDob] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-4 text-muted">
        Loading catalog…
      </div>
    );
  }

  if (needsAgeGate(stories) && !ageOk) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg px-4 text-fg">
        <form
          className="w-full max-w-md rounded-lg bg-surface p-6 shadow-[var(--shadow-border)]"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(verifyAge(dob) ? "" : "You must be 18 or older to use Storycast.");
          }}
        >
          <p className="text-sm uppercase tracking-[0.18em] text-primary">Age check</p>
          <h1 className="font-display text-2xl tracking-tight">18+ catalog</h1>
          <p className="mt-2 text-sm text-muted">
            Confirm your date of birth to enter the adult section.
          </p>
          <label className="mt-4 block text-sm text-muted">
            Date of birth
            <input
              type="date"
              required
              className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </label>
          <button type="submit" className="mt-4 min-h-11 w-full rounded-md bg-primary font-semibold text-primary-fg">
            I am 18 or older
          </button>
          {msg ? <p className="mt-2 text-sm text-danger">{msg}</p> : null}
        </form>
      </div>
    );
  }

  return children;
}
