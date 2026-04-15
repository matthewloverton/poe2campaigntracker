export interface PhaseTrigger {
  type: "level" | "zone" | "manual";
  level?: number;
  zoneId?: string;
  zoneName?: string;
}

export interface BuildGemEntry {
  id: string;
  gemId?: string;
  name: string;
  category: "skill" | "support" | "spirit";
  priority: number;
  supports: string[];
  iconPath?: string;
  color?: string;
  craftingLevel?: number;
}

export interface BuildGearEntry {
  id: string;
  slot: string;
  baseItemId?: string;
  uniqueId?: string;
  base: string;
  desiredModIds?: string[];
  desiredMods: string[];
  notes: string;
  iconPath?: string;
  priority?: number;
}

export interface GearLayout {
  weapon: BuildGearEntry | null;
  weaponSwap: BuildGearEntry | null;
  offhand: BuildGearEntry | null;
  offhandSwap: BuildGearEntry | null;
  helmet: BuildGearEntry | null;
  bodyArmour: BuildGearEntry | null;
  gloves: BuildGearEntry | null;
  boots: BuildGearEntry | null;
  belt: BuildGearEntry | null;
  amulet: BuildGearEntry | null;
  ring1: BuildGearEntry | null;
  ring2: BuildGearEntry | null;
}

export interface SkillGroup {
  id: string;
  skill: BuildGemEntry;
  supports: (BuildGemEntry | null)[];
  priority: number;
}

export interface BuildPhase {
  id: string;
  name: string;
  order: number;
  trigger: PhaseTrigger;
  gear: GearLayout;
  gems: SkillGroup[];
  regexes: string[];
}

export interface StepReminder {
  id: string;
  pageIndex: number;
  stepIndex: number;
  type: "gem" | "gear" | "craft" | "note";
  text: string;
}

export const EMPTY_GEAR_LAYOUT: GearLayout = {
  weapon: null, weaponSwap: null,
  offhand: null, offhandSwap: null,
  helmet: null, bodyArmour: null,
  gloves: null, boots: null,
  belt: null, amulet: null,
  ring1: null, ring2: null,
};

export const DEFAULT_BUILD_PHASE: BuildPhase = {
  id: "",
  name: "",
  order: 0,
  trigger: { type: "manual" },
  gear: { ...EMPTY_GEAR_LAYOUT },
  gems: [],
  regexes: [],
};

export type GearSlotKey = keyof GearLayout;

export const GEAR_SLOT_LABELS: Record<GearSlotKey, string> = {
  weapon: "Weapon",
  weaponSwap: "Weapon (Set 2)",
  offhand: "Off-hand",
  offhandSwap: "Off-hand (Set 2)",
  helmet: "Helmet",
  bodyArmour: "Body Armour",
  gloves: "Gloves",
  boots: "Boots",
  belt: "Belt",
  amulet: "Amulet",
  ring1: "Ring",
  ring2: "Ring",
};

export const SLOT_ITEM_CLASSES: Record<string, string[]> = {
  weapon: ["Wand", "One Hand Mace", "Two Hand Mace",
           "Sceptre", "Staff", "Warstaff", "Spear", "Bow",
           "Crossbow", "Focus", "TrapTool"],
  weaponSwap: ["Wand", "One Hand Mace", "Two Hand Mace",
           "Sceptre", "Staff", "Warstaff", "Spear", "Bow",
           "Crossbow", "Focus", "TrapTool"],
  offhand: ["Shield", "Buckler", "Quiver", "Focus"],
  offhandSwap: ["Shield", "Buckler", "Quiver", "Focus"],
  helmet: ["Helmet"],
  bodyArmour: ["Body Armour"],
  gloves: ["Gloves"],
  boots: ["Boots"],
  belt: ["Belt"],
  amulet: ["Amulet"],
  ring1: ["Ring"],
  ring2: ["Ring"],
};
