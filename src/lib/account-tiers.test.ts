import assert from "node:assert/strict";
import test from "node:test";
import { effectiveEntitlements, entitlementLimitReached, normalizeTier, TIER_ENTITLEMENTS } from "./account-tiers.ts";

test("unknown accounts safely receive the free tier", () => {
  assert.equal(normalizeTier(undefined), "free");
  assert.equal(normalizeTier("enterprise"), "free");
});

test("higher tiers expand story and sharing limits", () => {
  assert.ok(TIER_ENTITLEMENTS.creator.stories > TIER_ENTITLEMENTS.free.stories);
  assert.ok(TIER_ENTITLEMENTS.studio.activeShareLinksPerStory > TIER_ENTITLEMENTS.creator.activeShareLinksPerStory);
});

test("owners keep durable audio and skip paid-plan quotas even on free billing", () => {
  const owner = effectiveEntitlements("owner", "free");
  const studio = effectiveEntitlements("user", "studio");
  assert.equal(owner.unlimited, true);
  assert.equal(owner.durableAudio, true);
  assert.ok((studio.stories ?? 0) >= 500);
  assert.equal(entitlementLimitReached(studio.stories, 3), false);
  assert.equal(entitlementLimitReached(owner.activeShareLinksPerStory, 10_000), false);
});
