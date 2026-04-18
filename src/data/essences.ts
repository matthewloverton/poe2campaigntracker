import type { BaseItem, ItemMod } from "../types/itemDatabase";
import rawEssences from "./raw/essences.json";

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
 * Synthesize ItemMod entries for essence forced mods so they can be displayed
 * in the mod table alongside normal/desecrated/corrupted mods. IDs are
 * prefixed with `essence:` to avoid collision with real mod IDs.
 */
export function essenceModsForItem(item: BaseItem): ItemMod[] {
  const out: ItemMod[] = [];
  for (const slug of Object.keys(allEssences)) {
    const ess = allEssences[slug];
    for (const [tierKey, tier] of Object.entries(ess.tiers) as Array<[EssenceTier, EssenceTierData]>) {
      if (!tier) continue;
      const entry = resolveEssenceEntryForItem(slug, tierKey, item);
      if (!entry) continue;
      const stats = parseEssenceStats(entry.text);
      out.push({
        id: `essence:${slug}:${tierKey}`,
        name: tierLabel(tierKey) + " " + ess.name,
        text: entry.text,
        type: `Essence_${slug}`,
        generationType: "prefix", // treat all essence mods as a nominal prefix for layout
        // Use the "desecrated" source bucket for filtering/colour — we'll
        // wire a dedicated "essence" source downstream; for now this keeps
        // them out of the normal pool.
        source: "desecrated",
        group: `Essence_${slug}_${tierKey}`,
        requiredLevel: 0,
        stats,
        spawnWeights: [{ tag: "default", weight: 1 }],
        tags: ["essence"],
      });
    }
  }
  return out;
}

function tierLabel(tier: EssenceTier): string {
  return tier[0].toUpperCase() + tier.slice(1);
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
