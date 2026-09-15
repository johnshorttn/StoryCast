import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Shell } from "@/components/shell";
import { TitleCard } from "@/components/title-card";
import { groupSeries } from "@/lib/catalog-group";
import {
  asFilters,
  parseCatalogSearch,
  searchCatalog,
  uniqueCategories,
  uniqueGenres,
  type CatalogForm,
  type CatalogSearch,
  type CatalogSort,
} from "@/lib/search";
import { useStoryStore } from "@/lib/story-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>) => parseCatalogSearch(raw),
  component: Catalog,
});

function Catalog() {
  const hydrate = useStoryStore((s) => s.hydrate);
  const ready = useStoryStore((s) => s.ready);
  const custom = useStoryStore((s) => s.custom);
  const favorites = useStoryStore((s) => s.favorites);
  const progress = useStoryStore((s) => s.progress);
  const published = useMemo(() => useStoryStore.getState().published(), [custom, ready]);
  const search = Route.useSearch();
  const filters = asFilters(search);
  const navigate = Route.useNavigate();
  const [advanced, setAdvanced] = useState(Boolean(search.genre || search.age || search.form));

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const categories = useMemo(() => uniqueCategories(published), [published]);
  const genres = useMemo(() => uniqueGenres(published), [published]);
  const hits = useMemo(() => searchCatalog(published, filters), [published, filters]);
  const searching = Boolean(filters.q.trim());
  const seriesGroups = useMemo(() => groupSeries(hits.map((h) => h.story)), [hits]);
  const seriesCount = groupSeries(published).length;

  const continueIds = Object.entries(progress)
    .sort((a, b) => b[1].at - a[1].at)
    .map(([id]) => id);
  const continueStories = continueIds
    .map((id) => published.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);
  const savedStories = favorites
    .map((id) => published.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);

  function patch(p: Partial<CatalogSearch>) {
    void navigate({
      search: (prev) => {
        const next: CatalogSearch = { ...prev, ...p };
        if (!next.q) delete next.q;
        if (!next.category) delete next.category;
        if (!next.genre) delete next.genre;
        if (!next.age) delete next.age;
        if (!next.form || next.form === "any") delete next.form;
        if (!next.sort || next.sort === "title") delete next.sort;
        return next;
      },
    });
  }

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.q.trim()) {
    activeChips.push({ key: "q", label: `\u201c${filters.q.trim()}\u201d`, clear: () => patch({ q: "" }) });
  }
  if (filters.category) {
    activeChips.push({ key: "cat", label: filters.category, clear: () => patch({ category: "" }) });
  }
  if (filters.genre) {
    activeChips.push({ key: "genre", label: filters.genre, clear: () => patch({ genre: "" }) });
  }
  if (filters.age) {
    activeChips.push({ key: "age", label: filters.age, clear: () => patch({ age: "" }) });
  }
  if (filters.form !== "any") {
    activeChips.push({ key: "form", label: filters.form, clear: () => patch({ form: "any" }) });
  }

  return (
    <Shell wide>
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.18em] text-primary">Catalog</p>
        <h1 className="font-display text-4xl tracking-tight text-fg">The shelf.</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Browse series like a bookstore. Search titles, character names, and the full script. Filters live in the URL
          so you can share a shelf.
        </p>
        <p className="mt-2 text-sm text-muted">
          {published.length} titles \u00b7 {seriesCount} series \u00b7 {categories.length} categories
        </p>
      </div>

      <div className="mb-6 rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
        <label className="block text-sm text-muted">
          Search the catalog
          <span className="relative mt-1 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              className="min-h-11 w-full rounded-md border border-border bg-bg py-2 pl-10 pr-3 text-fg"
              placeholder="Forklift, Beth, Gaylord, Campfire\u2026"
              value={filters.q}
              onChange={(e) => patch({ q: e.target.value })}
            />
          </span>
        </label>
        <p className="mt-2 text-xs text-muted">
          Matches series, titles, and the full script. Character names are fuzzy \u2014 Bethh, Rae Lynn, or Toany still find
          the cast.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-raised px-3 text-sm text-fg"
          >
            <SlidersHorizontal className="size-4" />
            {advanced ? "Hide filters" : "Advanced search"}
          </button>
          {activeChips.length ? (
            <button
              type="button"
              className="min-h-11 rounded-md px-3 text-sm text-muted"
              onClick={() => void navigate({ search: {} })}
            >
              Clear all
            </button>
          ) : null}
        </div>
        {advanced ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-sm text-muted">
              Genre
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
                value={filters.genre}
                onChange={(e) => patch({ genre: e.target.value })}
              >
                <option value="">Any genre</option>
                {genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-muted">
              Age
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
                value={filters.age}
                onChange={(e) => patch({ age: e.target.value })}
              >
                <option value="">Any age</option>
                <option value="all">All ages</option>
                <option value="18+">18+</option>
              </select>
            </label>
            <label className="block text-sm text-muted">
              Format
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
                value={filters.form}
                onChange={(e) => patch({ form: e.target.value as CatalogForm })}
              >
                <option value="any">Standalone or continuation</option>
                <option value="standalone">Standalone</option>
                <option value="continuation">Continuation</option>
              </select>
            </label>
            <label className="block text-sm text-muted">
              Sort
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
                value={filters.sort}
                onChange={(e) => patch({ sort: e.target.value as CatalogSort })}
              >
                <option value="title">Title</option>
                <option value="series">Series, then chapter</option>
                <option value="chapter">Latest chapter in series</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => patch({ category: "" })}
          className={cn(
            "min-h-11 rounded-md px-3 text-sm",
            !filters.category ? "bg-primary text-primary-fg" : "bg-raised text-fg",
          )}
        >
          All shelves
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => patch({ category: filters.category === c ? "" : c })}
            className={cn(
              "min-h-11 rounded-md px-3 text-sm capitalize",
              filters.category === c ? "bg-primary text-primary-fg" : "bg-raised text-fg",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {activeChips.length ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex min-h-11 items-center gap-1 rounded-md bg-raised px-3 text-sm text-fg"
            >
              {chip.label}
              <X className="size-3.5" />
            </button>
          ))}
        </div>
      ) : null}

      {!searching && continueStories.length ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-2xl">Continue listening</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {continueStories.map((story) => (
              <li key={story.id}>
                <TitleCard story={story} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!searching && savedStories.length ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-2xl">Saved shelf</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {savedStories.map((story) => (
              <li key={story.id}>
                <TitleCard story={story} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mb-4 text-sm text-muted">
        {searching
          ? `${hits.length} ${hits.length === 1 ? "title" : "titles"} matching your search`
          : `${seriesGroups.length} ${seriesGroups.length === 1 ? "series" : "series"} on the shelf`}
      </p>

      {!published.length ? <p className="text-muted">No published stories. Open Admin to add one.</p> : null}

      {searching ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {hits.map(({ story, snippet, where }) => (
            <li key={story.id}>
              <TitleCard story={story} snippet={snippet} where={where} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {seriesGroups.map((g) => {
            const first = g.stories[0];
            const multi = g.stories.length > 1;
            return (
              <li key={g.slug}>
                <TitleCard
                  story={first}
                  chapterCount={g.stories.length}
                  href={
                    multi
                      ? { to: "/series/$slug", params: { slug: g.slug } }
                      : { to: "/listen/$storyId", params: { storyId: first.id } }
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
      {published.length && !hits.length ? (
        <p className="mt-6 text-muted">Nothing on this shelf matches. Clear a filter or try another word.</p>
      ) : null}
    </Shell>
  );
}
