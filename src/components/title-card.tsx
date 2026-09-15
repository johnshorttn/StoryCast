import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { StoryCover } from "@/components/story-cover";
import { castMembers, castSlug, seriesSlug } from "@/lib/catalog-group";
import { displayTitle, type Story } from "@/lib/story-types";
import { useStoryStore } from "@/lib/story-store";
import { cn } from "@/lib/utils";

export function TitleCard({
  story,
  snippet,
  where,
  href,
  chapterCount,
}: {
  story: Story;
  snippet?: string;
  where?: string[];
  href?: { to: "/listen/$storyId"; params: { storyId: string } } | { to: "/series/$slug"; params: { slug: string } };
  chapterCount?: number;
}) {
  const favorites = useStoryStore((s) => s.favorites);
  const toggleFavorite = useStoryStore((s) => s.toggleFavorite);
  const saved = favorites.includes(story.id);
  const cast = castMembers(story);
  const dest = href || { to: "/listen/$storyId" as const, params: { storyId: story.id } };
  const coverLink =
    dest.to === "/series/$slug" ? (
      <Link to="/series/$slug" params={{ slug: dest.params.slug }} className="block text-fg no-underline">
        <StoryCover story={story} chapterCount={chapterCount} />
      </Link>
    ) : (
      <Link to="/listen/$storyId" params={{ storyId: dest.params.storyId }} className="block text-fg no-underline">
        <StoryCover story={story} chapterCount={chapterCount} />
      </Link>
    );
  const titleLink =
    dest.to === "/series/$slug" ? (
      <Link
        to="/series/$slug"
        params={{ slug: dest.params.slug }}
        className="font-display text-lg leading-tight text-fg no-underline"
      >
        {chapterCount && chapterCount > 1 ? story.config.series || story.title : displayTitle(story)}
      </Link>
    ) : (
      <Link
        to="/listen/$storyId"
        params={{ storyId: dest.params.storyId }}
        className="font-display text-lg leading-tight text-fg no-underline"
      >
        {chapterCount && chapterCount > 1 ? story.config.series || story.title : displayTitle(story)}
      </Link>
    );

  return (
    <article className="rounded-lg bg-surface p-3 shadow-[var(--shadow-border)] transition-[box-shadow] hover:shadow-[var(--shadow-border-hover)]">
      {coverLink}
      <div className="mt-3 flex items-start justify-between gap-2">
        {titleLink}
        <button
          type="button"
          className="grid size-11 shrink-0 place-items-center rounded-md bg-raised text-fg"
          aria-label={saved ? "Remove from saved shelf" : "Save to shelf"}
          onClick={() => toggleFavorite(story.id)}
        >
          <Heart className={cn("size-4", saved && "fill-primary text-primary")} />
        </button>
      </div>
      <p className="text-xs uppercase tracking-wide text-muted">
        <Link
          to="/series/$slug"
          params={{ slug: seriesSlug(story) }}
          className="text-muted no-underline hover:text-fg"
        >
          {story.config.series || story.title}
        </Link>
        {" · "}
        {story.category || story.config.category} · {story.config.age}
      </p>
      <p className="mt-1 text-sm text-muted">
        {cast.length
          ? cast.map((c, i) => (
              <span key={c.id}>
                {i ? " · " : null}
                <Link to="/cast/$slug" params={{ slug: castSlug(c.defaultName) }} className="text-muted hover:text-fg">
                  {c.defaultName}
                </Link>
              </span>
            ))
          : "Narrator only"}
      </p>
      {chapterCount && chapterCount > 1 ? (
        <p className="mt-1 text-sm text-muted">{chapterCount} chapters</p>
      ) : null}
      {snippet ? <p className="mt-2 line-clamp-3 text-sm text-fg/80">{snippet}</p> : null}
      {where?.length ? (
        <p className="mt-2 text-[11px] uppercase tracking-wide text-primary">Found in {where.join(" · ")}</p>
      ) : null}
    </article>
  );
}
