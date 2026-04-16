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
  skillId: string;           // e.g. "LightningArrow", "SupportMartialTempo"
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
