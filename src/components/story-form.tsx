import { useState } from "react";
import { defaultVoiceId } from "@/lib/tts-catalog";
import { COVER_PRESETS } from "@/lib/covers";
import { synthTts } from "@/lib/tts";
import { validateStory } from "@/lib/story-validate";
import {
  applyNames,
  defaultDisplayNames,
  defaultSpeak,
  spokenNames,
  type Gender,
  type Story,
  type StoryBeat,
  type StoryCharacter,
} from "@/lib/story-types";
import { cn } from "@/lib/utils";

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "char";
}

export function StoryForm({
  story,
  onChange,
}: {
  story: Story;
  onChange: (story: Story) => void;
}) {
  const [previewMsg, setPreviewMsg] = useState("");
  const issues = validateStory(story);
  const cast = story.config.characters;

  function patch(p: Partial<Story>) {
    onChange({ ...story, ...p });
  }

  function patchConfig(p: Partial<Story["config"]>) {
    const config = { ...story.config, ...p };
    onChange({
      ...story,
      title: p.title ?? story.title,
      category: p.category ?? story.category,
      config,
    });
  }

  function updateCast(i: number, next: (typeof cast)[number]) {
    const characters = [...cast];
    characters[i] = next;
    const list: StoryCharacter[] = characters.map((c) => ({
      id: c.id,
      defaultName: c.name,
      pronounceAs: c.pronounceAs,
      defaultVoice: c.gender === "male" ? "male-low" : "female-warm",
    }));
    const narrator = story.characters.find((c) => c.id === "narrator") || {
      id: "narrator",
      defaultName: "Narrator",
      defaultVoice: "narrator" as const,
    };
    onChange({
      ...story,
      config: { ...story.config, characters, characterCount: characters.length },
      characters: [...list, narrator],
    });
  }

  function addCast() {
    const id = slug(`char-${cast.length + 1}`);
    const characters = [...cast, { id, name: "New", gender: "female" as const, pronounceAs: "New" }];
    const list: StoryCharacter[] = characters.map((c) => ({
      id: c.id,
      defaultName: c.name,
      pronounceAs: c.pronounceAs,
      defaultVoice: c.gender === "male" ? "male-low" : "female-warm",
    }));
    const narrator = story.characters.find((c) => c.id === "narrator") || {
      id: "narrator",
      defaultName: "Narrator",
      defaultVoice: "narrator" as const,
    };
    onChange({
      ...story,
      config: { ...story.config, characters, characterCount: characters.length },
      characters: [...list, narrator],
    });
  }

  function removeCast(i: number) {
    const characters = cast.filter((_, idx) => idx !== i);
    const ids = new Set(characters.map((c) => c.id).concat("narrator"));
    const list: StoryCharacter[] = characters.map((c) => ({
      id: c.id,
      defaultName: c.name,
      pronounceAs: c.pronounceAs,
      defaultVoice: c.gender === "male" ? "male-low" : "female-warm",
    }));
    const narrator = story.characters.find((c) => c.id === "narrator") || {
      id: "narrator",
      defaultName: "Narrator",
      defaultVoice: "narrator" as const,
    };
    onChange({
      ...story,
      config: { ...story.config, characters, characterCount: characters.length },
      characters: [...list, narrator],
      beats: story.beats.filter((b) => ids.has(b.speaker)),
    });
  }

  function updateBeat(i: number, beat: StoryBeat) {
    const beats = [...story.beats];
    beats[i] = beat;
    onChange({ ...story, beats });
  }

  async function previewBeat(beat: StoryBeat) {
    const ch = story.config.characters.find((c) => c.id === beat.speaker);
    const gender = (beat.speaker === "narrator" ? "male" : ch?.gender || "female") as Gender;
    const vid = defaultVoiceId(gender, beat.speaker);
    const spoken = spokenNames(story, defaultDisplayNames(story), defaultSpeak(story));
    const text = applyNames(beat.text, spoken);
    setPreviewMsg(`Rendering ${beat.speaker} as ${vid}\u2026`);
    const data = await synthTts({ data: { text, voiceId: vid } });
    if (!data.ok) {
      setPreviewMsg(data.error);
      return;
    }
    const used = "voiceId" in data ? data.voiceId : vid;
    const audio = new Audio(data.url || `data:${data.mime};base64,${data.b64}`);
    setPreviewMsg(`Playing ${beat.speaker} (${used})`);
    audio.onended = () => setPreviewMsg("");
    await audio.play().catch((err) => setPreviewMsg(String(err)));
  }

  return (
    <div className="space-y-5">
      {issues.length ? (
        <ul className="rounded-md bg-raised p-3 text-sm">
          {issues.map((iss, i) => (
            <li key={i} className={iss.level === "error" ? "text-danger" : "text-muted"}>
              {iss.level}: {iss.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Layout looks valid.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-muted">
          Id
          <input
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
            value={story.id}
            onChange={(e) => patch({ id: e.target.value })}
          />
        </label>
        <label className="block text-sm text-muted">
          Title
          <input
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
            value={story.config.title}
            onChange={(e) => patchConfig({ title: e.target.value })}
          />
        </label>
        <label className="block text-sm text-muted">
          Series
          <input
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
            value={story.config.series}
            onChange={(e) => patchConfig({ series: e.target.value })}
          />
        </label>
        <label className="block text-sm text-muted">
          Genre
          <input
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
            value={story.config.genre}
            onChange={(e) => patchConfig({ genre: e.target.value })}
          />
        </label>
        <label className="block text-sm text-muted">
          Category
          <input
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
            value={story.config.category}
            onChange={(e) => patchConfig({ category: e.target.value })}
          />
        </label>
        <label className="block text-sm text-muted">
          Presentation
          <select
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
            value={story.config.presentation ?? "book"}
            onChange={(event) => {
              const presentation = event.target.value === "anime" ? "anime" : "book";
              patchConfig({
                presentation,
                anime: presentation === "anime"
                  ? story.config.anime ?? { demographic: "general", visualStyle: "modern", episodeStructure: true }
                  : undefined,
              });
            }}
          >
            <option value="book">Book</option>
            <option value="anime">Anime-inspired</option>
          </select>
        </label>
        {story.config.presentation === "anime" ? (
          <>
            <label className="block text-sm text-muted">
              Anime audience
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
                value={story.config.anime?.demographic ?? "general"}
                onChange={(event) => patchConfig({ anime: { ...story.config.anime, demographic: event.target.value as NonNullable<Story["config"]["anime"]>["demographic"] } })}
              >
                <option value="general">General</option><option value="kodomo">Kodomo</option>
                <option value="shonen">Shōnen</option><option value="shojo">Shōjo</option>
                <option value="seinen">Seinen</option><option value="josei">Josei</option>
              </select>
            </label>
            <label className="block text-sm text-muted">
              Visual style
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
                value={story.config.anime?.visualStyle ?? "modern"}
                onChange={(event) => patchConfig({ anime: { ...story.config.anime, visualStyle: event.target.value as NonNullable<Story["config"]["anime"]>["visualStyle"] } })}
              >
                <option value="modern">Modern</option><option value="cel">Cel animation</option>
                <option value="watercolor">Watercolor</option><option value="retro">Retro</option>
                <option value="chibi">Chibi</option>
              </select>
            </label>
          </>
        ) : null}
        <label className="block text-sm text-muted">
          Chapter
          <input
            type="number"
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
            value={story.config.chapter}
            onChange={(e) => patchConfig({ chapter: Number(e.target.value) || 1 })}
          />
        </label>
        <label className="block text-sm text-muted">
          Episode
          <input
            type="number"
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
            value={story.config.episode}
            onChange={(e) => patchConfig({ episode: Number(e.target.value) || 1 })}
          />
        </label>
        <label className="block text-sm text-muted">
          Version
          <input
            type="number"
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
            value={story.config.version}
            onChange={(e) => {
              const version = Number(e.target.value) || 1;
              patch({ storyRev: version, config: { ...story.config, version } });
            }}
          />
        </label>
        <label className="block text-sm text-muted">
          Age
          <select
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
            value={story.config.age}
            onChange={(e) => {
              const age = e.target.value === "18+" ? "18+" : "all";
              patch({
                rating: age === "18+" ? "explicit" : "general",
                config: { ...story.config, age },
              });
            }}
          >
            <option value="all">All</option>
            <option value="18+">18+</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={story.config.continuation}
            onChange={(e) => patchConfig({ continuation: e.target.checked })}
          />
          Continuation
        </label>
        <label className="block text-sm text-muted">
          Visibility
          <select
            className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
            value={story.visibility ?? (story.published !== false ? "public" : "private")}
            onChange={(event) => {
              const visibility = event.target.value as "private" | "unlisted" | "public";
              patch({ visibility, published: visibility === "public" });
            }}
          >
            <option value="private">Private — only you</option>
            <option value="unlisted">Unlisted — share links only</option>
            <option value="public">Public — catalog</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={story.allowNameChange}
            onChange={(e) => patch({ allowNameChange: e.target.checked })}
          />
          Allow name change
        </label>
      </div>

      <div>
        <p className="mb-2 font-display">Cover</p>
        <div className="flex flex-wrap gap-2">
          {COVER_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => patchConfig({ cover: p.id })}
              className={cn(
                "min-h-11 rounded-md px-3 text-sm",
                story.config.cover === p.id ? "ring-2 ring-primary" : "",
              )}
              style={{ background: p.bg, color: p.ink }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display">Cast</p>
          <button type="button" className="min-h-11 rounded-md bg-raised px-3 text-sm" onClick={addCast}>
            Add character
          </button>
        </div>
        <div className="space-y-3">
          {cast.map((c, i) => (
            <div key={c.id + i} className="grid gap-2 rounded-md bg-raised p-3 sm:grid-cols-2">
              <label className="text-sm text-muted">
                Id
                <input
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
                  value={c.id}
                  onChange={(e) => updateCast(i, { ...c, id: e.target.value })}
                />
              </label>
              <label className="text-sm text-muted">
                Name
                <input
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
                  value={c.name}
                  onChange={(e) => updateCast(i, { ...c, name: e.target.value, pronounceAs: c.pronounceAs || e.target.value })}
                />
              </label>
              <label className="text-sm text-muted">
                Pronounce as
                <input
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
                  value={c.pronounceAs || ""}
                  onChange={(e) => updateCast(i, { ...c, pronounceAs: e.target.value })}
                />
              </label>
              <label className="text-sm text-muted">
                Gender
                <select
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
                  value={c.gender}
                  onChange={(e) =>
                    updateCast(i, { ...c, gender: e.target.value === "male" ? "male" : "female" })
                  }
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </label>
              <button type="button" className="min-h-11 rounded-md bg-danger px-3 text-sm text-fg sm:col-span-2" onClick={() => removeCast(i)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display">Beats</p>
          <button
            type="button"
            className="min-h-11 rounded-md bg-raised px-3 text-sm"
            onClick={() =>
              onChange({
                ...story,
                beats: story.beats.concat({
                  id: `b${story.beats.length + 1}`,
                  speaker: "narrator",
                  text: "",
                }),
              })
            }
          >
            Add beat
          </button>
        </div>
        {previewMsg ? <p className="mb-2 text-sm text-muted">{previewMsg}</p> : null}
        <div className="space-y-3">
          {story.beats.map((b, i) => (
            <div key={b.id + i} className="rounded-md bg-raised p-3">
              <div className="mb-2 flex flex-wrap gap-2">
                <select
                  className="min-h-11 rounded-md border border-border bg-bg px-2 text-fg"
                  value={b.speaker}
                  onChange={(e) => updateBeat(i, { ...b, speaker: e.target.value })}
                >
                  {story.characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id}
                    </option>
                  ))}
                </select>
                <input
                  className="min-h-11 w-24 rounded-md border border-border bg-bg px-2 text-sm text-fg"
                  value={b.id}
                  onChange={(e) => updateBeat(i, { ...b, id: e.target.value })}
                />
                <button
                  type="button"
                  className="min-h-11 rounded-md bg-bg px-3 text-sm"
                  onClick={() => void previewBeat(b)}
                >
                  Preview line
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-md px-3 text-sm text-muted"
                  onClick={() => onChange({ ...story, beats: story.beats.filter((_, idx) => idx !== i) })}
                >
                  Remove
                </button>
              </div>
              <textarea
                className="min-h-24 w-full rounded-md border border-border bg-bg p-2 text-sm text-fg"
                value={b.text}
                onChange={(e) => updateBeat(i, { ...b, text: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
