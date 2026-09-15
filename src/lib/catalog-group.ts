import type { Story } from "./story-types";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

export function compactId(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function seriesName(story: Story) {
  return story.config.series || story.title;
}

export function seriesSlug(story: Story) {
  return slugify(seriesName(story));
}

export function castSlug(name: string) {
  return slugify(name);
}

export function storiesInSeries(stories: Story[], slug: string) {
  return stories
    .filter((s) => seriesSlug(s) === slug)
    .sort((a, b) => (a.config.chapter || 0) - (b.config.chapter || 0) || a.id.localeCompare(b.id));
}

export function nextInSeries(stories: Story[], story: Story) {
  const list = storiesInSeries(stories, seriesSlug(story));
  const i = list.findIndex((s) => s.id === story.id);
  return i >= 0 ? list[i + 1] : undefined;
}

export type SeriesGroup = { slug: string; name: string; stories: Story[] };

export function groupSeries(stories: Story[]): SeriesGroup[] {
  const map = new Map<string, SeriesGroup>();
  for (const s of stories) {
    const slug = seriesSlug(s);
    const g = map.get(slug) || { slug, name: seriesName(s), stories: [] };
    g.stories.push(s);
    map.set(slug, g);
  }
  return [...map.values()]
    .map((g) => ({
      ...g,
      stories: [...g.stories].sort((a, b) => (a.config.chapter || 0) - (b.config.chapter || 0)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function storiesForCast(stories: Story[], slug: string) {
  const key = compactId(slug);
  if (!key) return [];
  return stories.filter((s) =>
    s.characters.some((c) => {
      if (c.id === "narrator") return false;
      return compactId(c.id) === key || compactId(c.defaultName) === key || compactId(c.pronounceAs || "") === key;
    }),
  );
}

export function castMembers(story: Story) {
  return story.characters.filter((c) => c.id !== "narrator");
}
