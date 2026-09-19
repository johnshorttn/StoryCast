import { createServerFn } from "@tanstack/react-start";
import type { Story } from "./story-types";
import { normalizeStory, validateStory } from "./story-validate";
import { storyV2ToV3 } from "./story-v3";

type StoryRow = { payload: Story | string };

function storyFromRow(row: StoryRow): Story | null {
  const raw = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
  return normalizeStory(raw);
}

async function database() {
  const { getSql } = await import("./db");
  return getSql();
}

async function authenticatedUser() {
  const { requireUserId } = await import("./auth/verify.server");
  return requireUserId();
}

export const listPublishedStories = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await database();
  const rows = await sql<StoryRow>`select payload from stories where published = true order by updated_at desc`;
  return rows.map(storyFromRow).filter((story): story is Story => story !== null);
});

export const listManagedStories = createServerFn({ method: "GET" }).handler(async () => {
  await authenticatedUser();
  const sql = await database();
  const rows = await sql<StoryRow>`select payload from stories order by updated_at desc`;
  return rows.map(storyFromRow).filter((story): story is Story => story !== null);
});

export const saveManagedStory = createServerFn({ method: "POST" })
  .validator((input: { story: Story }) => input)
  .handler(async ({ data }) => {
    const ownerId = await authenticatedUser();
    const story = normalizeStory(data.story);
    if (!story) throw new Error("Story data is invalid");
    const errors = validateStory(story).filter((issue) => issue.level === "error");
    if (errors.length) throw new Error(errors.map((issue) => issue.message).join("; "));
    const sql = await database();
    const current = await sql<{ revision: number }>`
      select coalesce(max(revision), 0)::int as revision from story_revisions where story_id = ${story.id}
    `;
    const revision = (current[0]?.revision ?? 0) + 1;
    const canonical = storyV2ToV3(story);
    const payload = JSON.stringify(canonical);
    await sql.query(
        `insert into story_revisions (story_id, revision, owner_id, payload)
         values ($1, $2, $3, $4::jsonb)`,
        [story.id, revision, ownerId, payload],
    );
    await sql.query(
        `insert into stories (id, owner_id, payload, published)
         values ($1, $2, $3::jsonb, $4)
         on conflict (id) do update set owner_id = excluded.owner_id, payload = excluded.payload,
           published = excluded.published, updated_at = now()`,
        [story.id, ownerId, payload, story.published],
    );
    return { story, revision };
  });

export const deleteManagedStory = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    await authenticatedUser();
    const id = data.id.trim();
    if (!id) throw new Error("Story id is required");
    const sql = await database();
    await sql`delete from stories where id = ${id}`;
    return { id };
  });
