import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STARTER_STORY } from "./story-types.ts";
import { normalizeStory, validateStory } from "./story-validate.ts";
import { storyV2ToV3, storyV3ToV2, validateStoryV3 } from "./story-v3.ts";

describe("StoryCast v3", () => {
  it("migrates a v2 chapter without losing cast, beats, or playback compatibility", () => {
    const legacy = structuredClone(STARTER_STORY);
    legacy.id = "migration-example";
    legacy.title = "Migration Example";
    legacy.config.title = "Migration Example";
    legacy.config.series = "Migration Example Series";
    const v3 = storyV2ToV3(legacy);
    assert.equal(v3.schemaVersion, 3);
    assert.equal(v3.chapters.length, 1);
    assert.equal(v3.chapters[0].beats.length, legacy.beats.length);
    assert.equal(v3.cast.length, legacy.characters.length);
    assert.equal(v3.voiceAssignments.length, legacy.characters.length);
    assert.deepEqual(validateStoryV3(v3), []);

    const projected = storyV3ToV2(v3);
    assert.equal(projected.config.series, "Migration Example Series");
    assert.deepEqual(projected.beats.map((beat) => beat.text), legacy.beats.map((beat) => beat.text));
    assert.deepEqual(validateStory(projected).filter((issue) => issue.level === "error"), []);
  });

  it("normalizes a v3 database payload into the current player view", () => {
    const v3 = storyV2ToV3(structuredClone(STARTER_STORY));
    v3.edition.sources.push({
      sourceName: "Project Gutenberg",
      sourceUrl: "https://www.gutenberg.org/ebooks/11",
      externalId: "11",
      matchMethod: "catalog-id",
      matchConfidence: 1,
    });
    const story = normalizeStory(v3);
    assert.ok(story);
    assert.equal(story?.storyRev, 3);
    assert.equal(story?.beats.length, STARTER_STORY.beats.length);
    assert.deepEqual(validateStoryV3(v3), []);
  });

  it("rejects unsafe or malformed metadata source links", () => {
    const v3 = storyV2ToV3(structuredClone(STARTER_STORY));
    v3.edition.sources.push({ sourceName: "Bad source", sourceUrl: "http://example.test/book" });
    assert.ok(validateStoryV3(v3).includes("source Bad source must use HTTPS"));
  });
});
