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
import { CAST_VOICES, defaultVoiceId } from "@/lib/tts-catalog";
import { synthTts } from "@/lib/tts";
import { clipsToWav, downloadBlob } from "@/lib/audio-export";
import { useStoryStore } from "@/lib/story-store";
import { cn } from "@/lib/utils";

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
}) {
  const sex: Gender = gender === "female" ? "female" : "male";
  const voices = CAST_VOICES.filter((v) => v.gender === sex);
  const selected = voices.some((v) => v.id === voice) ? voice : (voices[0]?.id ?? "");

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
      <label className="block text-sm text-muted">
        Voice
        <select
          key={`${id}-${sex}`}
          className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
          value={selected}
          onChange={(e) => onGenderVoice(sex, e.target.value)}
        >
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
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
