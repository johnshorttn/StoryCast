import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAST_VOICES, resolveVoiceId, voiceMatchScore } from "./tts-catalog.ts";

describe("voice catalog", () => {
  it("keeps legacy story voices compatible", () => {
    assert.equal(resolveVoiceId("male-low"), "xai:leo");
    assert.equal(resolveVoiceId("eve"), "xai:eve");
  });

  it("ranks gender, accent, and tone matches first", () => {
    const wanted = { gender: "female" as const, accent: "british" as const, tone: "warm" as const };
    const ranked = [...CAST_VOICES].sort((a, b) => voiceMatchScore(b, wanted) - voiceMatchScore(a, wanted));
    assert.equal(ranked[0].gender, "female");
    assert.equal(ranked[0].accent, "british");
    assert.equal(ranked[0].tone, "warm");
    assert.ok(ranked.some((voice) => voice.provider === "kokoro"));
    assert.ok(ranked.some((voice) => voice.provider === "sherpa"));
    assert.ok(ranked.some((voice) => voice.provider === "xai"));
  });
});
