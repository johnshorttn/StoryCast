import type { PlatformRole } from "./platform-roles.ts";

export type AccountTier = "free" | "creator" | "studio";

export type TierEntitlements = {
  stories: number;
  activeShareLinksPerStory: number;
  durableAudio: boolean;
  privateStories: boolean;
};

/** JSON-safe entitlements. `null` means unlimited (owners / root admins). */
export type EffectiveEntitlements = {
  stories: number | null;
  activeShareLinksPerStory: number | null;
  durableAudio: boolean;
  privateStories: boolean;
  unlimited: boolean;
};

export const TIER_ENTITLEMENTS: Record<AccountTier, TierEntitlements> = {
  free: { stories: 3, activeShareLinksPerStory: 2, durableAudio: false, privateStories: true },
  creator: { stories: 50, activeShareLinksPerStory: 20, durableAudio: true, privateStories: true },
  studio: { stories: 500, activeShareLinksPerStory: 100, durableAudio: true, privateStories: true },
};

export const OWNER_ENTITLEMENTS: EffectiveEntitlements = {
  stories: null,
  activeShareLinksPerStory: null,
  durableAudio: true,
  privateStories: true,
  unlimited: true,
};

export function normalizeTier(value: unknown): AccountTier {
  return value === "creator" || value === "studio" ? value : "free";
}

export function effectiveEntitlements(role: PlatformRole, tier: AccountTier): EffectiveEntitlements {
  if (role === "owner") return OWNER_ENTITLEMENTS;
  const base = TIER_ENTITLEMENTS[tier];
  return { ...base, unlimited: false };
}

export function entitlementLimitReached(limit: number | null, used: number) {
  return limit !== null && used >= limit;
}
