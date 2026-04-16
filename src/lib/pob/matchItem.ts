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

// Precompute normalized text per mod → list of mods sharing that text shape.
// RePoE mods have (min-max) ranges that normalize to "#"; PoB rolled values are
// bare numbers that also normalize to "#". Multiple tiers can share the same shape.
const modsByNormalized = new Map<string, typeof allMods>();
for (const mod of allMods) {
  const n = normalizeModText(mod.text);
  const list = modsByNormalized.get(n) ?? [];
  list.push(mod);
  modsByNormalized.set(n, list);
}

function extractNumbers(line: string): number[] {
  const matches = line.match(/[+-]?\d+(\.\d+)?/g) ?? [];
  return matches.map(Number);
}

function pickTierAndRoll(
  candidates: typeof allMods,
  values: number[],
): { modId: string; rollPct: number | undefined } | null {
  if (candidates.length === 0) return null;

  // Prefer the tier whose stat ranges all contain the extracted values.
  const fits = candidates.find((mod) =>
    mod.stats.every((s, i) => {
      const v = values[i];
      return v != null && v >= s.min && v <= s.max;
    }),
  );
  const chosen = fits ?? candidates[0];

  // Compute percentile from the first stat's position in its range.
  const s0 = chosen.stats[0];
  const v0 = values[0];
  let rollPct: number | undefined;
  if (s0 && v0 != null && s0.max > s0.min) {
    const clamped = Math.max(s0.min, Math.min(s0.max, v0));
    rollPct = Math.round(((clamped - s0.min) / (s0.max - s0.min)) * 100);
  }
  return { modId: chosen.id, rollPct };
}

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

  // Mod match — pair normalized patterns against the DB, then select the tier
  // whose stat range(s) contain the actual numeric values from the item line.
  const desiredMods: string[] = [];
  const desiredModIds: string[] = [];
  const modRolls: Record<string, number> = {};
  item.explicits.forEach((line, i) => {
    const normalized = normalizeModText(line);
    const candidates = modsByNormalized.get(normalized);
    if (candidates && candidates.length > 0) {
      const values = extractNumbers(line);
      const picked = pickTierAndRoll(candidates, values)!;
      desiredModIds.push(picked.modId);
      desiredMods.push(cleanModText(line.replace(/\s*\((crafted|fractured)\)\s*/gi, "")));
      if (picked.rollPct != null) {
        modRolls[picked.modId] = picked.rollPct;
      } else {
        // Fall back to PoB's {range:X} fraction if we couldn't derive from values.
        const fraction = item.explicitRolls[i];
        if (fraction != null) {
          modRolls[picked.modId] = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
        }
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
