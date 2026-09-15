import { create } from "zustand";
import { BUNDLED_STORIES } from "./catalog";
import { STARTER_STORY, type Story } from "./story-types";

const KEY = "storycast.stories.v1";
const AGE_KEY = "storycast.age.ok";
const FAV_KEY = "storycast.favs.v1";
const PROG_KEY = "storycast.progress.v1";
const SPEED_KEY = "storycast.speed.v1";

export type ListenProgress = { beat: number; frac: number; at: number };

function loadCustom(): Story[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Story[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustom(stories: Story[]) {
  localStorage.setItem(KEY, JSON.stringify(stories));
}

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
  hydrate: () => void;
  all: () => Story[];
  published: () => Story[];
  save: (story: Story) => void;
  saveMany: (stories: Story[]) => void;
  remove: (id: string) => void;
  setPublished: (id: string, published: boolean) => void;
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
  hydrate: () => {
    const custom = loadCustom();
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
  save: (story) => {
    const custom = get().custom.filter((s) => s.id !== story.id).concat(story);
    saveCustom(custom);
    set({ custom });
  },
  saveMany: (stories) => {
    const byId = new Map(get().custom.map((s) => [s.id, s] as const));
    for (const s of stories) byId.set(s.id, s);
    const custom = [...byId.values()];
    saveCustom(custom);
    set({ custom });
  },
  remove: (id) => {
    const custom = get().custom.filter((s) => s.id !== id);
    const bundled = BUNDLED_STORIES.find((s) => s.id === id);
    if (bundled) {
      const off = { ...bundled, published: false };
      const next = custom.filter((s) => s.id !== id).concat(off);
      saveCustom(next);
      set({ custom: next });
      return;
    }
    saveCustom(custom);
    set({ custom });
  },
  setPublished: (id, published) => {
    const current = merge(get().custom).find((s) => s.id === id);
    if (!current) return;
    get().save({ ...current, published });
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
