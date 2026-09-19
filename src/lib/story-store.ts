import { create } from "zustand";
import { BUNDLED_STORIES } from "./catalog";
import { STARTER_STORY, type Story } from "./story-types";
import { deleteManagedStory, listManagedStories, listPublishedStories, saveManagedStory } from "./story-api";

const AGE_KEY = "storycast.age.ok";
const FAV_KEY = "storycast.favs.v1";
const PROG_KEY = "storycast.progress.v1";
const SPEED_KEY = "storycast.speed.v1";

export type ListenProgress = { beat: number; frac: number; at: number };

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function merge(custom: Story[]): Story[] {
  const byId = new Map<string, Story>();
  for (const s of BUNDLED_STORIES) byId.set(s.id, s);
  for (const s of custom) byId.set(s.id, s);
  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

type State = {
  custom: Story[];
  ready: boolean;
  ageOk: boolean;
  favorites: string[];
  progress: Record<string, ListenProgress>;
  speed: number;
  hydrate: (managed?: boolean) => Promise<void>;
  all: () => Story[];
  published: () => Story[];
  save: (story: Story) => Promise<void>;
  saveMany: (stories: Story[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setPublished: (id: string, published: boolean) => Promise<void>;
  fromTemplate: () => Story;
  verifyAge: (dob: string) => boolean;
  toggleFavorite: (id: string) => void;
  setProgress: (id: string, beat: number, frac: number) => void;
  clearProgress: (id: string) => void;
  setSpeed: (speed: number) => void;
};

export const useStoryStore = create<State>((set, get) => ({
  custom: [],
  ready: false,
  ageOk: false,
  favorites: [],
  progress: {},
  speed: 1,
  hydrate: async (managed = false) => {
    const custom = managed ? await listManagedStories() : await listPublishedStories();
    const ageOk = typeof window !== "undefined" && localStorage.getItem(AGE_KEY) === "1";
    const speedRaw = typeof window !== "undefined" ? Number(localStorage.getItem(SPEED_KEY) || "1") : 1;
    set({
      custom,
      ready: true,
      ageOk,
      favorites: loadJson<string[]>(FAV_KEY, []),
      progress: loadJson<Record<string, ListenProgress>>(PROG_KEY, {}),
      speed: speedRaw === 0.9 || speedRaw === 1.15 ? speedRaw : 1,
    });
  },
  all: () => merge(get().custom),
  published: () => merge(get().custom).filter((s) => s.published !== false),
  save: async (story) => {
    const result = await saveManagedStory({ data: { story } });
    const custom = get().custom.filter((s) => s.id !== story.id).concat(result.story);
    set({ custom });
  },
  saveMany: async (stories) => {
    const byId = new Map(get().custom.map((s) => [s.id, s] as const));
    for (const story of stories) {
      const result = await saveManagedStory({ data: { story } });
      byId.set(result.story.id, result.story);
    }
    const custom = [...byId.values()];
    set({ custom });
  },
  remove: async (id) => {
    const custom = get().custom.filter((s) => s.id !== id);
    const bundled = BUNDLED_STORIES.find((s) => s.id === id);
    if (bundled) {
      const off = { ...bundled, published: false };
      await saveManagedStory({ data: { story: off } });
      const next = custom.filter((s) => s.id !== id).concat(off);
      set({ custom: next });
      return;
    }
    await deleteManagedStory({ data: { id } });
    set({ custom });
  },
  setPublished: async (id, published) => {
    const current = merge(get().custom).find((s) => s.id === id);
    if (!current) return;
    await get().save({ ...current, published });
  },
  fromTemplate: () => {
    const t = structuredClone(STARTER_STORY);
    t.id = `story-${Date.now().toString(36)}`;
    t.title = "Untitled";
    t.config.title = "Untitled";
    t.config.series = "Untitled";
    return t;
  },
  verifyAge: (dob) => {
    const d = new Date(`${dob}T00:00:00`);
    if (Number.isNaN(d.getTime()) || d.getFullYear() < 1900) {
      set({ ageOk: false });
      return false;
    }
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const month = now.getMonth() - d.getMonth();
    if (month < 0 || (month === 0 && now.getDate() < d.getDate())) age -= 1;
    const ok = age >= 18;
    if (ok) localStorage.setItem(AGE_KEY, "1");
    set({ ageOk: ok });
    return ok;
  },
  toggleFavorite: (id) => {
    const has = get().favorites.includes(id);
    const favorites = has ? get().favorites.filter((x) => x !== id) : get().favorites.concat(id);
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
    set({ favorites });
  },
  setProgress: (id, beat, frac) => {
    const progress = { ...get().progress, [id]: { beat, frac, at: Date.now() } };
    localStorage.setItem(PROG_KEY, JSON.stringify(progress));
    set({ progress });
  },
  clearProgress: (id) => {
    const progress = { ...get().progress };
    delete progress[id];
    localStorage.setItem(PROG_KEY, JSON.stringify(progress));
    set({ progress });
  },
  setSpeed: (speed) => {
    localStorage.setItem(SPEED_KEY, String(speed));
    set({ speed });
  },
}));

export function needsAgeGate(stories: Story[]) {
  return stories.some((s) => s.config.age === "18+" || s.rating === "explicit");
}
