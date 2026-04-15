import type { ItemMod, BaseItem } from "../types/itemDatabase";
import rawMods from "./raw/item_mods.json";

export const allMods: ItemMod[] = rawMods as ItemMod[];

/** Strip RePoE stat markup like [InternalName|Display Text] → Display Text */
export function cleanModText(text: string): string {
  return text.replace(/\[([^|\]]*)\|([^\]]*)\]/g, "$2").replace(/\[([^\]]*)\]/g, "$1");
}

export interface ModGroup {
  type: string;
  label: string;
  tiers: ItemMod[];
}

/**
 * PoE spawn weight resolution: walk the mod's spawnWeights in order,
 * find the first entry whose tag exists in the item's tag set.
 * That entry's weight determines if the mod can appear (weight > 0).
 */
function resolveSpawnWeight(mod: ItemMod, itemTags: Set<string>): number {
  for (const { tag, weight } of mod.spawnWeights) {
    if (itemTags.has(tag)) return weight;
  }
  return 0;
}

function modsMatchItem(item: BaseItem): (mod: ItemMod) => boolean {
  const itemTags = new Set(item.tags);
  return (mod) => resolveSpawnWeight(mod, itemTags) > 0;
}

export function getModsForItem(item: BaseItem): { prefixes: ItemMod[]; suffixes: ItemMod[] } {
  const matches = modsMatchItem(item);
  return {
    prefixes: allMods.filter((m) => m.generationType === "prefix" && matches(m)),
    suffixes: allMods.filter((m) => m.generationType === "suffix" && matches(m)),
  };
}

export function getModsForItemAtLevel(
  item: BaseItem,
  ilvl: number
): { prefixes: ItemMod[]; suffixes: ItemMod[] } {
  const matches = modsMatchItem(item);
  return {
    prefixes: allMods.filter(
      (m) => m.generationType === "prefix" && m.requiredLevel <= ilvl && matches(m)
    ),
    suffixes: allMods.filter(
      (m) => m.generationType === "suffix" && m.requiredLevel <= ilvl && matches(m)
    ),
  };
}

export function groupModsByType(mods: ItemMod[]): ModGroup[] {
  const map = new Map<string, ItemMod[]>();
  for (const mod of mods) {
    const list = map.get(mod.type) ?? [];
    list.push(mod);
    map.set(mod.type, list);
  }

  const groups: ModGroup[] = [];
  for (const [type, tiers] of map) {
    tiers.sort((a, b) => a.requiredLevel - b.requiredLevel);
    const label = cleanModText(tiers[0].text).replace(/\([\d-]+\)/g, "#").replace(/\+?[\d-]+/g, "#").trim();
    groups.push({ type, label, tiers });
  }
  return groups.sort((a, b) => a.type.localeCompare(b.type));
}

export function searchMods(query: string, generationType?: "prefix" | "suffix"): ItemMod[] {
  const q = query.toLowerCase();
  return allMods.filter((m) => {
    if (generationType && m.generationType !== generationType) return false;
    return m.text.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
  });
}
