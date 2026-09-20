import { createHash, randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { beatRenderHashes, type BeatRenderInput } from "./audio-render";
import { CAST_VOICES, resolveVoiceId, voiceById, type VoiceProvider } from "./tts-catalog";

type AudioClip = { mime: string; b64: string; url?: string; renderHash?: string };
type SynthInput = {
  text: string;
  voiceId: string;
  render?: Omit<BeatRenderInput, "text" | "voiceId" | "modelVersion">;
};

const cache = new Map<string, AudioClip>();
const MAX_CHARS = 1200;
const WINDOW_MS = 5 * 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;
const requests = new Map<string, { startedAt: number; count: number }>();

async function findPersistedRender(renderHash: string): Promise<AudioClip | null> {
  if (!process.env.STORY_AUDIO_ROOT?.trim() || !process.env.STORY_AUDIO_PUBLIC_URL?.trim()) return null;
  try {
    const [{ getSql }, { readStoredAudio }] = await Promise.all([
      import("./db"),
      import("./audio-storage.server"),
    ]);
    const sql = await getSql();
    const rows = await sql<{
      master_path: string;
      playback_path: string;
      mime_type: string;
    }>`select master_path, playback_path, mime_type
       from story_beat_renders
       where render_hash = ${renderHash} and status = 'ready'
       order by updated_at desc limit 1`;
    const row = rows[0];
    if (!row?.master_path || !row.playback_path) return null;
    const bytes = await readStoredAudio(row.master_path);
    if (!bytes) return null;
    return {
      mime: row.mime_type || "audio/mpeg",
      b64: bytes.toString("base64"),
      url: row.playback_path,
      renderHash,
    };
  } catch (error) {
    console.warn("[tts] Could not read the durable render cache", error);
    return null;
  }
}

async function rateLimitKey() {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  return request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

async function allowedRequest() {
  try {
    const { getSessionUser } = await import("./auth/verify.server");
    const user = await getSessionUser();
    if (user) {
      const { ensurePlatformRole } = await import("./platform-roles.server");
      const { roleCan } = await import("./platform-roles");
      const role = await ensurePlatformRole(user);
      if (roleCan(role, "bypass_account_limits")) return true;
    }
  } catch {
    /* fall through to the shared IP window */
  }
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

async function persistRender(
  input: BeatRenderInput,
  provider: VoiceProvider,
  mime: string,
  bytes: Buffer,
): Promise<{ url: string; renderHash: string } | null> {
  const hashes = beatRenderHashes(input);
  const { storeBeatAudio } = await import("./audio-storage.server");
  const stored = await storeBeatAudio({ ...input, renderHash: hashes.renderHash, mime, bytes });
  if (!stored) return null;
  try {
    const { getSql } = await import("./db");
    const sql = await getSql();
    await sql.query(
      `insert into story_beat_renders
       (id, story_id, story_revision, chapter_id, beat_id, character_id, provider,
        model_version, spoken_text, text_hash, settings_hash, pronunciation_hash,
        render_hash, master_path, playback_path, mime_type, status)
       select $1, s.id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'ready'
       from stories s where s.id = $16
       on conflict (story_id, chapter_id, beat_id, render_hash) do update set
         master_path = excluded.master_path, playback_path = excluded.playback_path,
         mime_type = excluded.mime_type, status = 'ready', error = null, updated_at = now()`,
      [
        randomUUID(), input.storyRevision, input.chapterId, input.beatId, input.characterId,
        provider, input.modelVersion ?? "default", input.text, hashes.textHash, hashes.settingsHash,
        hashes.pronunciationHash, hashes.renderHash, stored.path, stored.url, mime, input.storyId,
      ],
    );
  } catch (error) {
    console.warn("[tts] Audio file stored, but render metadata could not be recorded", error);
  }
  return { url: stored.url, renderHash: hashes.renderHash };
}

export const synthTts = createServerFn({ method: "POST" })
  .validator((input: SynthInput) => input)
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
    const modelVersion = selected.provider === "kokoro" ? "kokoro-82m" : selected.providerVoiceId;
    const renderInput = data.render
      ? { ...data.render, text, voiceId, modelVersion }
      : null;
    const key = renderInput
      ? beatRenderHashes(renderInput).renderHash
      : createHash("sha256").update(`${voiceId}|${text}`).digest("hex");
    const hit = cache.get(key);
    if (hit) {
      return {
        ok: true as const,
        mime: hit.mime,
        b64: hit.b64,
        url: hit.url,
        renderHash: hit.renderHash,
        cached: true,
        voiceId,
      };
    }
    if (renderInput) {
      const durableHit = await findPersistedRender(key);
      if (durableHit) {
        cache.set(key, durableHit);
        return { ok: true as const, ...durableHit, cached: true, voiceId };
      }
    }

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
    const persisted = renderInput
      ? await persistRender(renderInput, selected.provider, mime, buf).catch((error) => {
          console.warn("[tts] Could not persist rendered audio", error);
          return null;
        })
      : null;
    const clip: AudioClip = { mime, b64, ...(persisted ?? {}) };
    if (cache.size > 200) cache.clear();
    cache.set(key, clip);
    return { ok: true as const, ...clip, cached: false, voiceId };
  });

export const getTtsCapabilities = createServerFn({ method: "GET" }).handler(async () => ({
  xai: Boolean(process.env.XAI_API_KEY?.trim()),
  kokoro: Boolean(process.env.KOKORO_TTS_URL?.trim()),
  sherpa: Boolean(process.env.SHERPA_TTS_URL?.trim()),
  durableAudio: Boolean(process.env.STORY_AUDIO_ROOT?.trim() && process.env.STORY_AUDIO_PUBLIC_URL?.trim()),
}));
