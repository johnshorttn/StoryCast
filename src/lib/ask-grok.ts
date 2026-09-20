import { createServerFn } from "@tanstack/react-start";

const SYSTEM = `You help write multi-voice audio scripts for Storycast.
Return either a short reply OR a single JSON object with keys:
id, title, storyRev, rating ("general"), published, category, allowNameChange, locale,
config (title, series, chapter, episode, version, continuation, genre, category, age "all", characterCount, characters[{id,name,gender,pronounceAs}]),
characters[{id,defaultName,pronounceAs,defaultVoice}],
beats[{id,speaker,text}].
Use {{characterId}} in beat text. defaultVoice is male-low, female-warm, or narrator.
Keep content suitable for a general audience. No sexual content. Adults as characters is fine.
JSON only when drafting a full story.`;

export const askGrok = createServerFn({ method: "POST" })
  .validator((input: { prompt: string }) => input)
  .handler(async ({ data }) => {
    const { requireUserId } = await import("./auth/verify.server");
    await requireUserId();
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "AI is not available in this environment" };
    const prompt = String(data.prompt || "").slice(0, 4000);
    if (!prompt.trim()) return { ok: false as const, error: "Write a prompt first" };

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 1800,
        temperature: 0.7,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: `xAI API error ${res.status}` };
    const body = (await res.json()) as { choices: { message: { content: string } }[] };
    return { ok: true as const, text: body.choices[0]?.message.content ?? "" };
  });
