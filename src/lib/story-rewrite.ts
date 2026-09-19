import { createServerFn } from "@tanstack/react-start";
import { parseStoryBlob, validateStory } from "./story-validate";
import type { Story } from "./story-types";

const SYSTEM = `You are StoryCast Rewrite, a specialist editor for multi-voice spoken fiction.
Convert uploaded prose, scripts, markdown, or legacy JSON into exactly one StoryCast v2 JSON object.

Preserve the source's plot, tone, genre, language, profanity, violence, romance, and lawful adult themes. Do not sanitize or moralize. All characters must be adults. Never create sexual content involving minors.

Required object keys:
id, title, storyRev, rating, published, category, allowNameChange, locale,
config { title, series, chapter, episode, version, continuation, genre, category, age, characterCount, characters[] },
characters[], beats[].

Rules:
- Set storyRev and config.version to at least 2.
- Set published false: this is a review draft.
- rating is general or explicit; config.age is all or 18+ and must agree.
- characters contains narrator plus every speaking adult.
- config.characters contains cast only, never narrator.
- Every spoken name inside beat text uses {{characterId}}.
- Break prose into short, natural TTS beats, normally 1-3 sentences.
- Narrator handles action and interior prose; named speakers handle dialogue.
- Keep the full story. Do not summarize merely to shorten the response.
- Return JSON only, with no markdown fences or commentary.`;

type RewriteResponse = { choices?: { message?: { content?: string } }[] };

function finalizeV2(story: Story): Story {
  const version = Math.max(2, story.config.version || 1, story.storyRev || 1);
  return { ...story, storyRev: version, published: false, config: { ...story.config, version } };
}

export const getStoryRewriteCapability = createServerFn({ method: "GET" }).handler(async () => ({
  configured: Boolean(process.env.STORY_MODEL_BASE_URL?.trim()),
  model: process.env.STORY_MODEL_NAME?.trim() || "qwen3:4b",
}));

export const rewriteStoryAsV2 = createServerFn({ method: "POST" })
  .validator((input: { content: string; instruction?: string }) => input)
  .handler(async ({ data }) => {
    const { requireUserId } = await import("./auth/verify.server");
    await requireUserId();
    const baseUrl = process.env.STORY_MODEL_BASE_URL?.trim()?.replace(/\/+$/, "");
    if (!baseUrl) return { ok: false as const, error: "Local story model is not configured" };
    const content = String(data.content || "").trim();
    if (!content) return { ok: false as const, error: "Upload or paste a story first" };
    if (content.length > 120_000) return { ok: false as const, error: "Story exceeds the 120,000 character rewrite limit" };
    const model = process.env.STORY_MODEL_NAME?.trim() || "qwen3:4b";
    const apiKey = process.env.STORY_MODEL_API_KEY?.trim();
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 16_000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `${data.instruction?.trim() ? `Editor request: ${data.instruction.trim()}\n\n` : ""}SOURCE:\n${content}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false as const, error: `Story model error ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ""}` };
    }
    const body = (await response.json()) as RewriteResponse;
    const output = body.choices?.[0]?.message?.content || "";
    const parsed = parseStoryBlob(output);
    if (parsed.error || !parsed.stories[0]) {
      return { ok: false as const, error: parsed.error || "Model did not return a StoryCast object" };
    }
    const story = finalizeV2(parsed.stories[0]);
    const errors = validateStory(story).filter((issue) => issue.level === "error");
    if (errors.length) return { ok: false as const, error: errors.map((issue) => issue.message).join("; ") };
    return { ok: true as const, story, model };
  });
