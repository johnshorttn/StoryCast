export type StoryUploadFile = { name: string; text(): Promise<string> };

export async function readStoryUpload(files: Iterable<StoryUploadFile>) {
  const selected = [...files];
  if (!selected.length) return { ok: false as const, error: "Choose a story file" };
  for (const file of selected) {
    if (!/\.(json|txt|md|markdown)$/i.test(file.name)) {
      return { ok: false as const, error: `${file.name} must be JSON, text, or Markdown` };
    }
  }
  const content = (await Promise.all(selected.map((file) => file.text()))).join("\n");
  return {
    ok: true as const,
    content,
    names: selected.map((file) => file.name),
    allJson: selected.every((file) => file.name.toLowerCase().endsWith(".json")),
  };
}
