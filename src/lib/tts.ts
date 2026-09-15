import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { CAST_VOICES, resolveVoiceId } from "./tts-catalog";

const cache = new Map<string, { mime: string; b64: string }>();
const MAX_CHARS = 2000;

export const synthTts = createServerFn({ method: "POST" })
  .validator((input: { text: string; voiceId: string }) => input)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Voice service is not available" };
    const text = String(data.text || "").trim().slice(0, MAX_CHARS);
    if (!text) return { ok: false as const, error: "Nothing to speak" };
    const voiceId = resolveVoiceId(String(data.voiceId || ""));
    if (!voiceId) {
      const allowed = CAST_VOICES.map((v) => v.id).join(", ");
      return { ok: false as const, error: `Unknown voice. Use one of: ${allowed}` };
    }
    const key = createHash("sha256").update(`${voiceId}|${text}`).digest("hex").slice(0, 24);
    const hit = cache.get(key);
    if (hit) return { ok: true as const, mime: hit.mime, b64: hit.b64, cached: true, voiceId };

    const res = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, voice_id: voiceId, language: "en" }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false as const, error: `Voice error ${res.status}${errText ? `: ${errText.slice(0, 120)}` : ""}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "audio/mpeg";
    const b64 = buf.toString("base64");
    if (cache.size > 80) cache.clear();
    cache.set(key, { mime, b64 });
    return { ok: true as const, mime, b64, cached: false, voiceId };
  });
