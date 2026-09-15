import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Heart } from "lucide-react";
import { Shell } from "@/components/shell";
import { Player } from "@/components/player";
import { castMembers, castSlug, nextInSeries, seriesSlug } from "@/lib/catalog-group";
import { displayTitle } from "@/lib/story-types";
import { needsAgeGate, useStoryStore } from "@/lib/story-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/listen/$storyId")({
  validateSearch: (raw: Record<string, unknown>): { autoplay?: boolean } =>
    raw.autoplay === true || raw.autoplay === "true" || raw.autoplay === "1" ? { autoplay: true } : {},
  component: ListenPage,
});

function ListenPage() {
  const { storyId } = Route.useParams();
  const { autoplay } = Route.useSearch();
  const navigate = Route.useNavigate();
  const hydrate = useStoryStore((s) => s.hydrate);
  const ready = useStoryStore((s) => s.ready);
  const custom = useStoryStore((s) => s.custom);
  const ageOk = useStoryStore((s) => s.ageOk);
  const verifyAge = useStoryStore((s) => s.verifyAge);
  const favorites = useStoryStore((s) => s.favorites);
  const toggleFavorite = useStoryStore((s) => s.toggleFavorite);
  const published = useMemo(() => useStoryStore.getState().published(), [custom, ready]);
  const story = published.find((s) => s.id === storyId);
  const next = story ? nextInSeries(published, story) : undefined;
  const [dob, setDob] = useState("1981-02-09");
  const [gateMsg, setGateMsg] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const gated = !!story && needsAgeGate([story]) && !ageOk;
  const saved = story ? favorites.includes(story.id) : false;

  return (
    <Shell>
      <Link
        to="/"
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted no-underline hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        Back to catalog
      </Link>
      {!ready ? <p className="text-muted">Loading catalog…</p> : null}
      {ready && !story ? (
        <p className="text-muted">That title is not in the catalog. It may be unpublished.</p>
      ) : null}
      {story && gated ? (
        <form
          className="max-w-md rounded-lg bg-surface p-5 shadow-[var(--shadow-border)]"
          onSubmit={(e) => {
            e.preventDefault();
            setGateMsg(verifyAge(dob) ? "Verified" : "Must be 18 or older");
          }}
        >
          <p className="font-display text-lg">18+ title</p>
          <p className="mb-3 text-sm text-muted">Confirm your date of birth to listen.</p>
          <label className="block text-sm text-muted">
            Date of birth
            <input
              type="date"
              className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </label>
          <button type="submit" className="mt-3 min-h-11 rounded-md bg-primary px-4 font-semibold text-primary-fg">
            Confirm age
          </button>
          {gateMsg ? <p className="mt-2 text-sm text-muted">{gateMsg}</p> : null}
        </form>
      ) : null}
      {story && !gated ? (
        <>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-primary">
                <Link
                  to="/series/$slug"
                  params={{ slug: seriesSlug(story) }}
                  className="text-primary no-underline hover:underline"
                >
                  {story.config.series}
                </Link>
                {" · "}
                {story.config.genre}
              </p>
              <h1 className="font-display text-3xl tracking-tight">{displayTitle(story)}</h1>
              <p className="text-sm text-muted">
                {story.config.characterCount} characters · {story.config.age} ·{" "}
                {story.config.continuation ? "Continuation" : "Standalone"}
                {castMembers(story).map((c) => (
                  <span key={c.id}>
                    {" · "}
                    <Link to="/cast/$slug" params={{ slug: castSlug(c.defaultName) }} className="text-muted hover:text-fg">
                      {c.defaultName}
                    </Link>
                  </span>
                ))}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-raised px-3 text-sm text-fg"
              onClick={() => toggleFavorite(story.id)}
            >
              <Heart className={cn("size-4", saved && "fill-primary text-primary")} />
              {saved ? "Saved" : "Save"}
            </button>
          </div>
          <Player
            story={story}
            nextStory={next}
            autoplay={Boolean(autoplay)}
            onPlayNext={
              next
                ? () => {
                    void navigate({
                      to: "/listen/$storyId",
                      params: { storyId: next.id },
                      search: { autoplay: true },
                    });
                  }
                : undefined
            }
          />
        </>
      ) : null}
    </Shell>
  );
}
