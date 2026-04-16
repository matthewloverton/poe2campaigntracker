import type { BuildGearEntry, SkillGroup, GearSlotKey } from "../../types/buildPlan";

/** Parsed PoB item — before matching against our DB. */
export interface PoBItem {
  id: number;                // <Item id="N">
  rarity: "NORMAL" | "MAGIC" | "RARE" | "UNIQUE";
  name: string;              // item name (first body line for rare/unique)
  baseType: string;          // base type (second body line)
  itemLevel?: number;
  quality?: number;
  implicits: string[];       // lines ending " (implicit)"
  explicits: string[];       // everything else in the mod section
  /**
   * Roll fraction (0.0-1.0) for each explicit mod, aligned by position with
   * `explicits`. Parsed from PoB's `Prefix: {range:X}...` / `Suffix: {range:X}`
   * lines. `undefined` entry means no roll data for that mod.
   */
  explicitRolls: (number | undefined)[];
  raw: string;               // full text for debugging
}

/** Item set: maps slot name → item id. */
export interface PoBItemSet {
  id: number;
  title: string;             // empty string if unnamed
  slots: Record<string, number>; // slot name as written in XML → item id
}

/** Parsed PoB skill / skill group. */
export interface PoBSkill {
  enabled: boolean;
  label: string;             // user-given or skill name
  mainActiveSkill: number;   // 1-based index into gems; 0 means "first"
  gems: PoBGem[];
}

export interface PoBGem {
  skillId: string;           // e.g. "ExplosiveGrenadePlayer" (often *Player suffix in PoB2)
  gemId: string;             // e.g. "Metadata/Items/Gem/SkillGemExplosiveGrenade" — matches our DB id
  nameSpec: string;          // human name, e.g. "Explosive Grenade" — fallback matcher
  enabled: boolean;
  level: number;
  quality: number;
}

export interface PoBSkillSet {
  id: number;
  title: string;
  skills: PoBSkill[];
}

export interface ParsedBuild {
  buildName: string;         // from <Build> or fallback
  items: PoBItem[];
  itemSets: PoBItemSet[];
  activeItemSetId: number;
  skillSets: PoBSkillSet[];
  activeSkillSetId: number;
}

/** A non-fatal issue to surface in the import preview. */
export interface ImportWarning {
  scope: "item" | "gem" | "slot" | "general";
  message: string;
}

/** A phase-shaped payload plus warnings — used by the preview. */
export interface ImportPhase {
  name: string;
  gear: Partial<Record<GearSlotKey, BuildGearEntry>>;
  gems: SkillGroup[];
  warnings: ImportWarning[];
}

export interface ImportResult {
  buildName: string;
  phases: ImportPhase[];
  generalWarnings: ImportWarning[];
}
