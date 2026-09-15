import type { Gender } from "./story-types";

export type CastVoice = {
  id: string;
  label: string;
  gender: Gender;
};

/** Built-in xAI TTS voices. Male IDs were missing from device speech. */
export const CAST_VOICES: CastVoice[] = [
  { id: "leo", label: "Leo — male, strong", gender: "male" },
  { id: "rex", label: "Rex — male, clear", gender: "male" },
  { id: "orion", label: "Orion — male, narrator", gender: "male" },
  { id: "atlas", label: "Atlas — male, steady", gender: "male" },
  { id: "eve", label: "Eve — female, bright", gender: "female" },
  { id: "ara", label: "Ara — female, warm", gender: "female" },
  { id: "luna", label: "Luna — female, soft", gender: "female" },
  { id: "iris", label: "Iris — female, friendly", gender: "female" },
];

export function defaultVoiceId(gender: Gender, role?: string) {
  if (role === "narrator") return gender === "female" ? "luna" : "orion";
  if (gender === "male") return "leo";
  if (gender === "female") return "eve";
  return "orion";
}

export function resolveVoiceId(id: string) {
  const aliases: Record<string, string> = {
    "male-low": "leo",
    "female-warm": "eve",
    narrator: "orion",
    male: "leo",
    female: "eve",
  };
  const mapped = aliases[id] || id;
  return CAST_VOICES.some((v) => v.id === mapped) ? mapped : "";
}
