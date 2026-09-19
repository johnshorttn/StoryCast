import { createHash } from "node:crypto";

export type BeatRenderInput = {
  storyId: string;
  storyRevision: number;
  chapterId: string;
  beatId: string;
  characterId: string;
  voiceId: string;
  text: string;
  modelVersion?: string;
  settings?: Record<string, unknown>;
  pronunciationVersion?: string;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

export function beatRenderHashes(input: BeatRenderInput) {
  const textHash = hash(input.text.trim());
  const settingsHash = hash(input.settings ?? {});
  const pronunciationHash = hash(input.pronunciationVersion ?? "");
  const renderHash = hash({
    storyId: input.storyId,
    storyRevision: input.storyRevision,
    chapterId: input.chapterId,
    beatId: input.beatId,
    characterId: input.characterId,
    voiceId: input.voiceId,
    modelVersion: input.modelVersion ?? "default",
    textHash,
    settingsHash,
    pronunciationHash,
  });
  return { textHash, settingsHash, pronunciationHash, renderHash };
}

export function safeAudioSegment(value: string) {
  const safe = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return safe.slice(0, 100) || "unknown";
}
