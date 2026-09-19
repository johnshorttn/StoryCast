import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { Shell } from "@/components/shell";
import { StoryForm } from "@/components/story-form";
import { askGrok } from "@/lib/ask-grok";
import { importStories, validateStory } from "@/lib/story-validate";
import { displayTitle, type Story } from "@/lib/story-types";
import { useStoryStore } from "@/lib/story-store";
import { cn } from "@/lib/utils";
import { SignInGate } from "@/lib/auth/gates";
import { getStoryRewriteCapability, rewriteStoryAsV2 } from "@/lib/story-rewrite";
import { readStoryUpload } from "@/lib/story-upload";
import { createStoryShare, getAccountTier, listStoryShares, revokeStoryShare } from "@/lib/story-api";
import { redeemPlanGift } from "@/lib/plan-gifts";

export const Route = createFileRoute("/admin")({ component: AdminRoute });

function AdminRoute() {
  return (
    <SignInGate>
      <Admin />
    </SignInGate>
  );
}

function Admin() {
  const hydrate = useStoryStore((s) => s.hydrate);
  const ready = useStoryStore((s) => s.ready);
  const custom = useStoryStore((s) => s.custom);
  const save = useStoryStore((s) => s.save);
  const saveMany = useStoryStore((s) => s.saveMany);
  const remove = useStoryStore((s) => s.remove);
  const fromTemplate = useStoryStore((s) => s.fromTemplate);
  const all = useMemo(() => useStoryStore.getState().all(), [custom, ready]);

  const [filter, setFilter] = useState("");
  const [currentId, setCurrentId] = useState("");
  const [draft, setDraft] = useState<Story | null>(null);
  const [json, setJson] = useState("");
  const [bulk, setBulk] = useState("");
  const [report, setReport] = useState<{ imported: string[]; skipped: { id: string; issues: string[] }[] } | null>(
    null,
  );
  const [tab, setTab] = useState<"fields" | "json" | "import">("fields");
  const [status, setStatus] = useState("");
  const [prompt, setPrompt] = useState("");
  const [log, setLog] = useState("Ask for a draft in the Storycast JSON layout. Then use JSON in reply.");
  const [lastGrok, setLastGrok] = useState("");
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [rewriteModel, setRewriteModel] = useState("");
  const [rewritePresentation, setRewritePresentation] = useState<"book" | "anime">("book");
  const fileRef = useRef<HTMLInputElement>(null);
  const [tier, setTier] = useState("free");
  const [shares, setShares] = useState<Array<{ id: string; label: string | null; expires_at: string | null }>>([]);
  const [giftCode, setGiftCode] = useState("");

  useEffect(() => {
    void hydrate(true);
    void getStoryRewriteCapability().then((capability) =>
      setRewriteModel(capability.configured ? capability.model : "not configured"),
    );
    void getAccountTier().then((account) => setTier(account.tier));
  }, [hydrate]);

  const cats = [...new Set(all.map((s) => s.category || s.config.category || "uncategorized"))];
  const visible = all.filter((s) => !filter || (s.category || s.config.category) === filter);

  function loadStory(s: Story) {
    setCurrentId(s.id);
    setDraft(structuredClone(s));
    setJson(JSON.stringify(s, null, 2));
    setStatus(s.id);
    setTab("fields");
    void listStoryShares({ data: { storyId: s.id } }).then(setShares).catch(() => setShares([]));
  }

  async function applyImport(text: string) {
    const result = importStories(text);
    if (result.error) {
      setStatus(result.error);
      setReport(null);
      return;
    }
    if (result.imported.length) await saveMany(result.imported);
    setReport({
      imported: result.imported.map((s) => s.id),
      skipped: result.skipped,
    });
    setStatus(
      [
        result.imported.length ? `Imported ${result.imported.length}` : "",
        result.skipped.length ? `Skipped ${result.skipped.length}` : "",
      ]
        .filter(Boolean)
        .join(" \u00b7 ") || "Nothing imported",
    );
    if (result.imported[0]) loadStory(result.imported[0]);
  }

  async function onJsonFiles(files: FileList | null) {
    if (!files?.length) return;
    const upload = await readStoryUpload(files);
    if (!upload.ok) {
      setStatus(upload.error);
      return;
    }
    setBulk(upload.content);
    setStatus(`Loaded ${upload.names.join(", ")}`);
    if (upload.allJson) await applyImport(upload.content);
    if (fileRef.current) fileRef.current.value = "";
  }

  function applyDraft(next: Story) {
    setDraft(next);
    setJson(JSON.stringify(next, null, 2));
  }

  function parseEditor(): Story {
    if (tab === "json") return JSON.parse(json) as Story;
    if (!draft) throw new Error("Nothing to save");
    return draft;
  }

  return (
    <Shell wide>
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-primary">Catalog</p>
        <h1 className="font-display text-3xl tracking-tight">Administer stories</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Upload, rewrite, and manage private, unlisted, or public stories. Your current account tier is {tier}.
        </p>
        <form
          className="mt-3 flex max-w-lg flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void redeemPlanGift({ data: { code: giftCode } })
              .then((gift) => {
                setTier(gift.tier);
                setGiftCode("");
                setStatus(`Gift redeemed: ${gift.durationDays} days of ${gift.tier}`);
              })
              .catch((error) => setStatus(error instanceof Error ? error.message : "Could not redeem gift"));
          }}
        >
          <input
            aria-label="Gift code"
            className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-fg"
            value={giftCode}
            onChange={(event) => setGiftCode(event.target.value)}
            placeholder="Paid-plan gift code"
          />
          <button type="submit" disabled={!giftCode.trim()} className="min-h-11 rounded-md bg-raised px-4 text-sm text-fg disabled:opacity-50">
            Redeem gift
          </button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr_280px]">
        <aside className="rounded-lg bg-surface p-3 shadow-[var(--shadow-border)]">
          <div className="mb-3 flex flex-col gap-2">
            <button
              type="button"
              className="min-h-11 rounded-md bg-primary px-3 font-semibold text-primary-fg"
              onClick={async () => {
                const t = fromTemplate();
                setCurrentId("");
                setDraft(t);
                setJson(JSON.stringify(t, null, 2));
                setStatus("New from template \u2014 set id and save");
                setTab("fields");
              }}
            >
              New from template
            </button>
            <label className="text-sm text-muted">
              Category
              <select
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-2 text-fg"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">All</option>
                {cats.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="max-h-[60vh] space-y-1 overflow-auto">
            {visible.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => loadStory(s)}
                className={cn(
                  "block w-full rounded-md px-3 py-2 text-left text-sm",
                  currentId === s.id ? "bg-raised" : "hover:bg-raised/60",
                  s.published === false && "opacity-50",
                )}
              >
                <span className="block font-semibold">{displayTitle(s)}</span>
                <span className="text-xs text-muted">
                  {s.category || s.config.category} \u00b7 {s.visibility ?? (s.published === false ? "private" : "public")}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-lg bg-surface p-3 shadow-[var(--shadow-border)]">
          <div className="mb-3 flex flex-wrap gap-2">
            {(["fields", "json", "import"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={cn(
                  "min-h-11 rounded-md px-3 text-sm capitalize",
                  tab === t ? "bg-primary text-primary-fg" : "bg-raised text-fg",
                )}
                onClick={() => {
                  if (t === "json" && draft) setJson(JSON.stringify(draft, null, 2));
                  setTab(t);
                }}
              >
                {t === "fields" ? "Fields" : t === "json" ? "JSON" : "Import"}
              </button>
            ))}
          </div>
          <div className="mb-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-md bg-primary px-4 font-semibold text-primary-fg"
              onClick={async () => {
                try {
                  const story = parseEditor();
                  const errors = validateStory(story).filter((i) => i.level === "error");
                  if (errors.length) {
                    setStatus(errors[0].message);
                    return;
                  }
                  await save(story);
                  setCurrentId(story.id);
                  setDraft(story);
                  setJson(JSON.stringify(story, null, 2));
                  setStatus("Saved " + story.id);
                } catch (e) {
                  setStatus(e instanceof Error ? e.message : "Invalid JSON");
                }
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="min-h-11 rounded-md bg-raised px-4 text-fg"
              onClick={async () => {
                if (!currentId) return;
                try {
                  const share = await createStoryShare({ data: { storyId: currentId, expiresInDays: 30 } });
                  const url = `${window.location.origin}/share/${share.token}`;
                  await navigator.clipboard.writeText(url);
                  setStatus("Private share link copied — expires in 30 days");
                  setShares(await listStoryShares({ data: { storyId: currentId } }));
                } catch (e) {
                  setStatus(e instanceof Error ? e.message : "Could not create share link");
                }
              }}
            >
              Copy private share link
            </button>
            <button
              type="button"
              className="min-h-11 rounded-md bg-danger px-4 text-fg"
              onClick={async () => {
                if (!currentId) return;
                if (!confirm("Delete " + currentId + " from the catalog? Revision history will be retained.")) return;
                await remove(currentId);
                setCurrentId("");
                setDraft(null);
                setJson("");
                setStatus("Removed");
              }}
            >
              Delete
            </button>
          </div>
          {shares.length ? (
            <div className="mb-3 rounded-md bg-raised p-3 text-sm">
              <p className="mb-2 font-semibold">Active private links</p>
              {shares.map((share) => (
                <div key={share.id} className="flex min-h-11 items-center justify-between gap-3 border-t border-border first:border-0">
                  <span className="text-muted">
                    {share.label || "Private link"}{share.expires_at ? ` · expires ${new Date(share.expires_at).toLocaleDateString()}` : ""}
                  </span>
                  <button
                    type="button"
                    className="text-danger hover:underline"
                    onClick={async () => {
                      await revokeStoryShare({ data: { shareId: share.id } });
                      setShares((current) => current.filter((item) => item.id !== share.id));
                      setStatus("Share link revoked");
                    }}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {status ? <p className="mb-2 text-sm text-muted">{status}</p> : null}

          {tab === "fields" ? (
            draft ? (
              <StoryForm story={draft} onChange={applyDraft} />
            ) : (
              <p className="text-sm text-muted">Pick a title or start from the template.</p>
            )
          ) : null}

          {tab === "json" ? (
            <label className="block text-sm text-muted">
              Story JSON
              <textarea
                className="mt-1 min-h-[28rem] w-full rounded-md border border-border bg-bg p-3 font-mono text-xs text-fg"
                value={json}
                onChange={(e) => {
                  setJson(e.target.value);
                  try {
                    setDraft(JSON.parse(e.target.value) as Story);
                  } catch {
                    /* keep typing */
                  }
                }}
                spellCheck={false}
              />
            </label>
          ) : null}

          {tab === "import" ? (
            <div>
              <p className="mb-2 text-sm text-muted">
                  Upload JSON, text, or Markdown. Valid StoryCast JSON can be imported directly; prose and legacy
                  formats can be rewritten into a reviewable v2 cast draft by the local model.
              </p>
              <div className="mb-3 flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,text/plain,text/markdown,.json,.txt,.md,.markdown"
                  multiple
                  className="hidden"
                  onChange={(e) => void onJsonFiles(e.target.files)}
                />
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-raised px-4 text-sm text-fg"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="size-4" />
                  Upload story file
                </button>
              </div>
              <textarea
                className="min-h-64 w-full rounded-md border border-border bg-bg p-3 font-mono text-xs text-fg"
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
                spellCheck={false}
                placeholder='```json\n[{ "id": "example", ... }]\n```'
              />
              <button
                type="button"
                className="mt-2 min-h-11 rounded-md bg-primary px-4 font-semibold text-primary-fg"
                onClick={() => void applyImport(bulk)}
              >
                Validate and import
              </button>
              <div className="mt-4 rounded-md bg-raised p-3">
                <p className="font-display text-sm text-fg">Rewrite into StoryCast v2</p>
                <p className="mt-1 text-xs text-muted">Local model: {rewriteModel || "checking…"}</p>
                <label className="mt-2 block text-sm text-muted">
                  Optional editor direction
                  <input
                    className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg"
                    value={rewriteInstruction}
                    onChange={(event) => setRewriteInstruction(event.target.value)}
                    placeholder="Preserve every scene; make dialogue more natural."
                  />
                </label>
                <label className="mt-2 block text-sm text-muted">
                  Rewrite presentation
                  <select className="mt-1 min-h-11 w-full rounded-md border border-border bg-bg px-3 text-fg" value={rewritePresentation} onChange={(event) => setRewritePresentation(event.target.value === "anime" ? "anime" : "book")}>
                    <option value="book">Regular book</option>
                    <option value="anime">Anime-inspired episode</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={rewriting || !bulk.trim() || rewriteModel === "not configured"}
                  className="mt-2 min-h-11 w-full rounded-md bg-primary px-4 font-semibold text-primary-fg disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={async () => {
                    setRewriting(true);
                    setStatus("Analyzing and rewriting story…");
                    try {
                      const result = await rewriteStoryAsV2({
                        data: { content: bulk, instruction: rewriteInstruction, presentation: rewritePresentation },
                      });
                      if (!result.ok) {
                        setStatus(result.error);
                        return;
                      }
                      setCurrentId("");
                      setDraft(result.story);
                      setJson(JSON.stringify(result.story, null, 2));
                      setStatus(`Rewritten as v2 with ${result.model} — review before saving`);
                      setTab("fields");
                    } catch (error) {
                      setStatus(error instanceof Error ? error.message : "Rewrite failed");
                    } finally {
                      setRewriting(false);
                    }
                  }}
                >
                  {rewriting ? "Rewriting…" : "Analyze and rewrite as v2"}
                </button>
              </div>
              {report ? (
                <div className="mt-3 space-y-2 text-sm">
                  {report.imported.length ? (
                    <p className="text-muted">Saved: {report.imported.join(", ")}</p>
                  ) : null}
                  {report.skipped.length ? (
                    <ul className="rounded-md bg-raised p-3">
                      {report.skipped.map((row) => (
                        <li key={row.id} className="text-danger">
                          {row.id}: {row.issues.join("; ")}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside className="rounded-lg bg-surface p-3 shadow-[var(--shadow-border)]">
          <p className="font-display text-lg">Draft helper</p>
          <p className="mb-2 text-sm text-muted">Describe a story. If AI is available, a draft JSON comes back.</p>
          <pre className="mb-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-md bg-bg p-2 text-xs text-muted">
            {log}
          </pre>
          <textarea
            className="min-h-24 w-full rounded-md border border-border bg-bg p-2 text-sm text-fg"
            placeholder="Two coworkers on night shift in a warehouse. Keep it workplace, not romantic."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-md bg-primary px-3 font-semibold text-primary-fg"
              onClick={async () => {
                const content = prompt.trim();
                if (!content) return;
                setLog((l) => l + "\nYou: " + content);
                const data = await askGrok({ data: { prompt: content } });
                if (!data.ok) {
                  setLog((l) => l + "\n(" + data.error + ")\nPaste JSON into Import if you draft elsewhere.");
                  return;
                }
                setLastGrok(data.text);
                setLog((l) => l + "\nGrok: " + data.text);
              }}
            >
              Ask Grok
            </button>
            <button
              type="button"
              className="min-h-11 rounded-md bg-raised px-3 text-fg"
              onClick={() => {
                const m = lastGrok.match(/\{[\s\S]*\}/);
                if (!m) {
                  setStatus("No JSON in last reply");
                  return;
                }
                try {
                  const obj = JSON.parse(m[0]) as Story;
                  setCurrentId("");
                  setDraft(obj);
                  setJson(JSON.stringify(obj, null, 2));
                  setStatus("Loaded draft \u2014 edit id and save");
                  setTab("fields");
                } catch {
                  setStatus("JSON in reply did not parse");
                }
              }}
            >
              Use JSON in reply
            </button>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
