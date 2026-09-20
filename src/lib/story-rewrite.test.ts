import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rewriteStoryContent } from "./story-rewrite.ts";
import { readStoryUpload } from "./story-upload.ts";

const modelStory = {
  id: "last-light-bellweather",
  title: "The Last Light in Bellweather",
  storyRev: 2,
  rating: "general",
  published: true,
  category: "mystery",
  allowNameChange: true,
  locale: "en-US",
  config: {
    title: "The Last Light in Bellweather",
    series: "Bellweather",
    chapter: 1,
    episode: 1,
    version: 2,
    continuation: false,
    genre: "literary mystery",
    category: "mystery",
    age: "all",
    characterCount: 2,
    characters: [
      { id: "mara", name: "Mara Vale", gender: "female" },
      { id: "elias", name: "Elias Reed", gender: "male" },
    ],
  },
  characters: [
    { id: "mara", defaultName: "Mara Vale", defaultVoice: "female-warm" },
    { id: "elias", defaultName: "Elias Reed", defaultVoice: "male-low" },
    { id: "narrator", defaultName: "Narrator", defaultVoice: "narrator" },
  ],
  beats: [
    { id: "b1", speaker: "narrator", text: "Rain polished Bellweather's empty streets until every lamp had a twin beneath it." },
    { id: "b2", speaker: "narrator", text: "{{mara}} turned the bookshop sign to CLOSED." },
    { id: "b3", speaker: "narrator", text: "A knock revealed {{elias}} beneath a black umbrella, holding a wooden box." },
    { id: "b4", speaker: "mara", text: "You have five minutes before I become unreasonable." },
    { id: "b5", speaker: "elias", text: "You were unreasonable when we were twenty. I assumed it was permanent." },
    { id: "b6", speaker: "narrator", text: "Inside the box lay a brass key and a page in her father's handwriting." },
    { id: "b7", speaker: "elias", text: "He made me promise not to bring it back until the town clock stopped." },
    { id: "b8", speaker: "narrator", text: "The tower struck ten once, then fell silent." },
    { id: "b9", speaker: "mara", text: "That is an unpleasantly theatrical coincidence." },
    { id: "b10", speaker: "narrator", text: "The note directed them beneath the western stair and told her to bring someone she once trusted." },
    { id: "b11", speaker: "mara", text: "The tower will be locked." },
    { id: "b12", speaker: "elias", text: "Good thing we have a key." },
    { id: "b13", speaker: "narrator", text: "{{mara}} stepped into the rain beside {{elias}}, and the dark tower waited." },
  ],
};

describe("story upload rewrite", () => {
  it("reads a prose upload and accepts a valid model-produced v2 draft", async () => {
    const upload = await readStoryUpload([{ name: "chapter.txt", text: async () => "Ordinary book prose with Mara and Elias." }]);
    assert.equal(upload.ok, true);
    if (!upload.ok) return;
    let requestBody = "";
    const result = await rewriteStoryContent(
      { content: upload.content, instruction: "Preserve the literary tone." },
      {
        baseUrl: "http://story-model.test/v1",
        model: "qwen3:4b",
        fetcher: async (_url, init) => {
          requestBody = String(init?.body || "");
          return Response.json({ choices: [{ message: { content: JSON.stringify(modelStory) } }] });
        },
      },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(requestBody, /Ordinary book prose/);
    assert.match(requestBody, /Preserve the literary tone/);
    assert.equal(result.story.storyRev, 2);
    assert.equal(result.story.config.version, 2);
    assert.equal(result.story.published, false);
    assert.deepEqual(result.story.characters.map((character) => character.id), ["mara", "elias", "narrator"]);
    assert.equal(result.story.beats.length, 13);
  });

  it("rejects unsupported upload types", async () => {
    const upload = await readStoryUpload([{ name: "chapter.pdf", text: async () => "ignored" }]);
    assert.deepEqual(upload, { ok: false, error: "chapter.pdf must be JSON, text, or Markdown" });
  });

  it("adds original anime adaptation guidance when requested", async () => {
    let requestBody = "";
    const animeStory = {
      ...modelStory,
      category: "anime",
      config: { ...modelStory.config, category: "anime", presentation: "anime", anime: { demographic: "seinen", visualStyle: "modern", episodeStructure: true } },
    };
    const result = await rewriteStoryContent(
      { content: "A courier discovers a sleeping sky-city.", presentation: "anime" },
      {
        baseUrl: "http://story-model.test/v1",
        fetcher: async (_url, init) => {
          requestBody = String(init?.body || "");
          return Response.json({ choices: [{ message: { content: JSON.stringify(animeStory) } }] });
        },
      },
    );
    assert.equal(result.ok, true);
    assert.match(requestBody, /anime-inspired episodic fiction/);
    assert.match(requestBody, /Do not copy protected franchises/);
    if (result.ok) assert.equal(result.story.config.presentation, "anime");
  });
});
