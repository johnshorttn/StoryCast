import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_PLATFORM_CAPABILITIES,
  normalizePlatformRole,
  roleCan,
  TEMPORARILY_GRANTABLE_CAPABILITIES,
} from "./platform-roles.ts";
import {
  adminApiDenial,
  ADMIN_API_GATES,
  assertAdminApiAccess,
  canAccessAdminApi,
  defaultAdminPanel,
  isBootstrapOwnerEmail,
  parseOwnerEmails,
  resolveDefaultPlatformRole,
  USER_BLOCKED_ADMIN_APIS,
  visibleAdminPanels,
} from "./platform-admin.ts";
import { effectiveEntitlements, entitlementLimitReached } from "./account-tiers.ts";

test("finance is an owner capability, not a separate role", () => {
  assert.equal(roleCan("owner", "view_finance"), true);
  assert.equal(roleCan("developer", "view_finance"), false);
  assert.equal(roleCan("moderator", "view_finance"), false);
});

test("moderator and developer permissions stay separated", () => {
  assert.equal(roleCan("moderator", "moderate_public_content"), true);
  assert.equal(roleCan("moderator", "manage_integrations"), false);
  assert.equal(roleCan("developer", "manage_integrations"), true);
  assert.equal(roleCan("developer", "moderate_public_content"), false);
  assert.equal(normalizePlatformRole("finance-admin"), "user");
});

test("temporary sudo cannot convert itself into permanent root", () => {
  assert.equal(TEMPORARILY_GRANTABLE_CAPABILITIES.includes("manage_roles"), false);
  assert.equal(TEMPORARILY_GRANTABLE_CAPABILITIES.includes("bypass_account_limits"), false);
  assert.equal(TEMPORARILY_GRANTABLE_CAPABILITIES.includes("view_finance"), true);
});

test("owner has every site-admin capability including unlimited account access", () => {
  for (const capability of ALL_PLATFORM_CAPABILITIES) {
    assert.equal(roleCan("owner", capability), true, `owner missing ${capability}`);
    if (capability !== "manage_own_stories" && capability !== "redeem_gifts") {
      assert.equal(roleCan("user", capability), false, `user should not have ${capability}`);
    }
  }
});

test("regular users cannot pass the same admin API gates as owners", () => {
  for (const api of USER_BLOCKED_ADMIN_APIS) {
    assert.equal(canAccessAdminApi("owner", api), true, `owner blocked from ${api}`);
    assert.equal(canAccessAdminApi("user", api), false, `user can access ${api}`);
    assert.throws(() => assertAdminApiAccess("user", api), { message: adminApiDenial(api) });
    assert.doesNotThrow(() => assertAdminApiAccess("owner", api));
  }
  assert.equal(ADMIN_API_GATES.listPlatformUsers.kind, "permanent_owner");
  assert.equal(ADMIN_API_GATES.getFinancialReport.kind, "capability");
  assert.equal(canAccessAdminApi("developer", "getSystemStatus"), true);
  assert.equal(canAccessAdminApi("developer", "listPlatformUsers"), false);
  assert.equal(canAccessAdminApi("moderator", "listSiteStories"), true);
  assert.equal(canAccessAdminApi("moderator", "setAccountTier"), false);
  assert.equal(canAccessAdminApi("moderator", "setAccountTier", ["manage_billing"]), true);
});

test("bootstrap owner emails and persisted owner default stay separate from regular users", () => {
  const emails = parseOwnerEmails(" John.Short.TN@gmail.com , other@example.com ");
  assert.deepEqual(emails, ["john.short.tn@gmail.com", "other@example.com"]);
  assert.equal(isBootstrapOwnerEmail("JOHN.SHORT.TN@gmail.com", emails), true);
  assert.equal(isBootstrapOwnerEmail("user@example.com", emails), false);
  assert.equal(
    resolveDefaultPlatformRole({ id: "u1", email: "john.short.tn@gmail.com" }, { dbSource: "neon", ownerEmails: emails }),
    "owner",
  );
  assert.equal(
    resolveDefaultPlatformRole({ id: "u2", email: "listener@example.com" }, { dbSource: "neon", ownerEmails: emails }),
    "user",
  );
  assert.equal(
    resolveDefaultPlatformRole({ id: "dev-user", email: "dev@example.com" }, { dbSource: "pglite", ownerEmails: [] }),
    "owner",
  );
  assert.equal(
    resolveDefaultPlatformRole({ id: "dev-user", email: "dev@example.com" }, { dbSource: "neon", ownerEmails: [] }),
    "user",
  );
});

test("owner entitlements are not the free-tier story and share gates", () => {
  const owner = effectiveEntitlements("owner", "free");
  const user = effectiveEntitlements("user", "free");
  assert.equal(owner.unlimited, true);
  assert.equal(owner.stories, null);
  assert.equal(owner.durableAudio, true);
  assert.equal(entitlementLimitReached(owner.stories, 99), false);
  assert.equal(user.unlimited, false);
  assert.equal(user.stories, 3);
  assert.equal(entitlementLimitReached(user.stories, 3), true);
  assert.equal(entitlementLimitReached(user.activeShareLinksPerStory, 2), true);
});

test("the site-admin portal surfaces owner duties and hides them from regular users", () => {
  const ownerPanels = visibleAdminPanels("owner").map((panel) => panel.id);
  assert.deepEqual(ownerPanels, ["overview", "stories", "users", "moderation", "finance", "system", "settings"]);
  assert.deepEqual(visibleAdminPanels("user").map((panel) => panel.id), ["stories"]);
  assert.equal(defaultAdminPanel("owner"), "overview");
  assert.equal(defaultAdminPanel("user"), "stories");
  assert.ok(visibleAdminPanels("moderator").some((panel) => panel.id === "moderation"));
  assert.ok(visibleAdminPanels("developer").some((panel) => panel.id === "system"));
});
