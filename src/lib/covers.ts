import type { Story } from "./story-types";

export type CoverPreset = { id: string; label: string; bg: string; ink: string; mark: string };

export const COVER_PRESETS: CoverPreset[] = [
  { id: "ember", label: "Ember", bg: "#2a2118", ink: "#f3ead8", mark: "#d9773a" },
  { id: "pine", label: "Pine", bg: "#24352a", ink: "#d7e4c8", mark: "#8fbf6a" },
  { id: "warehouse", label: "Warehouse", bg: "#2a2418", ink: "#f0d9a8", mark: "#d9773a" },
  { id: "night", label: "Night", bg: "#1c2733", ink: "#c5d6ea", mark: "#7aa2c8" },
  { id: "rose", label: "Rose", bg: "#2c1c24", ink: "#f0cfd8", mark: "#c45c7a" },
  { id: "slate", label: "Slate", bg: "#22201c", ink: "#e6dfd2", mark: "#a89880" },
  { id: "sakura", label: "Sakura", bg: "#352331", ink: "#ffe8f3", mark: "#f58bb8" },
  { id: "neon", label: "Anime Neon", bg: "#15152f", ink: "#e8f2ff", mark: "#6ee7ff" },
];

export function coverById(id?: string) {
  return COVER_PRESETS.find((p) => p.id === id) || COVER_PRESETS[0];
}

export function coverFromCategory(category: string) {
  const key = category.toLowerCase();
  if (key.includes("outdoor")) return coverById("pine");
  if (key.includes("work")) return coverById("warehouse");
  if (key.includes("test")) return coverById("night");
  if (key.includes("fiction")) return coverById("rose");
  if (key.includes("anime") || key.includes("manga")) return coverById("sakura");
  return coverById("ember");
}

export function coverFor(story: Story) {
  if (story.config.cover) return coverById(story.config.cover);
  return coverFromCategory(story.category || story.config.category);
}
