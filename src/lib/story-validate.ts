import { STARTER_STORY, type Gender, type Story, type StoryBeat, type StoryCharacter } from "./story-types.ts";
import { isStoryV3, storyV3ToV2 } from "./story-v3.ts";

export type StoryIssue = { level: "error" | "warn"; message: string };

export type ImportSkip = { id: string; issues: string[] };

export type ImportResult = {
  error?: string;
  imported: Story[];
  skipped: ImportSkip[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function stripFences(s: string) {
  return s.replace(/```(?:json)?/gi, "").trim();
}

function extractJsonValues(text: string): unknown[] {
  const s = stripFences(text);
  const out: unknown[] = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && s[i] !== "{" && s[i] !== "[") i++;
    if (i >= s.length) break;
    const start = i;
    let depth = 0;
    let quote: string | null = null;
    for (; i < s.length; i++) {
      const ch = s[i];
      if (quote) {
        if (ch === "\\") {
          i++;
          continue;
        }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"') {
        quote = ch;
        continue;
      }
      if (ch === "{" || ch === "[") depth++;
      if (ch === "}" || ch === "]") {
        depth--;
        if (depth === 0) {
          i++;
          try {
            out.push(JSON.parse(s.slice(start, i)));
          } catch {
            return [];
          }
          break;
        }
      }
    }
    if (depth !== 0) break;
  }
  return out;
}

function flattenStories(values: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const v of values) {
    if (Array.isArray(v)) out.push(...flattenStories(v));
    else if (isRecord(v)) out.push(v);
  }
  return out;
}

function asGender(v: unknown): Gender {
  return v === "male" || v === "female" || v === "neutral" ? v : "female";
}

function voiceFromGender(gender: Gender, id: string): StoryCharacter["defaultVoice"] {
  if (id === "narrator") return "narrator";
  return gender === "male" ? "male-low" : "female-warm";
}

export function normalizeStory(raw: unknown): Story | null {
  if (isStoryV3(raw)) return normalizeStory(storyV3ToV2(raw));
  if (!isRecord(raw)) return null;
  const configIn = isRecord(raw.config) ? raw.config : {};
  const configCastRaw = Array.isArray(configIn.characters) ? configIn.characters : [];
  const charsRaw = Array.isArray(raw.characters) ? raw.characters : [];

  const configChars = configCastRaw
    .filter(isRecord)
    .map((c) => ({
      id: String(c.id || "").trim(),
      name: String(c.name || c.defaultName || c.id || "").trim(),
      gender: asGender(c.gender),
      pronounceAs: String(c.pronounceAs || c.name || "").trim() || undefined,
    }))
    .filter((c) => c.id && c.id !== "narrator");

  let characters: StoryCharacter[] = charsRaw
    .filter(isRecord)
    .map((c) => {
      const id = String(c.id || "").trim();
      const cfg = configChars.find((x) => x.id === id);
      const gender = cfg?.gender || (String(c.defaultVoice || "").startsWith("male") ? "male" : "female");
      return {
        id,
        defaultName: String(c.defaultName || c.name || cfg?.name || id).trim(),
        pronounceAs: String(c.pronounceAs || cfg?.pronounceAs || c.defaultName || "").trim() || undefined,
        defaultVoice: voiceFromGender(gender as Gender, id),
      };
    })
    .filter((c) => c.id);

  if (!configChars.length && characters.length) {
    for (const c of characters) {
      if (c.id === "narrator") continue;
      configChars.push({
        id: c.id,
        name: c.defaultName,
        gender: c.defaultVoice === "male-low" ? "male" : "female",
        pronounceAs: c.pronounceAs,
      });
    }
  }

  if (!characters.length && configChars.length) {
    characters = configChars.map((c) => ({
      id: c.id,
      defaultName: c.name,
      pronounceAs: c.pronounceAs,
      defaultVoice: voiceFromGender(c.gender, c.id),
    }));
  }

  if (!characters.some((c) => c.id === "narrator")) {
    characters.push({ id: "narrator", defaultName: "Narrator", defaultVoice: "narrator" });
  }

  const seen = new Set<string>();
  characters = characters.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  const beats: StoryBeat[] = (Array.isArray(raw.beats) ? raw.beats : [])
    .filter(isRecord)
    .map((b, i) => ({
      id: String(b.id || `b${i + 1}`).trim(),
      speaker: String(b.speaker || "narrator").trim(),
      text: String(b.text || "").trim(),
    }));

  const title = String(configIn.title || raw.title || "").trim();
  const series = String(configIn.series || title).trim();
  const category = String(configIn.category || raw.category || "fiction").trim() || "fiction";
  const age = configIn.age === "18+" || raw.rating === "explicit" ? "18+" : "all";
  const continuation = Boolean(configIn.continuation);
  const chapter = Number(configIn.chapter) || 1;
  const episode = Number(configIn.episode) || chapter;
  const version = Number(configIn.version || raw.storyRev) || 1;

  return {
    id: String(raw.id || "").trim().toLowerCase(),
    title: title || STARTER_STORY.title,
    storyRev: version,
    rating: age === "18+" ? "explicit" : "general",
    published: raw.visibility ? raw.visibility === "public" : raw.published !== false,
    visibility:
      raw.visibility === "public" || raw.visibility === "unlisted" || raw.visibility === "private"
        ? raw.visibility
        : raw.published !== false ? "public" : "private",
    category,
    allowNameChange: raw.allowNameChange !== false,
    locale: String(raw.locale || "en-US"),
    config: {
      title: title || STARTER_STORY.title,
      series: series || title || STARTER_STORY.title,
      chapter,
      episode,
      version,
      continuation,
      genre: String(configIn.genre || category).trim() || "fiction",
      category,
      age,
      cover: typeof configIn.cover === "string" ? configIn.cover : undefined,
      characterCount: configChars.length,
      characters: configChars,
    },
    characters,
    beats,
  };
}

export function validateStory(story: Story): StoryIssue[] {
  const issues: StoryIssue[] = [];
  if (!story?.id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(story.id)) {
    issues.push({ level: "error", message: "id must be kebab-case (nightshift, campfire-ch2)" });
  }
  if (!story.title && !story.config?.title) issues.push({ level: "error", message: "title is required" });
  const chars = story.characters || [];
  if (!chars.some((c) => c.id === "narrator")) {
    issues.push({ level: "error", message: "characters must include narrator" });
  }
  const ids = chars.map((c) => c.id);
  const dupChar = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupChar.length) issues.push({ level: "error", message: `duplicate character id ${dupChar[0]}` });

  const cast = story.config?.characters || [];
  if ((story.config?.characterCount ?? 0) !== cast.length) {
    issues.push({
      level: "error",
      message: `characterCount is ${story.config?.characterCount ?? 0} but config.characters has ${cast.length}`,
    });
  }
  const idSet = new Set(ids);
  for (const c of cast) {
    if (!idSet.has(c.id)) issues.push({ level: "error", message: `config character ${c.id} missing from characters` });
  }
  if (!story.beats?.length) issues.push({ level: "error", message: "story needs at least one beat" });
  const beatIds = (story.beats || []).map((b) => b.id);
  const dupBeat = beatIds.filter((id, i) => id && beatIds.indexOf(id) !== i);
  if (dupBeat.length) issues.push({ level: "error", message: `duplicate beat id ${dupBeat[0]}` });

  const tokenRe = /\{\{(\w+)\}\}/g;
  for (const beat of story.beats || []) {
    if (!beat.text) issues.push({ level: "error", message: `beat ${beat.id} is empty` });
    if (beat.text.length > 500) {
      issues.push({ level: "warn", message: `beat ${beat.id} is ${beat.text.length} chars; split it for clearer speech` });
    }
    if (!idSet.has(beat.speaker)) {
      issues.push({ level: "error", message: `beat ${beat.id} speaker "${beat.speaker}" is not a character` });
    }
    let m: RegExpExecArray | null;
    tokenRe.lastIndex = 0;
    while ((m = tokenRe.exec(beat.text))) {
      if (!idSet.has(m[1])) issues.push({ level: "error", message: `beat ${beat.id} uses unknown {{${m[1]}}}` });
    }
  }
  if ((story.config?.age === "18+") !== (story.rating === "explicit")) {
    issues.push({ level: "warn", message: "age 18+ and rating explicit should match" });
  }
  if (story.title !== story.config.title) {
    issues.push({ level: "error", message: "title and config.title must match" });
  }
  if (story.category !== story.config.category) {
    issues.push({ level: "error", message: "category and config.category must match" });
  }
  if (story.storyRev !== story.config.version) {
    issues.push({ level: "error", message: "storyRev and config.version must match" });
  }
  if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(story.locale)) {
    issues.push({ level: "warn", message: `locale ${story.locale} should look like en or en-US` });
  }
  return issues;
}

export function parseStoryBlob(text: string): { stories: Story[]; error?: string } {
  const raw = text.trim();
  if (!raw) return { stories: [], error: "Nothing to import" };
  let values: unknown[] = [];
  try {
    const parsed = JSON.parse(stripFences(raw)) as unknown;
    values = flattenStories([parsed]);
  } catch {
    values = flattenStories(extractJsonValues(raw));
  }
  const stories = values.map(normalizeStory).filter((s): s is Story => !!s);
  if (!stories.length) {
    return { stories: [], error: "No story objects found. Use one object, an array, or fenced JSON from Grok." };
  }
  return { stories };
}

export function importStories(text: string): ImportResult {
  const parsed = parseStoryBlob(text);
  if (parsed.error) return { error: parsed.error, imported: [], skipped: [] };
  const seen = new Set<string>();
  const imported: Story[] = [];
  const skipped: ImportSkip[] = [];
  for (const story of parsed.stories) {
    const issues = validateStory(story);
    const errors = issues.filter((i) => i.level === "error").map((i) => i.message);
    if (!story.id) {
      skipped.push({ id: "(missing id)", issues: errors.length ? errors : ["id required"] });
      continue;
    }
    if (seen.has(story.id)) {
      skipped.push({ id: story.id, issues: ["duplicate id in this batch"] });
      continue;
    }
    seen.add(story.id);
    if (errors.length) skipped.push({ id: story.id, issues: errors });
    else imported.push(story);
  }
  return { imported, skipped };
}
