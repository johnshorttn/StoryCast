import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck } from "lucide-react";
import { useStoryStore } from "@/lib/story-store";

type AdultStoryGateProps = {
  restricted: boolean;
  children: ReactNode;
};

export function AdultStoryGate({ restricted, children }: AdultStoryGateProps) {
  const ageOk = useStoryStore((state) => state.ageOk);
  const verifyAge = useStoryStore((state) => state.verifyAge);
  const contentRef = useRef<HTMLDivElement>(null);
  const dobRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [dob, setDob] = useState("");
  const [message, setMessage] = useState("");
  const locked = restricted && !ageOk;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    content.inert = locked;
  }, [locked]);

  useEffect(() => {
    if (!locked) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dobRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [locked, mounted]);

  const portal =
    locked && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-bg/90 px-4 py-8 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adult-story-title"
            aria-describedby="adult-story-description"
          >
            <form
              className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-2xl"
              onSubmit={(event) => {
                event.preventDefault();
                setMessage(verifyAge(dob) ? "" : "You must be 18 or older to open this story.");
              }}
            >
              <div className="mb-4 grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
                <ShieldCheck className="size-6" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Restricted share
              </p>
              <h1 id="adult-story-title" className="mt-1 font-display text-3xl tracking-tight">
                This story is for adults
              </h1>
              <p id="adult-story-description" className="mt-3 text-sm leading-6 text-muted">
                Confirm your date of birth to reveal the story. Playback, voice previews, and
                downloads stay disabled until verification succeeds.
              </p>
              <label className="mt-5 block text-sm font-medium text-fg">
                Date of birth
                <input
                  ref={dobRef}
                  type="date"
                  required
                  autoComplete="bday"
                  className="mt-2 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
                  value={dob}
                  onChange={(event) => {
                    setDob(event.target.value);
                    setMessage("");
                  }}
                />
              </label>
              <button
                type="submit"
                className="mt-5 min-h-11 w-full rounded-md bg-primary px-4 font-semibold text-primary-fg"
              >
                Verify age and continue
              </button>
              <a
                href="/"
                className="mt-3 flex min-h-11 items-center justify-center text-sm text-muted hover:text-fg"
              >
                Leave this story
              </a>
              {message ? (
                <p className="mt-2 text-sm text-danger" role="alert">
                  {message}
                </p>
              ) : null}
            </form>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={contentRef}
        aria-hidden={locked || undefined}
        className={locked ? "pointer-events-none select-none blur-md" : undefined}
      >
        {children}
      </div>
      {portal}
    </>
  );
}
