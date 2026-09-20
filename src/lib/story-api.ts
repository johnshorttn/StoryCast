import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import {
  effectiveEntitlements,
  entitlementLimitReached,
  normalizeTier,
  type AccountTier,
} from "./account-tiers";
import { assertAdminApiAccess } from "./platform-admin";
import type { Story } from "./story-types";
import { normalizeStory, validateStory } from "./story-validate";
import { storyV2ToV3 } from "./story-v3";

type StoryRow = { payload: Story | string };
type TierRow = { tier: string };

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

async function accountTier(userId: string): Promise<AccountTier> {
  const sql = await database();
  await sql`insert into user_tiers (user_id) values (${userId}) on conflict (user_id) do nothing`;
  const rows = await sql<TierRow>`select tier from user_tiers where user_id = ${userId} and status = 'active'
    and (current_period_end is null or current_period_end > now())`;
  return normalizeTier(rows[0]?.tier);
}

async function storyActor() {
  const { currentPlatformAccess } = await import("./platform-roles.server");
  const access = await currentPlatformAccess();
  const tier = await accountTier(access.user.id);
  return { ...access, tier, entitlements: effectiveEntitlements(access.role, tier) };
}

function shareHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const getAccountTier = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await storyActor();
  return {
    tier: actor.tier,
    role: actor.role,
    entitlements: actor.entitlements,
  };
});

export const listPublishedStories = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await database();
  const rows = await sql<StoryRow>`select payload from stories where visibility = 'public' order by updated_at desc`;
  return rows.map(storyFromRow).filter((story): story is Story => story !== null);
});

export const listManagedStories = createServerFn({ method: "GET" }).handler(async () => {
  const ownerId = await authenticatedUser();
  const sql = await database();
  const rows = await sql<StoryRow>`select payload from stories where owner_id = ${ownerId} order by updated_at desc`;
  return rows.map(storyFromRow).filter((story): story is Story => story !== null);
});

export const saveManagedStory = createServerFn({ method: "POST" })
  .validator((input: { story: Story }) => input)
  .handler(async ({ data }) => {
    const actor = await storyActor();
    const ownerId = actor.user.id;
    const story = normalizeStory(data.story);
    if (!story) throw new Error("Story data is invalid");
    const errors = validateStory(story).filter((issue) => issue.level === "error");
    if (errors.length) throw new Error(errors.map((issue) => issue.message).join("; "));
    const sql = await database();
    const existing = await sql<{ owner_id: string }>`select owner_id from stories where id = ${story.id}`;
    if (existing[0] && existing[0].owner_id !== ownerId) throw new Error("That story ID is already in use");
    if (!existing[0]) {
      const count = await sql<{ count: number }>`select count(*)::int as count from stories where owner_id = ${ownerId}`;
      if (entitlementLimitReached(actor.entitlements.stories, count[0]?.count ?? 0)) {
        throw new Error(`${actor.tier} tier allows ${actor.entitlements.stories} stories`);
      }
    }
    const current = await sql<{ revision: number }>`
      select coalesce(max(revision), 0)::int as revision from story_revisions
      where story_id = ${story.id} and owner_id = ${ownerId}
    `;
    const revision = (current[0]?.revision ?? 0) + 1;
    const visibility = story.visibility ?? (story.published ? "public" : "private");
    const savedStory = { ...story, published: visibility === "public", visibility } as Story;
    const payload = JSON.stringify(storyV2ToV3(savedStory));
    await sql.query(
      `insert into story_revisions (story_id, revision, owner_id, payload)
       values ($1, $2, $3, $4::jsonb)`,
      [story.id, revision, ownerId, payload],
    );
    await sql.query(
      `insert into stories (id, owner_id, payload, published, visibility)
       values ($1, $2, $3::jsonb, $4, $5)
       on conflict (id) do update set payload = excluded.payload, published = excluded.published,
         visibility = excluded.visibility, updated_at = now()
       where stories.owner_id = $2`,
      [story.id, ownerId, payload, visibility === "public", visibility],
    );
    return { story: savedStory, revision };
  });

export const deleteManagedStory = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const ownerId = await authenticatedUser();
    const id = data.id.trim();
    if (!id) throw new Error("Story id is required");
    const sql = await database();
    await sql`delete from stories where id = ${id} and owner_id = ${ownerId}`;
    return { id };
  });

export const createStoryShare = createServerFn({ method: "POST" })
  .validator((input: { storyId: string; label?: string; expiresInDays?: number }) => input)
  .handler(async ({ data }) => {
    const actor = await storyActor();
    const ownerId = actor.user.id;
    const sql = await database();
    const owned = await sql<{ id: string }>`select id from stories where id = ${data.storyId} and owner_id = ${ownerId}`;
    if (!owned[0]) throw new Error("Story not found");
    const count = await sql<{ count: number }>`
      select count(*)::int as count from story_shares
      where story_id = ${data.storyId} and owner_id = ${ownerId} and revoked_at is null
        and (expires_at is null or expires_at > now())
    `;
    if (entitlementLimitReached(actor.entitlements.activeShareLinksPerStory, count[0]?.count ?? 0)) {
      throw new Error(`${actor.tier} tier share-link limit reached`);
    }
    const token = randomBytes(32).toString("base64url");
    const days = Math.max(1, Math.min(365, Number(data.expiresInDays) || 30));
    await sql.query(
      `insert into story_shares (id, story_id, owner_id, token_hash, label, expires_at)
       values ($1, $2, $3, $4, $5, now() + ($6 * interval '1 day'))`,
      [randomUUID(), data.storyId, ownerId, shareHash(token), data.label?.trim() || null, days],
    );
    return { token, storyId: data.storyId, expiresInDays: days };
  });

export const listStoryShares = createServerFn({ method: "GET" })
  .validator((input: { storyId: string }) => input)
  .handler(async ({ data }) => {
    const ownerId = await authenticatedUser();
    const sql = await database();
    return sql<{ id: string; label: string | null; expires_at: string | null; created_at: string }>`
      select id, label, expires_at::text, created_at::text from story_shares
      where story_id = ${data.storyId} and owner_id = ${ownerId} and revoked_at is null
        and (expires_at is null or expires_at > now())
      order by created_at desc
    `;
  });

export const revokeStoryShare = createServerFn({ method: "POST" })
  .validator((input: { shareId: string }) => input)
  .handler(async ({ data }) => {
    const ownerId = await authenticatedUser();
    const sql = await database();
    await sql`update story_shares set revoked_at = now() where id = ${data.shareId} and owner_id = ${ownerId}`;
    return { shareId: data.shareId };
  });

export const loadSharedStory = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const sql = await database();
    const hash = shareHash(data.token.trim());
    const rows = await sql<StoryRow & { share_id: string }>`
      select s.payload, sh.id as share_id from story_shares sh
      join stories s on s.id = sh.story_id and s.owner_id = sh.owner_id
      where sh.token_hash = ${hash} and sh.revoked_at is null
        and (sh.expires_at is null or sh.expires_at > now()) limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    await sql`update story_shares set last_accessed_at = now() where id = ${row.share_id}`;
    return storyFromRow(row);
  });

export const listSiteStories = createServerFn({ method: "GET" }).handler(async () => {
  const { requirePlatformCapability } = await import("./platform-roles.server");
  const access = await requirePlatformCapability("view_moderation_queue");
  assertAdminApiAccess(access.role, "listSiteStories", access.elevatedCapabilities);
  const sql = await database();
  const { hasAuthUserTable } = await import("./auth-tables.server");
  const joinUsers = await hasAuthUserTable(sql);
  return sql.query<{
    id: string;
    owner_id: string;
    owner_name: string | null;
    owner_email: string | null;
    visibility: string;
    published: boolean;
    title: string;
    updated_at: string;
  }>(
    joinUsers
      ? `select s.id, s.owner_id, u.name as owner_name, u.email as owner_email, s.visibility, s.published,
           coalesce(s.payload->'config'->>'title', s.payload->>'title', s.id) as title,
           s.updated_at::text
         from stories s
         left join "user" u on u.id = s.owner_id
         order by s.updated_at desc
         limit 250`
      : `select s.id, s.owner_id, null as owner_name, null as owner_email, s.visibility, s.published,
           coalesce(s.payload->'config'->>'title', s.payload->>'title', s.id) as title,
           s.updated_at::text
         from stories s
         order by s.updated_at desc
         limit 250`,
  );
});

export const moderateSiteStory = createServerFn({ method: "POST" })
  .validator((input: { storyId: string; action: "unpublish" | "unlist" | "delete" }) => input)
  .handler(async ({ data }) => {
    const { requirePlatformCapability } = await import("./platform-roles.server");
    const access = await requirePlatformCapability("moderate_public_content");
    assertAdminApiAccess(access.role, "moderateSiteStory", access.elevatedCapabilities);
    const storyId = data.storyId.trim();
    if (!storyId) throw new Error("Story is required");
    const sql = await database();
    const existing = await sql<{ id: string; owner_id: string }>`select id, owner_id from stories where id = ${storyId}`;
    if (!existing[0]) throw new Error("Story not found");
    if (data.action === "delete") {
      await sql`delete from stories where id = ${storyId}`;
      return { storyId, action: data.action };
    }
    const visibility = data.action === "unlist" ? "unlisted" : "private";
    await sql.query(
      `update stories
       set visibility = $2, published = false, payload = jsonb_set(
         jsonb_set(payload, '{visibility}', to_jsonb($2::text), true),
         '{published}', 'false'::jsonb, true
       ), updated_at = now()
       where id = $1`,
      [storyId, visibility],
    );
    return { storyId, action: data.action, visibility };
  });
