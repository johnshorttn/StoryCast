import { useEffect, useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { TitleCard } from "@/components/title-card";
import { castMembers, compactId, storiesForCast } from "@/lib/catalog-group";
import { useStoryStore } from "@/lib/story-store";

export const Route = createFileRoute("/cast/$slug")({
  component: CastPage,
});

function CastPage() {
  const { slug } = Route.useParams();
  const hydrate = useStoryStore((s) => s.hydrate);
  const ready = useStoryStore((s) => s.ready);
  const custom = useStoryStore((s) => s.custom);
  const published = useMemo(() => useStoryStore.getState().published(), [custom, ready]);
  const titles = storiesForCast(published, slug);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const key = compactId(slug);
  const name =
    titles
      .flatMap((s) => castMembers(s))
      .find((c) => compactId(c.id) === key || compactId(c.defaultName) === key || compactId(c.pronounceAs || "") === key)
      ?.defaultName || slug;

  return (
    <Shell wide>
      <Link to="/" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted no-underline hover:text-fg">
        <ArrowLeft className="size-4" />
        Back to catalog
      </Link>
      <p className="text-sm uppercase tracking-[0.18em] text-primary">Cast</p>
      <h1 className="font-display text-3xl tracking-tight">{name}</h1>
      <p className="mb-6 text-sm text-muted">
        {titles.length} {titles.length === 1 ? "title" : "titles"}
      </p>
      {!titles.length ? <p className="text-muted">No published titles for this character.</p> : null}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {titles.map((story) => (
          <li key={story.id}>
            <TitleCard story={story} />
          </li>
        ))}
      </ul>
    </Shell>
  );
}
