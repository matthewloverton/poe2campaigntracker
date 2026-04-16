import { allItems } from "../../data/items";
import { allUniques } from "../../data/uniques";
import { allMods, cleanModText } from "../../data/mods";
import type { BuildGearEntry, GearSlotKey } from "../../types/buildPlan";
import type { ImportWarning, PoBItem } from "./types";

export const POB_SLOT_MAP: Record<string, GearSlotKey> = {
  "Weapon 1": "weapon",
  "Weapon 2": "offhand",
  "Weapon 1 Swap": "weaponSwap",
  "Weapon 2 Swap": "offhandSwap",
  "Helmet": "helmet",
  "Body Armour": "bodyArmour",
  "Gloves": "gloves",
  "Boots": "boots",
  "Amulet": "amulet",
  "Ring 1": "ring1",
  "Ring 2": "ring2",
  "Belt": "belt",
};

/**
 * Normalise mod text for fuzzy matching against our DB:
 * - strip RePoE markup via cleanModText  ([tag|display] → display)
 * - strip (crafted)/(fractured)/(implicit) suffixes
 * - replace (min-max) ranges with "#" (e.g. "(6-10)" → "#")
 * - replace remaining numbers (with optional +/- sign) with "#"
 * - collapse whitespace
 */
export function normalizeModText(text: string): string {
  // 1. Strip RePoE markup
  let s = cleanModText(text);
  // 2. Strip suffix tags like (crafted), (fractured), (implicit)
  s = s.replace(/\s*\((crafted|fractured|implicit)\)\s*/gi, " ");
  // 3. Replace (min-max) range notation with "#" — must come before bare number replacement.
  //    Include optional leading +/- sign so "+(7-11)" collapses to "#" not "+#".
  s = s.replace(/[+-]?\(\d+(?:\.\d+)?-\d+(?:\.\d+)?\)/g, "#");
  // 4. Replace remaining signed/unsigned numbers with "#"
  s = s.replace(/[+-]?\d+(\.\d+)?/g, "#");
  // 5. Collapse whitespace
  return s.replace(/\s+/g, " ").trim();
}

// Precompute normalized text per mod once. RePoE mods have (min-max) ranges that
// normalize to "#"; PoB rolled values are bare numbers that also normalize to "#".
const normalizedModIndex: Array<{ normalized: string; modId: string }> = allMods.map((m) => ({
  modId: m.id,
  normalized: normalizeModText(m.text),
}));

export interface MatchItemResult {
  entry: BuildGearEntry | null;
  warnings: ImportWarning[];
}

/**
 * Map a PoB item to a BuildGearEntry for the given slot.
 * Returns null entry (with warning) only for totally unusable input.
 */
export function matchItem(item: PoBItem, slot: GearSlotKey): MatchItemResult {
  const warnings: ImportWarning[] = [];

  // Base match
  const base = allItems.find((i) => i.name === item.baseType);
  if (!base) {
    warnings.push({
      scope: "item",
      message: `Base "${item.baseType}" not in database — item kept as free text`,
    });
  }

  // Unique match (only if rarity is UNIQUE)
  let uniqueId: string | undefined;
  if (item.rarity === "UNIQUE") {
    const unique = allUniques.find((u) => u.name === item.name);
    if (unique) {
      uniqueId = unique.id;
    } else {
      warnings.push({
        scope: "item",
        message: `Unique "${item.name}" not in database — treating as rare`,
      });
    }
  }

  // Mod match — pair normalized patterns against the DB.
  const desiredMods: string[] = [];
  const desiredModIds: string[] = [];
  const modRolls: Record<string, number> = {};
  item.explicits.forEach((line, i) => {
    const normalized = normalizeModText(line);
    const match = normalizedModIndex.find((n) => n.normalized === normalized);
    if (match) {
      desiredModIds.push(match.modId);
      desiredMods.push(cleanModText(line.replace(/\s*\((crafted|fractured)\)\s*/gi, "")));
      // Import roll fraction (0.0-1.0) → app percentile (0-100).
      const fraction = item.explicitRolls[i];
      if (fraction != null) {
        modRolls[match.modId] = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
      }
    } else {
      desiredMods.push(line);
      warnings.push({
        scope: "item",
        message: `Mod fell back to free text: "${line}"`,
      });
    }
  });

  const entry: BuildGearEntry = {
    id: crypto.randomUUID(),
    slot,
    base: base?.name ?? item.baseType,
    baseItemId: base?.id,
    uniqueId,
    desiredMods,
    desiredModIds: desiredModIds.length > 0 ? desiredModIds : undefined,
    modRolls: Object.keys(modRolls).length > 0 ? modRolls : undefined,
    notes: "",
    iconPath: base?.iconPath,
    quality: item.quality,
  };

  return { entry, warnings };
}
