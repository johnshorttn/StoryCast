import { useEffect, useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { TitleCard } from "@/components/title-card";
import { seriesName, storiesInSeries } from "@/lib/catalog-group";
import { useStoryStore } from "@/lib/story-store";

export const Route = createFileRoute("/series/$slug")({
  component: SeriesPage,
});

function SeriesPage() {
  const { slug } = Route.useParams();
  const hydrate = useStoryStore((s) => s.hydrate);
  const ready = useStoryStore((s) => s.ready);
  const custom = useStoryStore((s) => s.custom);
  const published = useMemo(() => useStoryStore.getState().published(), [custom, ready]);
  const chapters = storiesInSeries(published, slug);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const name = chapters[0] ? seriesName(chapters[0]) : slug;

  return (
    <Shell wide>
      <Link to="/" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted no-underline hover:text-fg">
        <ArrowLeft className="size-4" />
        Back to catalog
      </Link>
      <p className="text-sm uppercase tracking-[0.18em] text-primary">Series</p>
      <h1 className="font-display text-3xl tracking-tight">{name}</h1>
      <p className="mb-6 text-sm text-muted">
        {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}
      </p>
      {!chapters.length ? <p className="text-muted">No published chapters in this series.</p> : null}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {chapters.map((story) => (
          <li key={story.id}>
            <TitleCard story={story} />
          </li>
        ))}
      </ul>
    </Shell>
  );
}
