import { createServerFn } from "@tanstack/react-start";
import { assertAdminApiAccess } from "./platform-admin";
import { configuredOwnerEmails } from "./platform-roles.server";

export const getSystemStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { requirePlatformCapability } = await import("./platform-roles.server");
  const access = await requirePlatformCapability("view_system_health");
  assertAdminApiAccess(access.role, "getSystemStatus", access.elevatedCapabilities);
  const { dbSource, getSql } = await import("./db");
  const { authConfigured } = await import("./auth/server");
  const { emailAndPasswordEnabled } = await import("./auth/email-password");
  const sql = await getSql();
  const [users, stories, publicStories, pending] = await Promise.all([
    sql<{ count: number }>`select count(*)::int as count from "user"`,
    sql<{ count: number }>`select count(*)::int as count from stories`,
    sql<{ count: number }>`select count(*)::int as count from stories where visibility = 'public'`,
    sql<{ count: number }>`select count(*)::int as count from privilege_elevation_requests where status = 'pending'`,
  ]);
  return {
    dbSource,
    authConfigured,
    emailPassword: emailAndPasswordEnabled,
    tts: {
      xai: Boolean(process.env.XAI_API_KEY?.trim()),
      kokoro: Boolean(process.env.KOKORO_TTS_URL?.trim()),
      sherpa: Boolean(process.env.SHERPA_TTS_URL?.trim()),
      durableAudio: Boolean(process.env.STORY_AUDIO_ROOT?.trim() && process.env.STORY_AUDIO_PUBLIC_URL?.trim()),
    },
    rewriteModel: Boolean(process.env.STORY_MODEL_BASE_URL?.trim() && process.env.STORY_MODEL_NAME?.trim()),
    ownerEmailsConfigured: configuredOwnerEmails().length,
    counts: {
      users: users[0]?.count ?? 0,
      stories: stories[0]?.count ?? 0,
      publicStories: publicStories[0]?.count ?? 0,
      pendingElevations: pending[0]?.count ?? 0,
    },
  };
});

export const getSiteAdminOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { requirePermanentOwner } = await import("./platform-roles.server");
  const access = await requirePermanentOwner();
  assertAdminApiAccess(access.role, "getSiteAdminOverview");
  const { getSql } = await import("./db");
  const sql = await getSql();
  const [users, owners, stories, publicStories, pending, ledger] = await Promise.all([
    sql<{ count: number }>`select count(*)::int as count from "user"`,
    sql<{ count: number }>`select count(*)::int as count from user_roles where role = 'owner'`,
    sql<{ count: number }>`select count(*)::int as count from stories`,
    sql<{ count: number }>`select count(*)::int as count from stories where visibility = 'public'`,
    sql<{ count: number }>`select count(*)::int as count from privilege_elevation_requests where status = 'pending'`,
    sql<{ count: number; net_minor: number }>`
      select count(*)::int as count, coalesce(sum(net_minor), 0)::bigint as net_minor
      from billing_ledger where occurred_at >= now() - interval '30 days'`,
  ]);
  return {
    users: users[0]?.count ?? 0,
    owners: owners[0]?.count ?? 0,
    stories: stories[0]?.count ?? 0,
    publicStories: publicStories[0]?.count ?? 0,
    pendingElevations: pending[0]?.count ?? 0,
    ledgerEntries30d: ledger[0]?.count ?? 0,
    netMinor30d: ledger[0]?.net_minor ?? 0,
    ownerEmailsConfigured: configuredOwnerEmails().length,
  };
});

export const getSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { requirePermanentOwner } = await import("./platform-roles.server");
  const access = await requirePermanentOwner();
  assertAdminApiAccess(access.role, "getSiteSettings");
  const { authConfigured } = await import("./auth/server");
  const { emailAndPasswordEnabled } = await import("./auth/email-password");
  return {
    ownerEmails: configuredOwnerEmails(),
    authConfigured,
    emailPassword: emailAndPasswordEnabled,
    grokOAuth: Boolean(process.env.GROK_AUTH_CLIENT_ID?.trim() || process.env.GROK_AUTH_CLIENT_SECRET?.trim()),
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL?.trim()),
  };
});
