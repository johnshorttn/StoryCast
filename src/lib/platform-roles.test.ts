import assert from "node:assert/strict";
import test from "node:test";
import { normalizePlatformRole, roleCan, TEMPORARILY_GRANTABLE_CAPABILITIES } from "./platform-roles.ts";

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
  assert.equal(TEMPORARILY_GRANTABLE_CAPABILITIES.includes("view_finance"), true);
});
