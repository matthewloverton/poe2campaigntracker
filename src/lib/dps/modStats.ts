import type { GearLayout, BuildGearEntry, GearSlotKey } from "../../types/buildPlan";
import { GEAR_SLOT_LABELS } from "../../types/buildPlan";
import { modById } from "../../data/mods";
import { implicitModById } from "../../data/implicitMods";
import { baseItemById } from "../../data/items";
import type { ContributionKind, RollMode, StatContribution, StatMap } from "./types";
import { addContribution, emptyStatMap } from "./statMap";

/**
 * Weapon-style slots whose mods may contain local_* stats.
 * Local stats are applied directly to the weapon's damage range by resolveWeaponProperties()
 * and must NOT be re-added to the StatMap (which would double-apply them as global multipliers).
 */
const WEAPON_SLOTS = new Set<GearSlotKey>(["weapon", "weaponSwap", "offhand", "offhandSwap"]);

/**
 * Infer contribution kind from stat id naming.
 * - ends with "_final" or "_more" → more
 * - ends with "_+%" (but not "_final") → increased
 * - otherwise → flat
 */
export function statKindForId(id: string): ContributionKind {
  if (id.endsWith("_final") || id.endsWith("_more")) return "more";
  if (/_\+%$/.test(id)) return "increased";
  return "flat";
}

/** Resolve a stat's rolled value given a percentile 0..100. */
function resolveStatValue(min: number, max: number, percentile: number): number {
  const p = Math.max(0, Math.min(100, percentile));
  return min + ((max - min) * p) / 100;
}

function slotKeys(gear: GearLayout): GearSlotKey[] {
  return Object.keys(gear) as GearSlotKey[];
}

export function collectGearStats(gear: GearLayout, rollMode: RollMode): StatMap {
  const map = emptyStatMap();
  for (const key of slotKeys(gear)) {
    const entry = gear[key];
    if (!entry) continue;
    addEntryStats(map, key, entry, rollMode);
  }
  return map;
}

/**
 * Shared helper: look up a mod by ID (from either implicit or explicit mod tables),
 * compute its stat contributions, and add them to the map.
 */
function addModContributions(
  map: StatMap,
  slotKey: GearSlotKey,
  modId: string,
  percentile: number,
  modKind: "implicit" | "explicit",
  slotLabel: string,
): void {
  // Implicits live in implicitModById; explicits in modById.
  const mod = modKind === "implicit"
    ? implicitModById.get(modId)
    : modById.get(modId);
  if (!mod) return;

  const modLabel = mod.name || mod.text || modId;
  const sourceLabel = modKind === "implicit"
    ? `${slotLabel} (implicit): ${modLabel}`
    : `${slotLabel}: ${modLabel}`;

  for (const stat of mod.stats) {
    // Skip local mods on weapon-style slots — they're applied to the weapon
    // properties by resolveWeaponProperties() instead, to avoid double-application.
    if (WEAPON_SLOTS.has(slotKey) && stat.id.startsWith("local_")) continue;
    const value = resolveStatValue(stat.min, stat.max, percentile);
    if (value === 0) continue;
    const contribution: StatContribution = {
      value,
      kind: statKindForId(stat.id),
      // Gear mod tags are spawn-weight / classification tags (not skill-type
      // application restrictions). We emit [] so tagsMatch() treats the
      // contribution as global — it applies to every skill.
      tags: [],
      source: {
        type: "gear",
        id: `${slotKey}:${modKind}:${modId}`,
        label: sourceLabel,
      },
    };
    addContribution(map, stat.id, contribution);
  }
}

function addEntryStats(
  map: StatMap,
  slotKey: GearSlotKey,
  entry: BuildGearEntry,
  rollMode: RollMode,
): void {
  const slotLabel = GEAR_SLOT_LABELS[slotKey] ?? slotKey;

  // Implicit mods from the base item — always applied at 100th percentile
  // (implicits are fixed values, they don't roll).
  const base = entry.baseItemId ? baseItemById.get(entry.baseItemId) : undefined;
  const implicitIds = base?.implicits ?? [];
  for (const modId of implicitIds) {
    addModContributions(map, slotKey, modId, 100, "implicit", slotLabel);
  }

  // Explicit (rolled) mods — existing logic.
  const explicitIds = entry.desiredModIds ?? [];
  for (const modId of explicitIds) {
    const percentile = rollMode === "max" ? 100 : entry.modRolls?.[modId] ?? 0;
    addModContributions(map, slotKey, modId, percentile, "explicit", slotLabel);
  }
}
