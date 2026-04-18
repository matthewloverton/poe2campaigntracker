import type { BaseItem, ItemMod } from "../types/itemDatabase";
import rawEssences from "./raw/essences.json";
import { allMods, cleanModText } from "./mods";

export type EssenceTier = "lesser" | "normal" | "greater" | "perfect";

export interface EssenceEntry {
  category: string;
  text: string;
}

export interface EssenceTierData {
  page: string;
  name: string;
  description: string;
  entries: EssenceEntry[];
  iconPath: string | null;
}

export interface EssenceData {
  slug: string;
  name: string;
  tiers: Partial<Record<EssenceTier, EssenceTierData>>;
}

export const allEssences = rawEssences as Record<string, EssenceData>;

/** Ordered so the UI can render Essences grouped by tier availability. */
export const REGULAR_ESSENCE_SLUGS = [
  "abrasion", "alacrity", "battle", "command", "electricity",
  "enhancement", "flames", "grounding", "haste", "ice",
  "insulation", "opulence", "ruin", "seeking", "sorcery", "thawing",
] as const;

export const CORRUPTED_ESSENCE_SLUGS = [
  "delirium", "horror", "hysteria", "insanity", "abyss",
] as const;

/**
 * Does a base item match the wiki's essence-category label?
 * Checks from most specific to most general so nested categories still
 * resolve correctly when multiple entries in the same tier could apply.
 */
export function itemMatchesEssenceCategory(item: BaseItem, category: string): boolean {
  const cls = item.itemClass;
  const c = category.trim();

  // Exact itemClass hits
  if (c === cls) return true;

  // Jewellery synonyms
  if (c === "Jewellery") return cls === "Amulet" || cls === "Ring" || cls === "Belt";

  // Shield includes buckler in PoE2 terminology for essence purposes
  if (c === "Shield") return cls === "Shield" || cls === "Buckler";

  // Armour umbrella
  if (c === "Armour") {
    return cls === "Body Armour" || cls === "Helmet" || cls === "Gloves" || cls === "Boots"
        || cls === "Shield" || cls === "Buckler";
  }

  // Staves (caster). PoE2 "Staff" is caster; "Warstaff" is martial.
  if (c === "Staff") return cls === "Staff";

  // Weapon buckets
  const ONE_HAND_MELEE = [
    "Claw", "Dagger", "Flail", "One Hand Axe", "One Hand Mace", "One Hand Sword", "Sceptre", "Spear",
  ];
  const TWO_HAND_MELEE = [
    "Two Hand Axe", "Two Hand Mace", "Two Hand Sword", "Warstaff", "Talisman",
  ];
  const ALL_MELEE = [...ONE_HAND_MELEE, ...TWO_HAND_MELEE];
  const RANGED = ["Bow", "Crossbow"];
  const MARTIAL = [...ALL_MELEE, ...RANGED];

  if (c === "One Handed Melee Weapon or Bow") return ONE_HAND_MELEE.includes(cls) || cls === "Bow";
  if (c === "Two Handed Melee Weapon or Crossbow") return TWO_HAND_MELEE.includes(cls) || cls === "Crossbow";
  if (c === "Melee Weapon") return ALL_MELEE.includes(cls);
  if (c === "Martial Weapon") return MARTIAL.includes(cls);
  if (c === "Bow or Crossbow") return cls === "Bow" || cls === "Crossbow";
  if (c === "Focus or Wand") return cls === "Focus" || cls === "Wand";
  if (c === "Gloves or Boots") return cls === "Gloves" || cls === "Boots";

  // Comma-or compound categories (e.g. "Boots, Gloves, Helmet or Jewellery")
  // Strip any "or" and split on comma/"or".
  if (/[,]|\bor\b/.test(c)) {
    const parts = c
      .split(/,|\bor\b/g)
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.some((p) => itemMatchesEssenceCategory(item, p));
  }

  // "Equipment" umbrella = anything equippable (everything with itemClass above)
  if (c === "Equipment") return true;

  return false;
}

/**
 * Pick the most specific essence entry whose category matches the given item.
 * "Most specific" = the shortest matching category label (e.g. prefer "Boots"
 * over "Boots, Gloves, Helmet or Jewellery").
 */
export function resolveEssenceEntryForItem(
  slug: string,
  tier: EssenceTier,
  item: BaseItem,
): EssenceEntry | null {
  const ess = allEssences[slug];
  if (!ess) return null;
  const tierData = ess.tiers[tier];
  if (!tierData) return null;
  const matches = tierData.entries.filter((e) => itemMatchesEssenceCategory(item, e.category));
  if (matches.length === 0) return null;
  matches.sort((a, b) => a.category.length - b.category.length);
  return matches[0];
}

/**
 * Template a mod's text down to a shape-only string by replacing every
 * numeric token and range with `#`, so identical mod templates (one real,
 * one essence-synthesised) compare equal.
 */
function templateText(text: string): string {
  return cleanModText(text)
    .replace(/\((?:-?\d+(?:\.\d+)?)[–—-](?:-?\d+(?:\.\d+)?)\)/g, "#")
    .replace(/[+-]?\d+(?:\.\d+)?%?/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Lazy lookup: text template → first matching normal-source mod's generation type. */
let templateToGenCache: Map<string, "prefix" | "suffix"> | null = null;
function templateToGen(): Map<string, "prefix" | "suffix"> {
  if (templateToGenCache) return templateToGenCache;
  const map = new Map<string, "prefix" | "suffix">();
  for (const m of allMods) {
    if (m.source !== "normal") continue;
    if (m.generationType !== "prefix" && m.generationType !== "suffix") continue;
    const key = templateText(m.text);
    if (!map.has(key)) map.set(key, m.generationType);
  }
  templateToGenCache = map;
  return map;
}

/** Heuristic fallback for mods we can't pattern-match to the existing pool. */
function heuristicGen(text: string): "prefix" | "suffix" {
  // Suffixes are typically: resistances, accuracy, *% reduced ... found,
  // attack/cast speed, life regen, thorns etc. Prefixes are everything else.
  const s = text.toLowerCase();
  if (/\bto .* resistance\b/.test(s)) return "suffix";
  if (/\bincreased rarity\b/.test(s)) return "suffix";
  if (/\battack speed\b/.test(s) || /\bcast speed\b/.test(s)) return "suffix";
  if (/\bto accuracy rating\b/.test(s)) return "suffix";
  if (/\blife regeneration per second\b/.test(s)) return "suffix";
  if (/\bincreased critical\b/.test(s)) return "suffix";
  if (/\bstun threshold\b/.test(s)) return "suffix";
  return "prefix";
}

export function essenceGenType(text: string): "prefix" | "suffix" {
  const hit = templateToGen().get(templateText(text));
  if (hit) return hit;
  return heuristicGen(text);
}

function categorySlug(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const ESSENCE_TIER_ORDER: Record<EssenceTier, number> = {
  lesser: 1,
  normal: 2,
  greater: 3,
  perfect: 4,
};

const TIER_NAME: Record<EssenceTier, string> = {
  lesser: "Lesser",
  normal: "",
  greater: "Greater",
  perfect: "Perfect",
};

/** Build a synthetic ItemMod for one (essence, tier, category) entry. */
function buildEssenceMod(slug: string, tier: EssenceTier, entry: EssenceEntry): ItemMod {
  const ess = allEssences[slug];
  // Grouping: `type` is keyed by essence family only (no category), so
  // essences that change their category bucket across tiers (e.g. Battle,
  // where Greater widens to "Martial Weapon, Gloves or Quiver") still
  // collapse into a single group in the planner.
  return {
    id: `essence:${slug}:${tier}:${categorySlug(entry.category)}`,
    name: TIER_NAME[tier] ? `${TIER_NAME[tier]} ${ess.name}` : ess.name,
    text: entry.text,
    type: `Essence_${slug}`,
    generationType: essenceGenType(entry.text),
    source: "essence",
    group: `Essence_${slug}`,
    requiredLevel: ESSENCE_TIER_ORDER[tier],
    stats: parseEssenceStats(entry.text),
    spawnWeights: [{ tag: "default", weight: 1 }],
    tags: ["essence"],
  };
}

/** Parse an essence mod's ID back into its slug + tier + category. */
export function parseEssenceModId(id: string): { slug: string; tier: EssenceTier; category: string } | null {
  const parts = id.split(":");
  if (parts.length !== 4 || parts[0] !== "essence") return null;
  return { slug: parts[1], tier: parts[2] as EssenceTier, category: parts[3] };
}

/**
 * All essence mod variants indexed by their synthetic ID so they can be
 * looked up uniformly alongside real mods via resolveMod().
 */
export const essenceModById: Map<string, ItemMod> = (() => {
  const map = new Map<string, ItemMod>();
  for (const slug of Object.keys(allEssences)) {
    const ess = allEssences[slug];
    for (const [tierKey, tier] of Object.entries(ess.tiers) as Array<[EssenceTier, EssenceTierData]>) {
      if (!tier) continue;
      for (const entry of tier.entries) {
        const mod = buildEssenceMod(slug, tierKey, entry);
        if (!map.has(mod.id)) map.set(mod.id, mod);
      }
    }
  }
  return map;
})();

/**
 * Essence mods applicable to a given item, for display in the planner's
 * Essence tab. Uses the most-specific category match per tier.
 */
export function essenceModsForItem(item: BaseItem): ItemMod[] {
  const out: ItemMod[] = [];
  for (const slug of Object.keys(allEssences)) {
    const ess = allEssences[slug];
    for (const [tierKey, tier] of Object.entries(ess.tiers) as Array<[EssenceTier, EssenceTierData]>) {
      if (!tier) continue;
      const entry = resolveEssenceEntryForItem(slug, tierKey, item);
      if (!entry) continue;
      const id = `essence:${slug}:${tierKey}:${categorySlug(entry.category)}`;
      const mod = essenceModById.get(id);
      if (mod) out.push(mod);
    }
  }
  return out;
}

/** Resolve an essence forced-mod for this (essence, tier, item), as an ItemMod. */
export function resolveEssenceModForItem(slug: string, tier: EssenceTier, item: BaseItem): ItemMod | null {
  const entry = resolveEssenceEntryForItem(slug, tier, item);
  if (!entry) return null;
  const id = `essence:${slug}:${tier}:${categorySlug(entry.category)}`;
  return essenceModById.get(id) ?? null;
}

/**
 * Best-effort: extract `{min, max}` stat entries from an essence mod text by
 * pulling out each `(min-max)` range and a fixed-value fallback. The stat IDs
 * are synthetic (`essence_stat_0`, `essence_stat_1`, …) since essence mods
 * don't map 1:1 to RePoE stat identifiers.
 */
function parseEssenceStats(text: string): Array<{ id: string; min: number; max: number }> {
  const stats: Array<{ id: string; min: number; max: number }> = [];
  let i = 0;
  const re = /\((-?\d+(?:\.\d+)?)[–—-](-?\d+(?:\.\d+)?)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    stats.push({ id: `essence_stat_${i++}`, min: Number(m[1]), max: Number(m[2]) });
  }
  return stats;
}
