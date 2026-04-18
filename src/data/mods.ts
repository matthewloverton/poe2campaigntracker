import type { ItemMod, BaseItem, ModSource } from "../types/itemDatabase";
import rawMods from "./raw/item_mods.json";

export const allMods: ItemMod[] = rawMods as ItemMod[];

export const modById = new Map(allMods.map((m) => [m.id, m]));

/**
 * Unified lookup that also resolves synthetic essence IDs (essence:slug:tier:cat).
 * Import here (lazy) to avoid a cyclic import at module load time.
 */
export function resolveMod(id: string): ItemMod | undefined {
  const hit = modById.get(id);
  if (hit) return hit;
  if (id.startsWith("essence:")) {
    // Lazy require to dodge a circular import with data/essences.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { essenceModById } = require("./essences") as typeof import("./essences");
    return essenceModById.get(id);
  }
  return undefined;
}

const ARMOUR_ATTR_SUFFIX: Array<[string, string]> = [
  ["str_dex_int_armour", "STR/DEX/INT"],
  ["str_dex_armour", "STR/DEX"],
  ["str_int_armour", "STR/INT"],
  ["dex_int_armour", "DEX/INT"],
  ["str_armour", "STR"],
  ["dex_armour", "DEX"],
  ["int_armour", "INT"],
];

const ITEM_CLASS_TO_SHEET: Record<string, string> = {
  "Body Armour": "BODY ARMOUR",
  "Helmet": "HELMET",
  "Boots": "BOOTS",
  "Gloves": "GLOVES",
  "Shield": "SHIELD",
  "Buckler": "BUCKLER",
  "Amulet": "AMULET",
  "Belt": "BELT",
  "Ring": "RING",
  "Quiver": "QUIVER",
  "Focus": "FOCUS",
  "Bow": "BOW",
  "Crossbow": "CROSSBOW",
  "Spear": "SPEAR",
  "Staff": "STAFF",
  "Warstaff": "WARSTAFF",
  "Wand": "WAND",
  "Sceptre": "SCEPTRE",
  "Talisman": "TALISMAN",
  "One Hand Mace": "ONE HAND MACE",
  "Two Hand Mace": "TWO HAND MACE",
};

/**
 * Map a base item to the sheet's BASE label so we can look up its per-mod
 * weights. Returns null if the item class isn't represented in the sheet.
 */
export function sheetBaseKey(item: BaseItem): string | null {
  const cls = ITEM_CLASS_TO_SHEET[item.itemClass];
  if (!cls) return null;

  const needsAttr = cls === "BODY ARMOUR" || cls === "HELMET" || cls === "BOOTS" || cls === "GLOVES" || cls === "SHIELD";
  if (needsAttr) {
    for (const [tag, suffix] of ARMOUR_ATTR_SUFFIX) {
      if (item.tags.includes(tag)) return `${cls} (${suffix})`;
    }
    return null;
  }
  return cls;
}

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

/**
 * Effective spawn weight of a mod on a specific item (0 if it can't roll).
 * Per-base sheet weights (mod.baseWeights) take precedence for the exact
 * base label; otherwise we fall back to RePoE's tag walk.
 */
export function modWeightOnItem(mod: ItemMod, item: BaseItem): number {
  const baseKey = sheetBaseKey(item);
  if (baseKey && mod.baseWeights && mod.baseWeights[baseKey] != null) {
    return mod.baseWeights[baseKey];
  }
  return resolveSpawnWeight(mod, new Set(item.tags));
}

function modsMatchItem(item: BaseItem): (mod: ItemMod) => boolean {
  const itemTags = new Set(item.tags);
  return (mod) => modWeightOnItem(mod, item) > 0 || resolveSpawnWeight(mod, itemTags) > 0;
}

export function getModsForItem(
  item: BaseItem,
  source: ModSource = "normal",
): { prefixes: ItemMod[]; suffixes: ItemMod[]; corrupted: ItemMod[] } {
  const matches = modsMatchItem(item);
  const scoped = allMods.filter((m) => m.source === source && matches(m));
  return {
    prefixes: scoped.filter((m) => m.generationType === "prefix"),
    suffixes: scoped.filter((m) => m.generationType === "suffix"),
    corrupted: scoped.filter((m) => m.generationType === "corrupted"),
  };
}

export function getModsForItemAtLevel(
  item: BaseItem,
  ilvl: number,
  source: ModSource = "normal",
): { prefixes: ItemMod[]; suffixes: ItemMod[] } {
  const matches = modsMatchItem(item);
  return {
    prefixes: allMods.filter(
      (m) => m.source === source && m.generationType === "prefix" && m.requiredLevel <= ilvl && matches(m)
    ),
    suffixes: allMods.filter(
      (m) => m.source === source && m.generationType === "suffix" && m.requiredLevel <= ilvl && matches(m)
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

/**
 * Label a mod's tier within its type (T1 = highest tier by required level).
 * When an item is provided, only mods that can actually roll on that item
 * (same source, same gen-type, passes the item's spawn-weight filter) count
 * toward the tier count — this keeps shared types like LocalColdDamage, which
 * covers both one-hand and two-hand variants, from inflating the tier count.
 */
export function modTierLabel(mod: ItemMod, item?: BaseItem): string {
  const itemTags = item ? new Set(item.tags) : null;
  const baseKey = item ? sheetBaseKey(item) : null;
  const eligible = (m: ItemMod) => {
    if (m.type !== mod.type) return false;
    if (m.source !== mod.source) return false;
    if (m.generationType !== mod.generationType) return false;
    if (!item) return true;
    if (baseKey && m.baseWeights && m.baseWeights[baseKey] != null) {
      return m.baseWeights[baseKey] > 0;
    }
    return resolveSpawnWeight(m, itemTags!) > 0;
  };
  const sametype = allMods
    .filter(eligible)
    .sort((a, b) => a.requiredLevel - b.requiredLevel);
  const idx = sametype.findIndex((m) => m.id === mod.id);
  if (idx < 0) return "";
  return `T${sametype.length - idx}`;
}

/**
 * Compute the aggregate roll quality of a mod at a given percentile: sum of
 * (rolled - min) over all stats / sum of (max - min). Used to show things
 * like "75% (3/4)" where 3 = total range-points achieved, 4 = total possible.
 */
export function computeRollStats(mod: ItemMod, roll: number): { percent: number; numerator: number; denominator: number } {
  let num = 0;
  let den = 0;
  for (const s of mod.stats) {
    const range = s.max - s.min;
    if (range <= 0) continue;
    const value = s.min + (range * roll) / 100;
    num += value - s.min;
    den += range;
  }
  if (den <= 0) return { percent: 0, numerator: 0, denominator: 0 };
  return {
    percent: Math.round((num / den) * 100),
    numerator: Math.round(num),
    denominator: Math.round(den),
  };
}

/**
 * Replace each `(min-max)` range in a mod's text with `rolled(min-max)`
 * so callers can show the rolled value alongside the full possible range,
 * e.g. `104(101-110)% increased …`. Handles both integer and decimal
 * ranges (e.g. `+(3.11-3.8)% to Critical Hit Chance`).
 */
export function formatRolledWithRange(mod: ItemMod, roll: number): string {
  return cleanModText(mod.text).replace(/\((-?\d+(?:\.\d+)?)[–—-](-?\d+(?:\.\d+)?)\)/g, (_m, a, b) => {
    const min = Number(a);
    const max = Number(b);
    const rolled = min + (max - min) * roll / 100;
    const isFrac = !Number.isInteger(min) || !Number.isInteger(max);
    const fmt = (n: number) => isFrac ? n.toFixed(2).replace(/\.?0+$/, "") : String(Math.round(n));
    return `${fmt(rolled)}(${fmt(min)}-${fmt(max)})`;
  });
}

export function searchMods(query: string, generationType?: "prefix" | "suffix" | "corrupted"): ItemMod[] {
  const q = query.toLowerCase();
  return allMods.filter((m) => {
    if (generationType && m.generationType !== generationType) return false;
    return m.text.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
  });
}
