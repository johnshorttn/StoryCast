import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTier, TIER_ENTITLEMENTS } from "./account-tiers.ts";

test("unknown accounts safely receive the free tier", () => {
  assert.equal(normalizeTier(undefined), "free");
  assert.equal(normalizeTier("enterprise"), "free");
});

test("higher tiers expand story and sharing limits", () => {
  assert.ok(TIER_ENTITLEMENTS.creator.stories > TIER_ENTITLEMENTS.free.stories);
  assert.ok(TIER_ENTITLEMENTS.studio.activeShareLinksPerStory > TIER_ENTITLEMENTS.creator.activeShareLinksPerStory);
});
