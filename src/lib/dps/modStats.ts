import type { GearLayout, BuildGearEntry, GearSlotKey } from "../../types/buildPlan";
import { GEAR_SLOT_LABELS } from "../../types/buildPlan";
import { modById } from "../../data/mods";
import type { ContributionKind, RollMode, StatContribution, StatMap } from "./types";
import { addContribution, emptyStatMap } from "./statMap";

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

function addEntryStats(
  map: StatMap,
  slotKey: GearSlotKey,
  entry: BuildGearEntry,
  rollMode: RollMode,
): void {
  const ids = entry.desiredModIds ?? [];
  for (const modId of ids) {
    const mod = modById.get(modId);
    if (!mod) continue;
    const percentile =
      rollMode === "max" ? 100 : entry.modRolls?.[modId] ?? 0;
    const slotLabel = GEAR_SLOT_LABELS[slotKey] ?? slotKey;
    const modLabel = mod.name || mod.text || modId;
    for (const stat of mod.stats) {
      const value = resolveStatValue(stat.min, stat.max, percentile);
      if (value === 0) continue;
      const contribution: StatContribution = {
        value,
        kind: statKindForId(stat.id),
        // Gear mod tags in item_mods.json are spawn-weight / classification tags
        // (e.g. ["attack","speed"] or ["damage"]), NOT skill-type application
        // restrictions. We emit [] so that tagsMatch() treats the contribution as
        // global — it applies to every skill. Support-gem tag filtering is handled
        // separately via allowedActiveSkillTypes / excludedActiveSkillTypes.
        tags: [],
        source: {
          type: "gear",
          id: `${slotKey}:${modId}`,
          label: `${slotLabel}: ${modLabel}`,
        },
      };
      addContribution(map, stat.id, contribution);
    }
  }
}
