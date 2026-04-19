export interface BaseItem {
  id: string;
  name: string;
  itemClass: string;
  dropLevel: number;
  requirements: {
    level: number;
    strength: number;
    dexterity: number;
    intelligence: number;
  };
  properties: {
    physicalDamageMin?: number;
    physicalDamageMax?: number;
    attackTime?: number;
    criticalStrikeChance?: number;
    range?: number;
    armour?: { min: number; max: number };
    evasion?: { min: number; max: number };
    energyShield?: { min: number; max: number };
  };
  implicits: string[];
  tags: string[];
  iconPath: string;
}

export type ModSource = "normal" | "corrupted" | "desecrated" | "essence";

export interface ItemMod {
  id: string;
  name: string;
  text: string;
  type: string;
  generationType: "prefix" | "suffix" | "corrupted";
  source: ModSource;
  group: string;
  requiredLevel: number;
  stats: Array<{ id: string; min: number; max: number }>;
  spawnWeights: Array<{ tag: string; weight: number }>;
  /** Per-base-label spawn weights from the PoE2 mods sheet, e.g. "HELMET (INT)". */
  baseWeights?: Record<string, number>;
  tags: string[];
}

export interface UniqueItem {
  id: string;
  name: string;
  itemClass: string;
  iconPath: string;
  mods: string[];
}

export interface SkillLevelData {
  costs: Record<string, number>;
  damageMultiplier?: number;
  statText: string[];
  /** Structured stat id → resolved value. Merged from static.stats + per_level sparse overrides by the transform. */
  stats: Record<string, number>;
  /** Per-level attack time in milliseconds. RePoE2 does not emit this today but the field is reserved. */
  attackTime?: number;
}

export interface QualityStat {
  template: string;                    // e.g. "{stat_id}% increased Cooldown Recovery Rate"
  values: Record<string, number>;      // stat_id → value per 1000 quality
}

export interface StatSet {
  name: string;
  levels: Record<string, SkillLevelData>;
  staticStatText: string[];
  qualityStats: QualityStat[];
}

export interface SkillDetail {
  description?: string;
  castTime?: number;        // ms
  cooldown?: number;        // ms
  storedUses?: number;
  attackSpeedMultiplier?: number;  // e.g. -25 means 75% of base
  maxLevel: number;
  levels: Record<string, SkillLevelData>;       // from first stat set (default)
  staticStatText: string[];                      // from first stat set
  qualityStats: QualityStat[];                   // from first stat set
  /** All non-hidden stat sets including the primary; always present when skill has damage data. */
  statSets: StatSet[];
  /** e.g. ["Attack", "Projectile", "Grenade", "Fire"] */
  activeSkillTypes?: string[];
  /** Item classes the skill is usable with. */
  weaponRestrictions?: string[];
}

/** Resolve a quality stat template at a given quality level (0-20) */
/** Resolve a quality stat template at a given quality level (0-20) */
export function resolveQualityStat(qs: QualityStat, quality: number): string {
  let text = qs.template;
  // Match {stat_id} or {stat_id/modifier} patterns
  text = text.replace(/\{([^}]+)\}/g, (_match, inner) => {
    const [statId, modifier] = inner.split("/");
    const valuePer1000 = qs.values[statId];
    if (valuePer1000 == null) return "";
    let value = (valuePer1000 * quality) / 1000;
    if (modifier === "divide_by_ten_1dp_if_required") {
      value = value / 10;
      return value % 1 === 0 ? String(value) : value.toFixed(1);
    }
    return String(Math.round(value));
  });
  return text;
}

export interface GemEntry {
  id: string;
  name: string;
  gemType: "active" | "support" | "spirit";
  color: "r" | "g" | "b" | "w";
  craftingLevel: number;
  craftingTypes: string[];
  tags: string[];
  supportText?: string;
  recommendedSupports: string[];
  requirementWeights: {
    strength: number;
    dexterity: number;
    intelligence: number;
  };
  iconPath: string;
  skillDetail?: SkillDetail;
  /** For support gems: active skill types this support can apply to. */
  allowedActiveSkillTypes?: string[];
  /** For support gems: active skill types explicitly excluded. */
  excludedActiveSkillTypes?: string[];
}

export const ITEM_CLASS_GROUPS: Record<string, string[]> = {
  Weapons: [
    "Wand",
    "One Hand Mace", "Two Hand Mace",
    "Sceptre", "Staff", "Warstaff", "Talisman",
    "Spear", "Bow", "Crossbow",
    "Focus", "TrapTool",
    // Not yet implemented: Claw, Dagger, One/Two Hand Sword, One/Two Hand Axe
  ],
  Armour: [
    "Body Armour", "Helmet", "Gloves", "Boots", "Shield", "Buckler",
  ],
  Jewelry: ["Amulet", "Ring", "Belt"],
  "Off-hand": ["Quiver"],
};

export const ITEM_CLASS_DISPLAY_NAMES: Record<string, string> = {
  Warstaff: "Quarterstaves",
  Talisman: "Talismans",
  TrapTool: "Traps",
  "One Hand Sword": "One Hand Swords",
  "Two Hand Sword": "Two Hand Swords",
  "One Hand Axe": "One Hand Axes",
  "Two Hand Axe": "Two Hand Axes",
  "One Hand Mace": "One Hand Maces",
  "Two Hand Mace": "Two Hand Maces",
  "Body Armour": "Body Armours",
  Boots: "Boots",
  Gloves: "Gloves",
  Focus: "Foci",
  Staff: "Staves",
};

export const GEM_CRAFTING_TYPE_LABELS: Record<string, string> = {
  Bow: "Bow",
  Crossbow: "Crossbow",
  Elemental: "Elemental",
  Mace: "Mace",
  Occult: "Occult",
  Primal: "Primal",
  Quarterstaff: "Quarterstaff",
  Spear: "Spear",
  // Not yet implemented in PoE2:
  // Axe, Dagger, Flail, Sword
};

export const GEM_TYPE_LABELS: Record<string, string> = {
  active: "Skill",
  support: "Support",
  spirit: "Spirit",
};

export const GEM_COLOR_CSS: Record<string, string> = {
  r: "var(--gem-color-str)",
  g: "var(--gem-color-dex)",
  b: "var(--gem-color-int)",
  w: "var(--gem-color-neutral)",
};

/** The crafting level IS the tier in PoE2 (1-14) */
export function gemTier(craftingLevel: number): number {
  return craftingLevel;
}

/** Maps uncut skill/spirit gem tier → character drop level required to obtain it */
const SKILL_TIER_DROP_LEVELS: Record<number, number> = {
  1: 1, 2: 4, 3: 7, 4: 11, 5: 15, 6: 19, 7: 23,
  8: 27, 9: 32, 10: 37, 11: 42, 12: 47, 13: 53, 14: 58,
};

/** Maps uncut support gem tier → character drop level required to obtain it */
const SUPPORT_TIER_DROP_LEVELS: Record<number, number> = {
  1: 4, 2: 16, 3: 33, 4: 45, 5: 55,
};

/** Get the character level at which this gem's uncut version starts dropping */
export function gemUnlockLevel(craftingLevel: number, gemType: "active" | "support" | "spirit"): number {
  if (gemType === "support") {
    return SUPPORT_TIER_DROP_LEVELS[craftingLevel] ?? craftingLevel;
  }
  return SKILL_TIER_DROP_LEVELS[craftingLevel] ?? craftingLevel;
}
