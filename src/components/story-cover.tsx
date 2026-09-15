import { coverFor } from "@/lib/covers";
import { displayTitle, type Story } from "@/lib/story-types";

export function StoryCover({
  story,
  className = "",
  chapterCount,
}: {
  story: Story;
  className?: string;
  chapterCount?: number;
}) {
  const tone = coverFor(story);
  const mark = (story.config.series || story.title).slice(0, 1).toUpperCase();
  return (
    <div
      className={`relative aspect-[3/4] overflow-hidden rounded-md ${className}`}
      style={{ background: tone.bg, color: tone.ink }}
      aria-hidden
    >
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: tone.mark }} />
      <p className="absolute left-3 top-5 font-display text-5xl leading-none opacity-90">{mark}</p>
      {chapterCount && chapterCount > 1 ? (
        <p
          className="absolute right-3 top-4 rounded-sm px-2 py-1 text-[10px] uppercase tracking-wide"
          style={{ background: tone.mark, color: tone.bg }}
        >
          {chapterCount} ch
        </p>
      ) : story.config.chapter > 1 ? (
        <p className="absolute right-3 top-4 text-[11px] uppercase tracking-wide opacity-70">Ch. {story.config.chapter}</p>
      ) : null}
      <div className="absolute inset-x-3 bottom-3">
        <p className="text-[10px] uppercase tracking-[0.16em] opacity-70">{story.config.genre}</p>
        <p className="font-display text-lg leading-tight">{displayTitle(story)}</p>
        {story.config.continuation ? <p className="mt-1 text-[11px] opacity-70">Continuation</p> : null}
      </div>
    </div>
  );
}
