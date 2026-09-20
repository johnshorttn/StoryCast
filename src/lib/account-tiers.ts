export type AccountTier = "free" | "creator" | "studio";

export type TierEntitlements = {
  stories: number;
  activeShareLinksPerStory: number;
  durableAudio: boolean;
  privateStories: boolean;
};

export const TIER_ENTITLEMENTS: Record<AccountTier, TierEntitlements> = {
  free: { stories: 3, activeShareLinksPerStory: 2, durableAudio: false, privateStories: true },
  creator: { stories: 50, activeShareLinksPerStory: 20, durableAudio: true, privateStories: true },
  studio: { stories: 500, activeShareLinksPerStory: 100, durableAudio: true, privateStories: true },
};

export function normalizeTier(value: unknown): AccountTier {
  return value === "creator" || value === "studio" ? value : "free";
}
