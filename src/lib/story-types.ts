export type Gender = "male" | "female" | "neutral";

export type StoryCharacter = {
  id: string;
  defaultName: string;
  pronounceAs?: string;
  defaultVoice: "male-low" | "female-warm" | "narrator";
};

export type StoryBeat = {
  id: string;
  speaker: string;
  text: string;
};

export type StoryConfig = {
  title: string;
  series: string;
  chapter: number;
  episode: number;
  version: number;
  continuation: boolean;
  genre: string;
  category: string;
  age: "all" | "18+";
  characterCount: number;
  cover?: string;
  characters: { id: string; name: string; gender: Gender; pronounceAs?: string }[];
};

export type Story = {
  id: string;
  title: string;
  storyRev: number;
  rating: "general" | "explicit";
  published: boolean;
  category: string;
  allowNameChange: boolean;
  locale: string;
  config: StoryConfig;
  characters: StoryCharacter[];
  beats: StoryBeat[];
};

export function displayTitle(story: Story) {
  const c = story.config;
  let title = c.title || story.title;
  if (c.continuation && c.chapter) title += ` — Ch. ${c.chapter}`;
  else if (c.continuation && c.episode) title += ` — Ep. ${c.episode}`;
  if (c.version && c.version > 1) title += ` (v${c.version})`;
  return title;
}

export function applyNames(text: string, names: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, id: string) => names[id] ?? id);
}

export function spokenNames(story: Story, display: Record<string, string>, speak: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const ch of story.characters) {
    out[ch.id] = (speak[ch.id] || display[ch.id] || ch.pronounceAs || ch.defaultName).trim();
  }
  return out;
}

export function defaultDisplayNames(story: Story) {
  const o: Record<string, string> = {};
  for (const ch of story.characters) o[ch.id] = ch.defaultName;
  return o;
}

export function defaultSpeak(story: Story) {
  const o: Record<string, string> = {};
  for (const ch of story.characters) o[ch.id] = ch.pronounceAs || ch.defaultName;
  return o;
}

export function defaultGenders(story: Story) {
  const o: Record<string, Gender> = {};
  for (const ch of story.characters) {
    if (ch.id === "narrator") o[ch.id] = "male";
    else if (ch.defaultVoice.startsWith("male")) o[ch.id] = "male";
    else o[ch.id] = "female";
  }
  for (const c of story.config.characters) o[c.id] = c.gender;
  return o;
}

export function beatsForMode(story: Story, mode: "narrator" | "cast") {
  if (mode === "cast") return story.beats;
  return story.beats.map((b) => ({ ...b, speaker: "narrator" }));
}

export const STARTER_STORY: Story = {
  id: "new-story",
  title: "New Story",
  storyRev: 1,
  rating: "general",
  published: true,
  category: "fiction",
  allowNameChange: true,
  locale: "en-US",
  config: {
    title: "New Story",
    series: "New Story",
    chapter: 1,
    episode: 1,
    version: 1,
    continuation: false,
    genre: "fiction",
    category: "fiction",
    age: "all",
    cover: "ember",
    characterCount: 2,
    characters: [
      { id: "one", name: "One", gender: "male", pronounceAs: "One" },
      { id: "two", name: "Two", gender: "female", pronounceAs: "Two" },
    ],
  },
  characters: [
    { id: "one", defaultName: "One", pronounceAs: "One", defaultVoice: "male-low" },
    { id: "two", defaultName: "Two", pronounceAs: "Two", defaultVoice: "female-warm" },
    { id: "narrator", defaultName: "Narrator", defaultVoice: "narrator" },
  ],
  beats: [
    { id: "b1", speaker: "narrator", text: "Set the place and time. Keep it concrete." },
    { id: "b2", speaker: "one", text: "First line from {{one}}." },
    { id: "b3", speaker: "two", text: "First line from {{two}}." },
    { id: "b4", speaker: "narrator", text: "{{two}} and {{one}} close the distance. Slow down here." },
    { id: "b5", speaker: "two", text: "Say what they want." },
    { id: "b6", speaker: "one", text: "Answer it." },
    { id: "b7", speaker: "narrator", text: "The turn. Stay in the room. Use names {{one}} and {{two}}." },
    { id: "b8", speaker: "narrator", text: "After. What they do with their hands when the work starts again." },
  ],
};
