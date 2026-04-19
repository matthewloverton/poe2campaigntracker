import type { GemEntry } from "../types/itemDatabase";
import { gemTier } from "../types/itemDatabase";
import rawGems from "./raw/skill_gems.json";

export const allGems: GemEntry[] = rawGems as unknown as GemEntry[];

export const gemById: Map<string, GemEntry> = new Map(
  allGems.map((gem) => [gem.id, gem])
);

const gemByName: Map<string, GemEntry> = new Map(
  allGems.map((gem) => [gem.name.toLowerCase(), gem])
);

export interface GemSearchFilters {
  gemType?: "active" | "support" | "spirit";
  color?: "r" | "g" | "b" | "w";
  craftingType?: string;
  tags?: string[];
}

export function searchGems(query: string, filters?: GemSearchFilters): GemEntry[] {
  const q = query.toLowerCase();
  return allGems.filter((gem) => {
    if (filters?.gemType && gem.gemType !== filters.gemType) return false;
    if (filters?.color && gem.color !== filters.color) return false;
    if (filters?.craftingType && !gem.craftingTypes.includes(filters.craftingType)) return false;
    if (filters?.tags && !filters.tags.every((t) => gem.tags.includes(t))) return false;
    if (!q) return true;
    return gem.name.toLowerCase().includes(q) || gem.tags.some((t) => t.includes(q));
  });
}

export function getRecommendedSupports(gemId: string): GemEntry[] {
  const gem = gemById.get(gemId);
  if (!gem) return [];
  return gem.recommendedSupports
    .map((id) => gemById.get(id))
    .filter((g): g is GemEntry => g != null);
}

export function getGemsByWeaponType(weaponType: string): GemEntry[] {
  return allGems.filter((g) => g.craftingTypes.includes(weaponType));
}

export function getGemsByTier(gems?: GemEntry[]): Map<number, GemEntry[]> {
  const pool = gems ?? allGems;
  const tiers = new Map<number, GemEntry[]>();
  for (const gem of pool) {
    const tier = gemTier(gem.craftingLevel);
    const list = tiers.get(tier) ?? [];
    list.push(gem);
    tiers.set(tier, list);
  }
  return tiers;
}

export function findGemByName(name: string): GemEntry | undefined {
  return gemByName.get(name.toLowerCase());
}
