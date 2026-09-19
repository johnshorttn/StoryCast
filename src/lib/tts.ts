import { createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { CAST_VOICES, resolveVoiceId, voiceById, type VoiceProvider } from "./tts-catalog";

const cache = new Map<string, { mime: string; b64: string }>();
const MAX_CHARS = 1200;
const WINDOW_MS = 5 * 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;
const requests = new Map<string, { startedAt: number; count: number }>();

async function rateLimitKey() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  return request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

async function allowedRequest() {
  const key = await rateLimitKey();
  const now = Date.now();
  const current = requests.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    requests.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= MAX_REQUESTS_PER_WINDOW;
}

export const synthTts = createServerFn({ method: "POST" })
  .validator((input: { text: string; voiceId: string }) => input)
  .handler(async ({ data }) => {
    if (!(await allowedRequest())) return { ok: false as const, error: "Voice limit reached. Try again in a few minutes." };
    const text = String(data.text || "").trim().slice(0, MAX_CHARS);
    if (!text) return { ok: false as const, error: "Nothing to speak" };
    const voiceId = resolveVoiceId(String(data.voiceId || ""));
    const selected = voiceById(voiceId);
    if (!selected) {
      const allowed = CAST_VOICES.map((v) => v.id).join(", ");
      return { ok: false as const, error: `Unknown voice. Use one of: ${allowed}` };
    }
    const key = createHash("sha256").update(`${voiceId}|${text}`).digest("hex").slice(0, 24);
    const hit = cache.get(key);
    if (hit) return { ok: true as const, mime: hit.mime, b64: hit.b64, cached: true, voiceId };

    const providerUrls: Partial<Record<VoiceProvider, string>> = {
      kokoro: process.env.KOKORO_TTS_URL?.trim(),
      sherpa: process.env.SHERPA_TTS_URL?.trim(),
    };
    const apiKey = process.env.XAI_API_KEY;
    const url = selected.provider === "xai" ? "https://api.x.ai/v1/tts" : providerUrls[selected.provider];
    if (!url || (selected.provider === "xai" && !apiKey)) {
      return { ok: false as const, error: `${selected.provider} voice service is not configured` };
    }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...(selected.provider === "xai" ? { Authorization: `Bearer ${apiKey}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        selected.provider === "xai"
          ? { text, voice_id: selected.providerVoiceId, language: "en" }
          : { text, voice_id: selected.providerVoiceId, language: "en", format: "wav" },
      ),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { ok: false as const, error: `Voice error ${res.status}${errText ? `: ${errText.slice(0, 120)}` : ""}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "audio/mpeg";
    const b64 = buf.toString("base64");
    if (cache.size > 200) cache.clear();
    cache.set(key, { mime, b64 });
    return { ok: true as const, mime, b64, cached: false, voiceId };
  });

export const getTtsCapabilities = createServerFn({ method: "GET" }).handler(async () => ({
  xai: Boolean(process.env.XAI_API_KEY?.trim()),
  kokoro: Boolean(process.env.KOKORO_TTS_URL?.trim()),
  sherpa: Boolean(process.env.SHERPA_TTS_URL?.trim()),
}));
