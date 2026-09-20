import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { safeAudioSegment } from "./audio-render";

export type StoredAudio = { path: string; url: string };

export function audioStorageConfigured() {
  return Boolean(process.env.STORY_AUDIO_ROOT?.trim() && process.env.STORY_AUDIO_PUBLIC_URL?.trim());
}

function extensionForMime(mime: string) {
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  return "mp3";
}

export async function storeBeatAudio(input: {
  storyId: string;
  chapterId: string;
  beatId: string;
  renderHash: string;
  mime: string;
  bytes: Buffer;
}): Promise<StoredAudio | null> {
  const root = process.env.STORY_AUDIO_ROOT?.trim();
  const publicBase = process.env.STORY_AUDIO_PUBLIC_URL?.trim().replace(/\/$/, "");
  if (!root || !publicBase) return null;
  const relative = [input.storyId, input.chapterId, input.beatId].map(safeAudioSegment);
  const directory = join(root, ...relative);
  const filename = `${input.renderHash}.${extensionForMime(input.mime)}`;
  const path = join(directory, filename);
  await mkdir(directory, { recursive: true });
  await writeFile(path, input.bytes, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
  });
  return {
    path,
    url: `${publicBase}/${relative.map(encodeURIComponent).join("/")}/${encodeURIComponent(filename)}`,
  };
}

export async function readStoredAudio(path: string) {
  const root = process.env.STORY_AUDIO_ROOT?.trim();
  if (!root || !audioStorageConfigured() || !extname(path)) return null;
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(path);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${sep}`)) return null;
  return readFile(resolvedPath).catch(() => null);
}
