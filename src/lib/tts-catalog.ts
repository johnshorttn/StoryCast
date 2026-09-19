import type { Gender } from "./story-types";

export type VoiceProvider = "xai" | "kokoro" | "sherpa";
export type VoiceAccent = "american" | "british" | "neutral";
export type VoiceTone = "warm" | "bright" | "deep" | "clear" | "soft" | "dramatic" | "neutral";
export type CastVoice = {
  id: string;
  provider: VoiceProvider;
  providerVoiceId: string;
  label: string;
  gender: Gender;
  accent: VoiceAccent;
  tone: VoiceTone;
};

const voice = (provider: VoiceProvider, providerVoiceId: string, label: string, gender: Gender, accent: VoiceAccent, tone: VoiceTone): CastVoice =>
  ({ id: `${provider}:${providerVoiceId}`, provider, providerVoiceId, label, gender, accent, tone });

export const CAST_VOICES: CastVoice[] = [
  voice("xai", "leo", "Leo", "male", "american", "deep"),
  voice("xai", "rex", "Rex", "male", "american", "clear"),
  voice("xai", "orion", "Orion", "male", "neutral", "dramatic"),
  voice("xai", "atlas", "Atlas", "male", "american", "warm"),
  voice("xai", "eve", "Eve", "female", "american", "bright"),
  voice("xai", "ara", "Ara", "female", "american", "warm"),
  voice("xai", "luna", "Luna", "female", "neutral", "soft"),
  voice("xai", "iris", "Iris", "female", "american", "clear"),
  voice("kokoro", "af_heart", "Heart", "female", "american", "warm"),
  voice("kokoro", "af_bella", "Bella", "female", "american", "soft"),
  voice("kokoro", "af_nicole", "Nicole", "female", "american", "deep"),
  voice("kokoro", "af_nova", "Nova", "female", "american", "bright"),
  voice("kokoro", "af_sarah", "Sarah", "female", "american", "clear"),
  voice("kokoro", "af_sky", "Sky", "female", "american", "neutral"),
  voice("kokoro", "am_adam", "Adam", "male", "american", "deep"),
  voice("kokoro", "am_michael", "Michael", "male", "american", "warm"),
  voice("kokoro", "am_puck", "Puck", "male", "american", "bright"),
  voice("kokoro", "am_fenrir", "Fenrir", "male", "american", "dramatic"),
  voice("kokoro", "bf_alice", "Alice", "female", "british", "warm"),
  voice("kokoro", "bf_emma", "Emma", "female", "british", "clear"),
  voice("kokoro", "bf_isabella", "Isabella", "female", "british", "soft"),
  voice("kokoro", "bf_lily", "Lily", "female", "british", "bright"),
  voice("kokoro", "bm_daniel", "Daniel", "male", "british", "deep"),
  voice("kokoro", "bm_fable", "Fable", "male", "british", "dramatic"),
  voice("kokoro", "bm_george", "George", "male", "british", "warm"),
  voice("kokoro", "bm_lewis", "Lewis", "male", "british", "clear"),
  voice("sherpa", "en_US-amy-medium", "Amy", "female", "american", "warm"),
  voice("sherpa", "en_US-hfc_female-medium", "HFC Female", "female", "american", "clear"),
  voice("sherpa", "en_US-lessac-medium", "Lessac", "male", "american", "clear"),
  voice("sherpa", "en_US-ryan-medium", "Ryan", "male", "american", "warm"),
  voice("sherpa", "en_GB-alba-medium", "Alba", "female", "british", "warm"),
  voice("sherpa", "en_GB-cori-medium", "Cori", "female", "british", "soft"),
  voice("sherpa", "en_GB-northern_english_male-medium", "Northern English", "male", "british", "deep"),
];

export function defaultVoiceId(gender: Gender, role?: string) {
  if (role === "narrator") return gender === "female" ? "xai:luna" : "xai:orion";
  if (gender === "male") return "xai:leo";
  if (gender === "female") return "xai:eve";
  return "xai:orion";
}

export function resolveVoiceId(id: string) {
  const aliases: Record<string, string> = {
    "male-low": "xai:leo", "female-warm": "xai:eve", narrator: "xai:orion", male: "xai:leo", female: "xai:eve",
  };
  const mapped = aliases[id] || (id.includes(":") ? id : `xai:${id}`);
  return CAST_VOICES.some((candidate) => candidate.id === mapped) ? mapped : "";
}

export function voiceById(id: string) {
  const normalized = resolveVoiceId(id);
  return CAST_VOICES.find((candidate) => candidate.id === normalized);
}

export function voiceMatchScore(candidate: Pick<CastVoice, "gender" | "accent" | "tone">, wanted: { gender: Gender; accent?: VoiceAccent; tone?: VoiceTone }) {
  let score = candidate.gender === wanted.gender ? 100 : candidate.gender === "neutral" ? 40 : -100;
  if (wanted.accent && wanted.accent !== "neutral") score += candidate.accent === wanted.accent ? 25 : 0;
  if (wanted.tone && wanted.tone !== "neutral") score += candidate.tone === wanted.tone ? 15 : 0;
  return score;
}
