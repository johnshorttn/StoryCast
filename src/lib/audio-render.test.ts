import assert from "node:assert/strict";
import test from "node:test";
import { beatRenderHashes, safeAudioSegment, type BeatRenderInput } from "./audio-render.ts";

const base: BeatRenderInput = {
  storyId: "story-one",
  storyRevision: 2,
  chapterId: "chapter-1",
  beatId: "beat-1",
  characterId: "narrator",
  voiceId: "kokoro:af_heart",
  text: "Once upon a time.",
  modelVersion: "kokoro-82m",
  settings: { speed: 1, pitch: 0 },
  pronunciationVersion: "names-v1",
};

test("beat render hashes are deterministic for equivalent settings", () => {
  const first = beatRenderHashes(base);
  const second = beatRenderHashes({ ...base, settings: { pitch: 0, speed: 1 } });
  assert.deepEqual(first, second);
});

test("voice, text, and settings changes invalidate the render", () => {
  const original = beatRenderHashes(base);
  const voice = beatRenderHashes({ ...base, voiceId: "kokoro:af_sky" });
  const text = beatRenderHashes({ ...base, text: "A different line." });
  const settings = beatRenderHashes({ ...base, settings: { speed: 0.9, pitch: 0 } });
  assert.notEqual(original.renderHash, voice.renderHash);
  assert.notEqual(original.renderHash, text.renderHash);
  assert.notEqual(original.renderHash, settings.renderHash);
  assert.equal(original.textHash, voice.textHash);
  assert.notEqual(original.textHash, text.textHash);
});

test("audio path segments cannot escape the configured root", () => {
  assert.equal(safeAudioSegment("../../My story / chapter"), "My-story-chapter");
  assert.equal(safeAudioSegment(".."), "unknown");
  assert.equal(safeAudioSegment(""), "unknown");
});
