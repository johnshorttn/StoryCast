import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STARTER_STORY } from "./story-types.ts";
import { normalizeStory, validateStory } from "./story-validate.ts";

describe("story validation", () => {
  it("accepts the starter story", () => {
    assert.deepEqual(validateStory(structuredClone(STARTER_STORY)).filter((issue) => issue.level === "error"), []);
  });

  it("rejects duplicated metadata that has drifted", () => {
    const story = structuredClone(STARTER_STORY);
    story.config.title = "Different";
    story.config.category = "other";
    story.config.version = 2;
    const messages = validateStory(story).map((issue) => issue.message);
    assert.ok(messages.includes("title and config.title must match"));
    assert.ok(messages.includes("category and config.category must match"));
    assert.ok(messages.includes("storyRev and config.version must match"));
  });

  it("normalizes imported metadata into one consistent story", () => {
    const story = normalizeStory({
      id: "A-New-Story",
      title: "New",
      category: "fiction",
      characters: [{ id: "hero", defaultName: "Hero", defaultVoice: "male-low" }],
      beats: [{ speaker: "hero", text: "Hello." }],
    });
    assert.ok(story);
    assert.equal(story.id, "a-new-story");
    assert.equal(story.config.title, story.title);
    assert.ok(story.characters.some((character) => character.id === "narrator"));
  });
});
