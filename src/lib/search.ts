import { displayTitle, type Story } from "./story-types";
import { coverFromCategory } from "./covers";

export type CatalogForm = "any" | "standalone" | "continuation";
export type CatalogSort = "title" | "series" | "chapter";

export type CatalogFilters = {
  q: string;
  category: string;
  genre: string;
  age: string;
  form: CatalogForm;
  sort: CatalogSort;
};

export type CatalogSearch = {
  q?: string;
  category?: string;
  genre?: string;
  age?: string;
  form?: CatalogForm;
  sort?: CatalogSort;
};

export function emptyFilters(): CatalogFilters {
  return { q: "", category: "", genre: "", age: "", form: "any", sort: "title" };
}

export function parseCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const out: CatalogSearch = {};
  if (typeof raw.q === "string" && raw.q) out.q = raw.q;
  if (typeof raw.category === "string" && raw.category) out.category = raw.category;
  if (typeof raw.genre === "string" && raw.genre) out.genre = raw.genre;
  if (typeof raw.age === "string" && raw.age) out.age = raw.age;
  if (raw.form === "standalone" || raw.form === "continuation") out.form = raw.form;
  if (raw.sort === "series" || raw.sort === "chapter") out.sort = raw.sort;
  return out;
}

export function asFilters(search: CatalogSearch): CatalogFilters {
  return {
    q: search.q ?? "",
    category: search.category ?? "",
    genre: search.genre ?? "",
    age: search.age ?? "",
    form: search.form ?? "any",
    sort: search.sort ?? "title",
  };
}

function fold(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function compact(s: string) {
  return fold(s).replace(/[^a-z0-9]/g, "");
}

export function tokens(q: string) {
  return fold(q)
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 0);
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
}

export function characterNameKeys(story: Story): string[] {
  const raw: string[] = [];
  for (const c of story.characters) {
    if (c.id === "narrator") continue;
    raw.push(c.id, c.defaultName, c.pronounceAs || "");
  }
  for (const c of story.config.characters) {
    raw.push(c.id, c.name, c.pronounceAs || "");
  }
  const keys = new Set<string>();
  for (const n of raw) {
    if (!n) continue;
    const f = fold(n);
    const c = compact(n);
    if (f) keys.add(f);
    if (c) keys.add(c);
    for (const part of f.split(/[^a-z0-9]+/).filter(Boolean)) keys.add(part);
  }
  return [...keys];
}

export function fuzzyNameMatch(query: string, name: string) {
  const q = fold(query);
  const n = fold(name);
  if (!q || !n) return false;
  if (n.includes(q) || q.includes(n)) return true;
  const qc = compact(q);
  const nc = compact(n);
  if (qc && nc && (nc.includes(qc) || qc.includes(nc))) return true;
  if (q.length <= 2) return n.startsWith(q) || nc.startsWith(qc);
  if (n.startsWith(q) || nc.startsWith(qc)) return true;
  const dist = Math.min(levenshtein(q, n), levenshtein(qc, nc));
  const maxLen = Math.max(q.length, n.length, qc.length, nc.length);
  const allowed = maxLen <= 4 ? 1 : maxLen <= 7 ? 2 : Math.floor(maxLen * 0.34);
  return dist <= allowed;
}

function namesMatchToken(keys: string[], token: string) {
  return keys.some((k) => fuzzyNameMatch(token, k));
}

function defaultNameFor(story: Story, id: string) {
  const ch = story.characters.find((c) => c.id === id);
  if (ch) return ch.defaultName;
  const cfg = story.config.characters.find((c) => c.id === id);
  return cfg?.name || id;
}

function spokenBeat(story: Story, text: string) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, id: string) => defaultNameFor(story, id));
}

export function storyIndex(story: Story) {
  const nameKeys = characterNameKeys(story);
  const beats = story.beats.map((b) => spokenBeat(story, b.text));
  return {
    title: fold(`${story.title} ${story.config.title} ${displayTitle(story)}`),
    series: fold(story.config.series || story.title),
    meta: fold(
      `${story.id} ${story.category} ${story.config.category} ${story.config.genre} ${story.config.age} ${story.rating}`,
    ),
    names: nameKeys.join(" "),
    nameKeys,
    body: fold(beats.join("\n")),
    beats,
  };
}

function haystack(idx: ReturnType<typeof storyIndex>) {
  return `${idx.title} ${idx.series} ${idx.meta} ${idx.names} ${idx.body}`;
}

export type CatalogHit = {
  story: Story;
  snippet: string;
  where: ("title" | "series" | "characters" | "story")[];
};

function snippetFor(idx: ReturnType<typeof storyIndex>, toks: string[]) {
  if (!toks.length) return idx.beats[0] || "";
  const hit = idx.beats.find((b) => {
    const f = fold(b);
    return toks.every((t) => f.includes(t)) || toks.some((t) => f.includes(t));
  });
  const raw = hit || idx.beats[0] || "";
  return raw.length > 160 ? raw.slice(0, 157).trimEnd() + "…" : raw;
}

function whereHits(idx: ReturnType<typeof storyIndex>, toks: string[]) {
  const where: CatalogHit["where"] = [];
  if (toks.some((t) => idx.title.includes(t) || idx.series.includes(t))) where.push("title");
  if (toks.some((t) => idx.series.includes(t))) where.push("series");
  if (toks.some((t) => idx.names.includes(t) || namesMatchToken(idx.nameKeys, t))) where.push("characters");
  if (toks.some((t) => idx.body.includes(t))) where.push("story");
  return [...new Set(where)];
}

export function uniqueCategories(stories: Story[]) {
  return [...new Set(stories.map((s) => s.category || s.config.category).filter(Boolean))].sort();
}

export function uniqueGenres(stories: Story[]) {
  return [...new Set(stories.map((s) => s.config.genre).filter(Boolean))].sort();
}

export function searchCatalog(stories: Story[], filters: CatalogFilters): CatalogHit[] {
  const toks = tokens(filters.q);
  const phrase = compact(filters.q);
  let list = stories.filter((s) => {
    if (filters.category && (s.category || s.config.category) !== filters.category) return false;
    if (filters.genre && s.config.genre !== filters.genre) return false;
    if (filters.age && s.config.age !== filters.age) return false;
    if (filters.form === "standalone" && s.config.continuation) return false;
    if (filters.form === "continuation" && !s.config.continuation) return false;
    if (!toks.length) return true;
    const idx = storyIndex(s);
    const hay = haystack(idx);
    if (phrase && namesMatchToken(idx.nameKeys, phrase)) return true;
    return toks.every((t) => hay.includes(t) || namesMatchToken(idx.nameKeys, t));
  });

  list = [...list].sort((a, b) => {
    if (filters.sort === "series") {
      const s = (a.config.series || a.title).localeCompare(b.config.series || b.title);
      if (s) return s;
      return (a.config.chapter || 0) - (b.config.chapter || 0);
    }
    if (filters.sort === "chapter") {
      const s = (a.config.series || a.title).localeCompare(b.config.series || b.title);
      if (s) return s;
      return (b.config.chapter || 0) - (a.config.chapter || 0);
    }
    return displayTitle(a).localeCompare(displayTitle(b));
  });

  return list.map((story) => {
    const idx = storyIndex(story);
    return {
      story,
      snippet: snippetFor(idx, toks),
      where: toks.length ? whereHits(idx, toks) : [],
    };
  });
}

export function coverTone(category: string) {
  return coverFromCategory(category);
}
