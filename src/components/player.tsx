import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Pause, Play, Square } from "lucide-react";
import {
  applyNames,
  beatsForMode,
  defaultDisplayNames,
  defaultGenders,
  defaultSpeak,
  displayTitle,
  spokenNames,
  type Gender,
  type Story,
} from "@/lib/story-types";
import {
  CAST_VOICES,
  defaultVoiceId,
  voiceMatchScore,
  type VoiceAccent,
  type VoiceProvider,
  type VoiceTone,
} from "@/lib/tts-catalog";
import { getTtsCapabilities, synthTts } from "@/lib/tts";
import { clipsToWav, downloadBlob } from "@/lib/audio-export";
import { useStoryStore } from "@/lib/story-store";
import { cn } from "@/lib/utils";
import { ensureVoices, speakLine, stopSpeech, voiceOptions, type VoiceOption } from "@/lib/speech";

type PlayerVoice = {
  id: string;
  label: string;
  gender: Gender;
  provider: VoiceProvider | "device";
  accent: VoiceAccent;
  tone: VoiceTone;
  available: boolean;
};
type VoicePreference = { accent: VoiceAccent; tone: VoiceTone };

function defaultVoicePreferences(story: Story): Record<string, VoicePreference> {
  const genders = defaultGenders(story);
  return Object.fromEntries(
    story.characters.map((character) => [
      character.id,
      {
        accent: "american" as const,
        tone: character.id === "narrator" ? "dramatic" as const : genders[character.id] === "male" ? "deep" as const : "warm" as const,
      },
    ]),
  );
}

function playDataUrl(
  el: HTMLAudioElement,
  url: string,
  signal: { stopped: boolean; paused: boolean },
  rate: number,
  startFrac = 0,
) {
  return new Promise<"ended" | "paused" | "stopped">((resolve, reject) => {
    const onEnd = () => {
      cleanup();
      resolve("ended");
    };
    const onErr = () => {
      cleanup();
      reject(new Error("Could not play audio"));
    };
    const onPause = () => {
      if (signal.paused) {
        cleanup();
        resolve("paused");
      }
    };
    const cleanup = () => {
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("error", onErr);
      el.removeEventListener("pause", onPause);
    };
    el.addEventListener("ended", onEnd);
    el.addEventListener("error", onErr);
    el.addEventListener("pause", onPause);
    el.src = url;
    el.playbackRate = rate;
    const seek = () => {
      if (startFrac > 0 && el.duration && Number.isFinite(el.duration)) {
        el.currentTime = startFrac * el.duration;
      }
    };
    el.addEventListener("loadedmetadata", seek, { once: true });
    if (signal.stopped) {
      cleanup();
      resolve("stopped");
      return;
    }
    if (signal.paused) {
      cleanup();
      resolve("paused");
      return;
    }
    void el.play().catch(onErr);
  });
}

function ProgressMeter({
  phase,
  label,
  percent,
  detail,
}: {
  phase: "idle" | "rendering" | "playing";
  label: string;
  percent: number;
  detail: string;
}) {
  if (phase === "idle") return null;
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div className="mb-4 rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]" aria-live="polite">
      <div className="mb-2 flex items-center gap-3">
        {phase === "rendering" ? (
          <span className="sc-spin shrink-0" aria-hidden />
        ) : (
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
        )}
        <div className="min-w-0">
          <p className="font-display text-sm text-fg">{label}</p>
          <p className="text-xs text-muted">{detail}</p>
        </div>
        <span className="ml-auto font-display text-sm tabular-nums text-primary">{Math.round(pct)}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-raised"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Playback progress"
      >
        <div
          className={cn("h-full rounded-full bg-primary", phase === "rendering" && "sc-pulse")}
          style={{ width: `${Math.max(phase === "rendering" ? 8 : 0, pct)}%` }}
        />
      </div>
    </div>
  );
}

function VoiceBlock({
  id,
  isNarrator,
  name,
  pronounce,
  gender,
  voice,
  onName,
  onPronounce,
  onGenderVoice,
  onPreview,
  previewing,
  voices,
  accent,
  tone,
  onPreference,
}: {
  id: string;
  isNarrator: boolean;
  name: string;
  pronounce: string;
  gender: Gender;
  voice: string;
  onName: (v: string) => void;
  onPronounce: (v: string) => void;
  onGenderVoice: (gender: Gender, voice: string) => void;
  onPreview: () => void;
  previewing: boolean;
  voices: PlayerVoice[];
  accent: VoiceAccent;
  tone: VoiceTone;
  onPreference: (preference: VoicePreference) => void;
}) {
  const sex: Gender = gender === "female" ? "female" : "male";
  const filteredVoices = voices
    .filter((v) => v.gender === sex || v.gender === "neutral")
    .sort((a, b) =>
      voiceMatchScore(b, { gender: sex, accent, tone }) - voiceMatchScore(a, { gender: sex, accent, tone }) ||
      a.label.localeCompare(b.label),
    );
  const selected = filteredVoices.some((v) => v.id === voice) ? voice : (filteredVoices[0]?.id ?? "");
  const recommended = filteredVoices.find((candidate) => candidate.available);

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-muted">{isNarrator ? "narrator" : id}</p>
      {!isNarrator ? (
        <>
          <label className="block text-sm text-muted">
            Name
            <input
              className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
              value={name}
              onChange={(e) => onName(e.target.value)}
            />
          </label>
          <label className="block text-sm text-muted">
            Pronounce as
            <input
              className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
              value={pronounce}
              onChange={(e) => onPronounce(e.target.value)}
            />
          </label>
        </>
      ) : null}
      <label className="block text-sm text-muted">
        Gender
        <select
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
          value={sex}
          onChange={(e) => {
            const next: Gender = e.target.value === "female" ? "female" : "male";
            onGenderVoice(next, defaultVoiceId(next, id));
          }}
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm text-muted">
          Accent
          <select
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-2 text-fg"
            value={accent}
            onChange={(event) => onPreference({ accent: event.target.value as VoiceAccent, tone })}
          >
            <option value="american">American</option>
            <option value="british">British</option>
            <option value="neutral">Any</option>
          </select>
        </label>
        <label className="text-sm text-muted">
          Tone
          <select
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-2 text-fg"
            value={tone}
            onChange={(event) => onPreference({ accent, tone: event.target.value as VoiceTone })}
          >
            <option value="warm">Warm</option>
            <option value="clear">Clear</option>
            <option value="soft">Soft</option>
            <option value="deep">Deep</option>
            <option value="bright">Bright</option>
            <option value="dramatic">Dramatic</option>
            <option value="neutral">Any</option>
          </select>
        </label>
      </div>
      {recommended ? (
        <button
          type="button"
          className="w-full rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-left text-sm text-fg"
          onClick={() => onGenderVoice(sex, recommended.id)}
        >
          <span className="block text-xs uppercase tracking-wide text-primary">Recommended</span>
          <span className="font-semibold">{recommended.label}</span>
          <span className="text-muted"> · {recommended.provider}</span>
        </button>
      ) : (
        <p className="rounded-md bg-raised p-2 text-xs text-muted">No configured voice matches this character yet.</p>
      )}
      <label className="block text-sm text-muted">
        Voice
        <select
          key={`${id}-${sex}`}
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
          value={selected}
          onChange={(e) => onGenderVoice(sex, e.target.value)}
        >
          {filteredVoices.map((v) => (
            <option key={v.id} value={v.id} disabled={!v.available}>
              {v.accent === accent && v.tone === tone ? "★ " : ""}{v.label} · {v.provider}{v.available ? "" : " (not configured)"}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-raised text-sm text-fg"
        onClick={onPreview}
      >
        {previewing ? <span className="sc-spin" /> : null}
        Preview name
      </button>
    </div>
  );
}

const SPEEDS = [0.9, 1, 1.15];

export function Player({
  story,
  nextStory,
  autoplay,
  onPlayNext,
}: {
  story: Story;
  nextStory?: Story;
  autoplay?: boolean;
  onPlayNext?: () => void;
}) {
  const speed = useStoryStore((s) => s.speed);
  const setSpeed = useStoryStore((s) => s.setSpeed);
  const progressMap = useStoryStore((s) => s.progress);
  const setProgress = useStoryStore((s) => s.setProgress);
  const clearProgress = useStoryStore((s) => s.clearProgress);
  const saved = progressMap[story.id];

  const [mode, setMode] = useState<"narrator" | "cast">("cast");
  const [names, setNames] = useState(() => defaultDisplayNames(story));
  const [speak, setSpeak] = useState(() => defaultSpeak(story));
  const [genders, setGenders] = useState(() => defaultGenders(story));
  const [voiceId, setVoiceId] = useState<Record<string, string>>(() => {
    const g = defaultGenders(story);
    const o: Record<string, string> = {};
    for (const c of story.characters) {
      o[c.id] = defaultVoiceId(g[c.id] || (c.id === "narrator" ? "male" : "female"), c.id);
    }
    return o;
  });
  const [deviceVoiceRecords, setDeviceVoiceRecords] = useState<SpeechSynthesisVoice[]>([]);
  const [deviceVoiceOptions, setDeviceVoiceOptions] = useState<VoiceOption[]>([]);
  const [capabilities, setCapabilities] = useState<Record<VoiceProvider, boolean>>({ xai: false, kokoro: false, sherpa: false });
  const [voicePreferences, setVoicePreferences] = useState(() => defaultVoicePreferences(story));
  const [active, setActive] = useState(saved?.beat ?? -1);
  const [playing, setPlaying] = useState(false);
  const [phase, setPhase] = useState<"idle" | "rendering" | "playing">("idle");
  const [lineFrac, setLineFrac] = useState(saved?.frac ?? 0);
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(false);
  const stopRef = useRef({ stopped: false, paused: false });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clipsRef = useRef<Map<string, { mime: string; b64: string; url?: string }>>(new Map());
  const speedRef = useRef(speed);
  const autoRef = useRef(false);

  useEffect(() => {
    void ensureVoices().then((records) => {
      setDeviceVoiceRecords(records);
      setDeviceVoiceOptions(voiceOptions(records));
    });
    void getTtsCapabilities().then(setCapabilities);
  }, []);

  useEffect(() => {
    speedRef.current = speed;
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    setNames(defaultDisplayNames(story));
    setSpeak(defaultSpeak(story));
    const g = defaultGenders(story);
    setGenders(g);
    setVoicePreferences(defaultVoicePreferences(story));
    const o: Record<string, string> = {};
    for (const c of story.characters) {
      o[c.id] = defaultVoiceId(g[c.id] || (c.id === "narrator" ? "male" : "female"), c.id);
    }
    setVoiceId(o);
    stopRef.current = { stopped: true, paused: false };
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
    }
    setPlaying(false);
    setPhase("idle");
    const p = useStoryStore.getState().progress[story.id];
    setActive(p?.beat ?? -1);
    setLineFrac(p?.frac ?? 0);
    setStatus("");
    setDone(false);
    clipsRef.current.clear();
    autoRef.current = false;
  }, [story.id]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      if (!el.duration || !Number.isFinite(el.duration)) return;
      const frac = el.currentTime / el.duration;
      setLineFrac(frac);
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, []);

  const beats = useMemo(() => beatsForMode(story, mode), [story, mode]);
  const spoken = useMemo(() => spokenNames(story, names, speak), [story, names, speak]);
  const availableVoices = useMemo<PlayerVoice[]>(
    () => [
      ...CAST_VOICES.map((voice) => ({ ...voice, available: capabilities[voice.provider] })),
      ...deviceVoiceOptions.map((voice) => ({
        id: `device:${voice.uri}`,
        label: `${voice.name}${voice.lang ? ` (${voice.lang})` : ""}`,
        gender: voice.gender,
        provider: "device" as const,
        accent: /^en-GB/i.test(voice.lang) ? "british" as const : /^en-US/i.test(voice.lang) ? "american" as const : "neutral" as const,
        tone: "neutral" as const,
        available: true,
      })),
    ],
    [capabilities, deviceVoiceOptions],
  );

  const lines = useMemo(
    () =>
      beats.map((b) => {
        const gender = (genders[b.speaker] || "female") as Gender;
        const vid = voiceId[b.speaker] || defaultVoiceId(gender, b.speaker);
        return {
          id: b.id,
          speaker: b.speaker,
          text: applyNames(b.text, spoken),
          gender,
          voiceId: vid,
        };
      }),
    [beats, spoken, genders, mode, voiceId],
  );

  function genderFor(id: string): Gender {
    return genders[id] === "female" ? "female" : "male";
  }

  function setGenderVoice(id: string, gender: Gender, voice: string) {
    const sex: Gender = gender === "female" ? "female" : "male";
    const allowed = availableVoices.filter((v) => v.available && (v.gender === sex || v.gender === "neutral"));
    const preference = voicePreferences[id] || { accent: "american", tone: "neutral" };
    const fallback = [...allowed].sort(
      (a, b) =>
        voiceMatchScore(b, { gender: sex, ...preference }) -
        voiceMatchScore(a, { gender: sex, ...preference }),
    )[0]?.id;
    const nextVoice = allowed.some((v) => v.id === voice) ? voice : (fallback || defaultVoiceId(sex, id));
    setGenders((prev) => ({ ...prev, [id]: sex }));
    setVoiceId((prev) => ({ ...prev, [id]: nextVoice }));
  }

  function clipKey(text: string, vid: string) {
    return `${vid}|${text}`;
  }

  async function fetchClip(text: string, vid: string, line?: { id: string; speaker: string }) {
    if (vid.startsWith("device:")) throw new Error("Device voices cannot be exported as audio files");
    const key = clipKey(text, vid);
    const hit = clipsRef.current.get(key);
    if (hit) return hit;
    const data = await synthTts({
      data: {
        text,
        voiceId: vid,
        ...(line
          ? {
              render: {
                storyId: story.id,
                storyRevision: story.storyRev,
                chapterId: `chapter-${story.config.chapter || 1}`,
                beatId: line.id,
                characterId: line.speaker,
                settings: { mode },
                pronunciationVersion: JSON.stringify(spoken),
              },
            }
          : {}),
      },
    });
    if (!data.ok) throw new Error(data.error);
    const clip = { mime: data.mime, b64: data.b64, ...(data.url ? { url: data.url } : {}) };
    clipsRef.current.set(key, clip);
    return clip;
  }

  async function speakOne(text: string, vid: string, startFrac = 0, line?: { id: string; speaker: string }) {
    setPhase("rendering");
    if (startFrac <= 0) setLineFrac(0);
    if (vid.startsWith("device:")) {
      setPhase("playing");
      await speakLine(text, {
        uri: vid.slice("device:".length),
        gender: "neutral",
        voices: deviceVoiceRecords,
      });
      setLineFrac(1);
      return "ended" as const;
    }
    const clip = await fetchClip(text, vid, line);
    if (stopRef.current.stopped) return "stopped" as const;
    if (stopRef.current.paused) return "paused" as const;
    const url = clip.url || `data:${clip.mime};base64,${clip.b64}`;
    const el = audioRef.current;
    if (!el) throw new Error("No player");
    setPhase("playing");
    return playDataUrl(el, url, stopRef.current, speedRef.current, startFrac);
  }

  function startIndex() {
    const p = useStoryStore.getState().progress[story.id];
    if (!p) return 0;
    if (p.beat >= lines.length) return 0;
    if (p.frac >= 0.97 && p.beat === lines.length - 1) return 0;
    if (p.frac >= 0.97) return Math.min(p.beat + 1, lines.length - 1);
    return Math.max(0, p.beat);
  }

  async function play() {
    stopRef.current = { stopped: false, paused: false };
    setPlaying(true);
    setDone(false);
    const from = startIndex();
    const p = useStoryStore.getState().progress[story.id];
    const startFrac = p && p.beat === from ? p.frac : 0;
    setActive(from);
    setPhase("rendering");
    setStatus("Rendering voices\u2026");
    try {
      for (let i = from; i < lines.length; i++) {
        if (stopRef.current.stopped) return;
        if (stopRef.current.paused) return;
        setActive(i);
        setProgress(story.id, i, i === from ? startFrac : 0);
        setStatus(`Rendering ${lines[i].speaker}\u2026`);
        const result = await speakOne(lines[i].text, lines[i].voiceId, i === from ? startFrac : 0, lines[i]);
        if (result !== "ended") return;
        setProgress(story.id, i, 1);
      }
      if (!stopRef.current.stopped && !stopRef.current.paused) {
        setStatus("Finished");
        setPhase("idle");
        setLineFrac(1);
        setDone(true);
        clearProgress(story.id);
        if (nextStory && onPlayNext) {
          setStatus("Up next\u2026");
          window.setTimeout(() => {
            if (!stopRef.current.stopped) onPlayNext();
          }, 1200);
        }
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not play");
      setPhase("idle");
    } finally {
      setPlaying(false);
    }
  }

  function pause() {
    stopRef.current.paused = true;
    const el = audioRef.current;
    if (el) el.pause();
    stopSpeech();
    if (active >= 0) setProgress(story.id, active, lineFrac);
    setPlaying(false);
    setPhase("idle");
  }

  function stop() {
    stopRef.current = { stopped: true, paused: false };
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
    }
    stopSpeech();
    setPlaying(false);
    setPhase("idle");
    setActive(-1);
    setLineFrac(0);
    setDone(false);
  }

  async function downloadEpisode() {
    stopRef.current = { stopped: false, paused: false };
    setPhase("rendering");
    setStatus("Rendering episode for download\u2026");
    try {
      const clips = [];
      for (let i = 0; i < lines.length; i++) {
        if (stopRef.current.stopped) return;
        setActive(i);
        setStatus(`Rendering ${i + 1} of ${lines.length}\u2026`);
        clips.push(await fetchClip(lines[i].text, lines[i].voiceId, lines[i]));
      }
      const wav = await clipsToWav(clips);
      downloadBlob(wav, `${story.id}.wav`);
      setStatus("Downloaded episode");
      setPhase("idle");
      setActive(-1);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Download failed");
      setPhase("idle");
    }
  }

  useEffect(() => {
    if (!autoplay || autoRef.current || !lines.length) return;
    autoRef.current = true;
    void play();
  }, [autoplay, story.id, lines.length]);

  const total = Math.max(1, lines.length);
  const percent =
    active < 0 ? 0 : Math.min(100, ((active + (phase === "playing" ? lineFrac : 0.08)) / total) * 100);
  const detail =
    active < 0
      ? ""
      : phase === "rendering"
        ? `Line ${active + 1} of ${total} — building audio`
        : `Line ${active + 1} of ${total}`;
  const people = story.characters;
  const canResume = !!saved && saved.beat < lines.length && !playing;
  const usesDeviceVoice = lines.some((line) => line.voiceId.startsWith("device:"));

  return (
    <div>
      <audio ref={audioRef} className="hidden" />
      <ProgressMeter
        phase={phase}
        label={phase === "rendering" ? "Processing voice\u2026" : playing ? "Playing" : "Working"}
        percent={percent}
        detail={detail || status}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("cast")}
              className={cn(
                "min-h-11 rounded-md px-4 text-sm font-semibold",
                mode === "cast" ? "bg-primary text-primary-fg" : "bg-raised text-fg",
              )}
            >
              Cast
            </button>
            <button
              type="button"
              onClick={() => setMode("narrator")}
              className={cn(
                "min-h-11 rounded-md px-4 text-sm font-semibold",
                mode === "narrator" ? "bg-primary text-primary-fg" : "bg-raised text-fg",
              )}
            >
              One narrator
            </button>
          </div>
          <ol className="space-y-3">
            {lines.map((line, i) => (
              <li
                key={line.id}
                className={cn(
                  "rounded-lg bg-surface p-4 shadow-[var(--shadow-border)] transition-colors",
                  i === active && "shadow-[var(--shadow-border-hover)]",
                )}
              >
                <div className="mb-1 flex items-center gap-2">
                  <p className="font-display text-sm text-primary">{line.speaker}</p>
                  {i === active && phase === "rendering" ? <span className="sc-spin" aria-label="Rendering" /> : null}
                </div>
                <p className="text-[1.05rem] leading-relaxed text-fg">{line.text}</p>
                {i === active && phase !== "idle" ? (
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised">
                    <div
                      className={cn("h-full rounded-full bg-primary", phase === "rendering" && "sc-pulse")}
                      style={{ width: `${phase === "rendering" ? 28 : Math.round(lineFrac * 100)}%` }}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
        <aside className="h-fit rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="font-display text-base">Voices</p>
          <p className="mb-3 text-sm text-muted">
            Pick a voice profile and StoryCast ranks the closest matches across every configured provider.
          </p>
          <div className="mb-4">
            <p className="mb-2 text-sm text-muted">Speed</p>
            <div className="flex gap-2">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={cn(
                    "min-h-11 flex-1 rounded-md text-sm",
                    speed === s ? "bg-primary text-primary-fg" : "bg-raised text-fg",
                  )}
                >
                  {s === 1 ? "1\u00d7" : `${s}\u00d7`}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {people.map((c) => (
              <VoiceBlock
                key={c.id}
                id={c.id}
                isNarrator={c.id === "narrator"}
                name={names[c.id] || ""}
                pronounce={speak[c.id] || ""}
                gender={genderFor(c.id)}
                voice={voiceId[c.id] || ""}
                onName={(v) => setNames((prev) => ({ ...prev, [c.id]: v }))}
                onPronounce={(v) => setSpeak((prev) => ({ ...prev, [c.id]: v }))}
                onGenderVoice={(g, v) => setGenderVoice(c.id, g, v)}
                previewing={phase !== "idle" && !playing}
                voices={availableVoices}
                accent={voicePreferences[c.id]?.accent || "american"}
                tone={voicePreferences[c.id]?.tone || "neutral"}
                onPreference={(preference) =>
                  setVoicePreferences((current) => ({ ...current, [c.id]: preference }))
                }
                onPreview={() => {
                  const sample =
                    c.id === "narrator"
                      ? "Hello. I am the narrating voice currently chosen."
                      : `Hi. My name is ${speak[c.id] || names[c.id] || c.defaultName}.`;
                  stopRef.current = { stopped: false, paused: false };
                  setActive(0);
                  setStatus("Previewing\u2026");
                  const vid = voiceId[c.id] || defaultVoiceId(genderFor(c.id), c.id);
                  void speakOne(sample, vid)
                    .then(() => {
                      if (!stopRef.current.stopped) {
                        setStatus("");
                        setPhase("idle");
                        setActive(-1);
                      }
                    })
                    .catch((err) => {
                      setPhase("idle");
                      setStatus(err instanceof Error ? err.message : "preview failed");
                    });
                }}
              />
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => (playing ? pause() : void play())}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 font-semibold text-primary-fg"
            >
              {phase === "rendering" ? (
                <span className="sc-spin" />
              ) : playing ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4 ml-0.5" />
              )}
              {phase === "rendering" ? "Rendering" : playing ? "Pause" : canResume ? "Resume" : "Play"}
            </button>
            <button
              type="button"
              onClick={stop}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-raised px-3 text-fg"
              aria-label="Stop"
            >
              <Square className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void downloadEpisode()}
            disabled={usesDeviceVoice}
            title={usesDeviceVoice ? "Choose cloud voices to export a WAV episode" : undefined}
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-raised text-sm text-fg disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="size-4" />
            {usesDeviceVoice ? "Cloud voices required to download" : "Download episode"}
          </button>
          {nextStory ? (
            <button
              type="button"
              onClick={() => onPlayNext?.()}
              className="mt-2 min-h-11 w-full rounded-md bg-raised px-3 text-left text-sm text-fg"
            >
              Up next: {displayTitle(nextStory)}
            </button>
          ) : null}
          {done && !nextStory ? <p className="mt-3 text-sm text-muted">End of this title.</p> : null}
          {status ? <p className="mt-3 text-sm text-muted">{status}</p> : null}
        </aside>
      </div>
    </div>
  );
}
