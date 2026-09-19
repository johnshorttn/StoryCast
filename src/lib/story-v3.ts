import type { Gender, Story } from "./story-types.ts";

export type StorySourceRecord = {
  sourceName: string;
  sourceUrl: string;
  externalId?: string;
  matchMethod?: "isbn" | "catalog-id" | "title-author" | "manual";
  matchConfidence?: number;
  retrievedAt?: string;
};

export type StoryV3Beat = {
  id: string;
  order: number;
  type: "narration" | "dialogue" | "song" | "stage-direction";
  speakerId: string;
  text: string;
  direction?: { tone?: string; pace?: string; pauseBeforeMs?: number; pauseAfterMs?: number };
};

export type StoryV3 = {
  schemaVersion: 3;
  id: string;
  revision: number;
  published: boolean;
  visibility?: "private" | "unlisted" | "public";
  locale: string;
  rating: "general" | "explicit";
  category: string;
  allowNameChange: boolean;
  work: {
    id: string;
    title: string;
    subtitle?: string;
    series?: string;
    authors: { id: string; name: string; url?: string }[];
    genre: string;
    category: string;
    presentation?: "book" | "anime";
    anime?: Story["config"]["anime"];
  };
  edition: {
    id: string;
    workId: string;
    title: string;
    publisher?: string;
    publicationDate?: string;
    isbn10?: string;
    isbn13?: string;
    cover?: { asset?: string; sourceUrl?: string; credit?: string; licenseUrl?: string };
    sources: StorySourceRecord[];
    rights: {
      status: "unknown" | "user-owned" | "licensed" | "public-domain" | "public-domain-us";
      license?: string;
      licenseUrl?: string;
      distributionConfirmed: boolean;
    };
  };
  chapters: {
    id: string;
    number: number;
    order: number;
    title: string;
    episode?: number;
    continuation: boolean;
    beats: StoryV3Beat[];
  }[];
  cast: {
    id: string;
    name: string;
    pronounceAs?: string;
    role: "narrator" | "protagonist" | "supporting" | "unknown";
    profile: { gender: Gender; agePresentation?: string; accent?: string; tones?: string[] };
  }[];
  voiceAssignments: {
    id: string;
    characterId: string;
    provider: "device" | "sherpa" | "kokoro" | "xai" | "legacy";
    voiceId: string;
    recommended: boolean;
    settings: { speed: number; pitch: number; emotion?: string };
    revision: number;
  }[];
};

export function isStoryV3(value: unknown): value is StoryV3 {
  return !!value && typeof value === "object" && (value as { schemaVersion?: unknown }).schemaVersion === 3;
}

export function validateStoryV3(story: StoryV3) {
  const errors: string[] = [];
  if (story.schemaVersion !== 3) errors.push("schemaVersion must be 3");
  if (!story.id) errors.push("id is required");
  if (!story.work?.title) errors.push("work title is required");
  if (!story.edition?.workId || story.edition.workId !== story.work.id) errors.push("edition must reference work");
  if (!story.chapters?.length) errors.push("at least one chapter is required");
  const castIds = new Set(story.cast?.map((character) => character.id));
  if (!story.cast?.some((character) => character.id === "narrator" || character.role === "narrator")) {
    errors.push("cast must contain a narrator");
  }
  for (const chapter of story.chapters || []) {
    if (!chapter.beats.length) errors.push(`chapter ${chapter.id} needs at least one beat`);
    for (const beat of chapter.beats) {
      if (!castIds.has(beat.speakerId)) errors.push(`beat ${beat.id} references unknown speaker ${beat.speakerId}`);
      if (!beat.text.trim()) errors.push(`beat ${beat.id} is empty`);
    }
  }
  for (const assignment of story.voiceAssignments || []) {
    if (!castIds.has(assignment.characterId)) {
      errors.push(`voice assignment ${assignment.id} references unknown character ${assignment.characterId}`);
    }
  }
  for (const source of story.edition?.sources || []) {
    try {
      const url = new URL(source.sourceUrl);
      if (url.protocol !== "https:") errors.push(`source ${source.sourceName} must use HTTPS`);
    } catch {
      errors.push(`source ${source.sourceName} has an invalid URL`);
    }
  }
  return errors;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "story";
}

function legacyGender(story: Story, characterId: string): Gender {
  if (characterId === "narrator") return "neutral";
  return story.config.characters.find((character) => character.id === characterId)?.gender || "neutral";
}

export function storyV2ToV3(story: Story): StoryV3 {
  const workId = slug(story.config.series || story.title);
  const chapterId = `${story.id}-chapter-${story.config.chapter || 1}`;
  return {
    schemaVersion: 3,
    id: story.id,
    revision: Math.max(3, story.storyRev || 1),
    published: story.published !== false,
    visibility: story.visibility ?? (story.published !== false ? "public" : "private"),
    locale: story.locale,
    rating: story.rating,
    category: story.category,
    allowNameChange: story.allowNameChange,
    work: {
      id: workId,
      title: story.config.series || story.title,
      series: story.config.series || story.title,
      authors: [],
      genre: story.config.genre,
      category: story.config.category,
      presentation: story.config.presentation ?? "book",
      anime: story.config.anime,
    },
    edition: {
      id: `${workId}-edition-default`,
      workId,
      title: story.title,
      cover: story.config.cover ? { asset: story.config.cover } : undefined,
      sources: [],
      rights: { status: "unknown", distributionConfirmed: false },
    },
    chapters: [{
      id: chapterId,
      number: story.config.chapter || 1,
      order: story.config.chapter || 1,
      title: story.title,
      episode: story.config.episode,
      continuation: story.config.continuation,
      beats: story.beats.map((beat, index) => ({
        id: beat.id,
        order: index + 1,
        type: beat.speaker === "narrator" ? "narration" : "dialogue",
        speakerId: beat.speaker,
        text: beat.text,
      })),
    }],
    cast: story.characters.map((character) => ({
      id: character.id,
      name: character.defaultName,
      pronounceAs: character.pronounceAs,
      role: character.id === "narrator" ? "narrator" : "unknown",
      profile: { gender: legacyGender(story, character.id) },
    })),
    voiceAssignments: story.characters.map((character) => ({
      id: `${story.id}-${character.id}-voice`,
      characterId: character.id,
      provider: "legacy",
      voiceId: character.defaultVoice,
      recommended: true,
      settings: { speed: 1, pitch: 0 },
      revision: 1,
    })),
  };
}

export function storyV3ToV2(story: StoryV3): Story {
  const chapter = [...story.chapters].sort((a, b) => a.order - b.order)[0];
  const cast = story.cast.filter((character) => character.role !== "narrator" && character.id !== "narrator");
  const narrator = story.cast.find((character) => character.role === "narrator" || character.id === "narrator");
  const version = Math.max(3, story.revision || 3);
  return {
    id: story.id,
    title: chapter?.title || story.edition.title || story.work.title,
    storyRev: version,
    rating: story.rating,
    published: story.published,
    visibility: story.visibility ?? (story.published ? "public" : "private"),
    category: story.category,
    allowNameChange: story.allowNameChange,
    locale: story.locale,
    config: {
      title: chapter?.title || story.edition.title || story.work.title,
      series: story.work.series || story.work.title,
      chapter: chapter?.number || 1,
      episode: chapter?.episode || chapter?.number || 1,
      version,
      continuation: chapter?.continuation || false,
      genre: story.work.genre,
      category: story.work.category,
      presentation: story.work.presentation ?? "book",
      anime: story.work.anime,
      age: story.rating === "explicit" ? "18+" : "all",
      cover: story.edition.cover?.asset,
      characterCount: cast.length,
      characters: cast.map((character) => ({
        id: character.id,
        name: character.name,
        gender: character.profile.gender,
        pronounceAs: character.pronounceAs,
      })),
    },
    characters: [...cast, ...(narrator ? [narrator] : [])].map((character) => {
      const assignment = story.voiceAssignments.find((voice) => voice.characterId === character.id);
      const fallback = character.id === "narrator" ? "narrator" : character.profile.gender === "male" ? "male-low" : "female-warm";
      const defaultVoice = assignment?.provider === "legacy" ? assignment.voiceId : fallback;
      return {
        id: character.id,
        defaultName: character.name,
        pronounceAs: character.pronounceAs,
        defaultVoice: (defaultVoice === "narrator" || defaultVoice === "male-low" ? defaultVoice : "female-warm"),
      };
    }),
    beats: (chapter?.beats || []).sort((a, b) => a.order - b.order).map((beat) => ({
      id: beat.id,
      speaker: beat.speakerId,
      text: beat.text,
    })),
  };
}
