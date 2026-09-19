import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AdultStoryGate } from "@/components/adult-story-gate";
import { Player } from "@/components/player";
import { Shell } from "@/components/shell";
import { loadSharedStory } from "@/lib/story-api";
import { displayTitle, type Story } from "@/lib/story-types";

export const Route = createFileRoute("/share/$token")({ component: SharedStoryPage });

function SharedStoryPage() {
  const { token } = Route.useParams();
  const [story, setStory] = useState<Story | null | undefined>(undefined);

  useEffect(() => {
    void loadSharedStory({ data: { token } })
      .then(setStory)
      .catch(() => setStory(null));
  }, [token]);

  return (
    <Shell>
      <Link
        to="/"
        className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted no-underline hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        Back to Storycast
      </Link>
      {story === undefined ? <p className="text-muted">Opening shared story…</p> : null}
      {story === null ? (
        <div className="rounded-lg bg-surface p-5 shadow-[var(--shadow-border)]">
          <h1 className="font-display text-2xl">Share link unavailable</h1>
          <p className="mt-2 text-muted">
            This link may have expired or been revoked by its owner.
          </p>
        </div>
      ) : null}
      {story ? (
        <AdultStoryGate restricted={story.config.age === "18+" || story.rating === "explicit"}>
          <p className="text-sm uppercase tracking-[0.18em] text-primary">Shared privately</p>
          <h1 className="mb-6 font-display text-3xl tracking-tight">{displayTitle(story)}</h1>
          <Player story={story} />
        </AdultStoryGate>
      ) : null}
    </Shell>
  );
}
