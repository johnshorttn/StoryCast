import type { Gender } from "./story-types";

export type VoiceOption = { uri: string; name: string; lang: string; gender: Gender };

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

export function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve([]);
  if (voicesReady) return voicesReady;
  voicesReady = new Promise((resolve) => {
    const grab = () => window.speechSynthesis.getVoices();
    const now = grab();
    if (now.length) {
      resolve(now);
      return;
    }
    const done = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", done);
      resolve(grab());
    };
    window.speechSynthesis.addEventListener("voiceschanged", done);
    window.setTimeout(done, 800);
  });
  return voicesReady;
}

function guessGender(v: SpeechSynthesisVoice): Gender {
  const n = `${v.name} ${v.voiceURI} ${v.lang}`.toLowerCase();
  if (/female|woman|girl|samantha|victoria|karen|moira|zira|susan|fiona|kate|salli|ivy|joanna|kendra|kimberly|salli|amy|emma|nicole|raveena|aria|jenny|sara|zira/.test(n)) {
    return "female";
  }
  if (/male|man|boy|daniel|david|alex|fred|tom|george|mark|matthew|justin|joey|brian|arthur|guy/.test(n)) {
    return "male";
  }
  if (/google uk english male/.test(n)) return "male";
  if (/google us english$/.test(n) || /google uk english female/.test(n)) return "female";
  return "neutral";
}

export function voiceOptions(voices: SpeechSynthesisVoice[]): VoiceOption[] {
  const en = voices.filter((v) => /^en\b/i.test(v.lang) || /english/i.test(v.name));
  const pool = en.length ? en : voices;
  const seen = new Set<string>();
  const out: VoiceOption[] = [];
  for (const v of pool) {
    const uri = v.voiceURI || v.name;
    if (seen.has(uri)) continue;
    seen.add(uri);
    out.push({ uri, name: v.name, lang: v.lang, gender: guessGender(v) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function defaultUriForGender(options: VoiceOption[], gender: Gender): string {
  const hit =
    options.find((o) => o.gender === gender) ||
    options.find((o) => gender === "neutral") ||
    options[0];
  return hit?.uri || "";
}

function voiceByUri(uri: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return voices.find((v) => (v.voiceURI || v.name) === uri) || null;
}

export function pitchForGender(gender: Gender) {
  if (gender === "male") return 0.82;
  if (gender === "female") return 1.12;
  return 1;
}

export function speakLine(text: string, opts: { uri?: string; gender: Gender; voices?: SpeechSynthesisVoice[] }): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      reject(new Error("Speech is not available in this browser"));
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    const voices = opts.voices || window.speechSynthesis.getVoices();
    const picked = opts.uri ? voiceByUri(opts.uri, voices) : null;
    if (picked) u.voice = picked;
    u.pitch = pitchForGender(opts.gender);
    u.rate = opts.gender === "male" ? 0.92 : 0.98;
    u.onend = () => resolve();
    u.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") resolve();
      else reject(new Error(e.error || "speech failed"));
    };
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeech() {
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
}

export async function speakQueue(
  lines: { text: string; gender: Gender; uri?: string }[],
  onIndex: (i: number) => void,
  signal: { stopped: boolean },
) {
  const voices = await ensureVoices();
  stopSpeech();
  await new Promise((r) => setTimeout(r, 40));
  for (let i = 0; i < lines.length; i++) {
    if (signal.stopped) return;
    onIndex(i);
    await speakLine(lines[i].text, { uri: lines[i].uri, gender: lines[i].gender, voices });
  }
}
