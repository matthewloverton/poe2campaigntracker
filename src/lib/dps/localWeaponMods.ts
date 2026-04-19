import type { BuildGearEntry } from "../../types/buildPlan";
import { baseItemById } from "../../data/items";
import { modById } from "../../data/mods";
import type { RollMode } from "./types";

/**
 * Stat id prefixes we treat as "local" to the weapon.
 * Local stats modify the weapon's own damage/speed/crit before the skill formula runs.
 * Any stat id starting with "local_" is considered local.
 */
function isLocalStatId(id: string): boolean {
  return id.startsWith("local_");
}

/** Clamp and linearly interpolate between min..max. */
function rollValue(min: number, max: number, percentile: number): number {
  const p = Math.max(0, Math.min(100, percentile));
  return min + ((max - min) * p) / 100;
}

export interface ResolvedWeaponProperties {
  physicalDamageMin: number;
  physicalDamageMax: number;
  fireDamageMin?: number;
  fireDamageMax?: number;
  coldDamageMin?: number;
  coldDamageMax?: number;
  lightningDamageMin?: number;
  lightningDamageMax?: number;
  chaosDamageMin?: number;
  chaosDamageMax?: number;
  attackTime?: number;
  criticalStrikeChance?: number;
  range?: number;
  /** Crossbow reload time in ms. Not scaled by attack speed — reload speed is a separate stat in PoE2. */
  reloadTime?: number;
}

/**
 * Resolve a weapon's effective damage range by applying local mods to the base-item properties.
 * Returns null when there's no weapon or no base item found.
 *
 * PoB mechanic: local mods (those whose stat ids start with "local_") are applied to the
 * weapon's own damage range before the skill formula reads it. They are NOT global multipliers.
 */
export function resolveWeaponProperties(
  weapon: BuildGearEntry | null,
  rollMode: RollMode,
): ResolvedWeaponProperties | null {
  if (!weapon) return null;
  const base = weapon.baseItemId ? baseItemById.get(weapon.baseItemId) : undefined;
  if (!base) return null;
  const p = base.properties;

  // Start from base item values.
  const r: ResolvedWeaponProperties = {
    physicalDamageMin: p.physicalDamageMin ?? 0,
    physicalDamageMax: p.physicalDamageMax ?? 0,
    attackTime: p.attackTime,
    criticalStrikeChance: p.criticalStrikeChance,
    range: p.range,
    reloadTime: p.reloadTime,
  };

  // Gather the local-stat contributions from this weapon's mods.
  // Two passes:
  //   1. Flat added (local_minimum_added_<t>_damage / local_maximum_added_<t>_damage)
  //   2. Increased percentages (local_*_+%)
  //   3. Other local timing/crit mods (attack speed, crit chance)
  const flatMin: Record<string, number> = {};
  const flatMax: Record<string, number> = {};
  const incPerc: Record<string, number> = {};

  const modIds = weapon.desiredModIds ?? [];
  for (const modId of modIds) {
    const mod = modById.get(modId);
    if (!mod) continue;
    const percentile =
      rollMode === "max" ? 100 : weapon.modRolls?.[modId] ?? 0;
    for (const stat of mod.stats ?? []) {
      if (!isLocalStatId(stat.id)) continue;
      const value = rollValue(stat.min, stat.max, percentile);
      if (value === 0) continue;

      // Match local_minimum_added_<type>_damage / local_maximum_added_<type>_damage
      const minAddMatch = stat.id.match(/^local_minimum_added_(\w+)_damage$/);
      const maxAddMatch = stat.id.match(/^local_maximum_added_(\w+)_damage$/);
      if (minAddMatch) { flatMin[minAddMatch[1]] = (flatMin[minAddMatch[1]] ?? 0) + value; continue; }
      if (maxAddMatch) { flatMax[maxAddMatch[1]] = (flatMax[maxAddMatch[1]] ?? 0) + value; continue; }

      // Increased percentages of specific kinds.
      if (stat.id === "local_physical_damage_+%") { incPerc.physical = (incPerc.physical ?? 0) + value; continue; }
      if (stat.id === "local_elemental_damage_+%") {
        incPerc.fire = (incPerc.fire ?? 0) + value;
        incPerc.cold = (incPerc.cold ?? 0) + value;
        incPerc.lightning = (incPerc.lightning ?? 0) + value;
        continue;
      }
      if (stat.id === "local_fire_damage_+%") { incPerc.fire = (incPerc.fire ?? 0) + value; continue; }
      if (stat.id === "local_cold_damage_+%") { incPerc.cold = (incPerc.cold ?? 0) + value; continue; }
      if (stat.id === "local_lightning_damage_+%") { incPerc.lightning = (incPerc.lightning ?? 0) + value; continue; }
      if (stat.id === "local_chaos_damage_+%") { incPerc.chaos = (incPerc.chaos ?? 0) + value; continue; }

      if (stat.id === "local_attack_speed_+%") {
        const cur = r.attackTime ?? 1000;
        r.attackTime = cur / (1 + value / 100); // faster attacks → lower attack time
        continue;
      }
      if (stat.id === "local_critical_strike_chance_+%") {
        const cur = r.criticalStrikeChance ?? 0;
        r.criticalStrikeChance = cur * (1 + value / 100);
        continue;
      }
    }
  }

  // Apply flat-added to the matching type (start with phys, then others may grow from 0).
  addFlatTo(r, "physical", flatMin.physical ?? 0, flatMax.physical ?? 0);
  addFlatTo(r, "fire", flatMin.fire ?? 0, flatMax.fire ?? 0);
  addFlatTo(r, "cold", flatMin.cold ?? 0, flatMax.cold ?? 0);
  addFlatTo(r, "lightning", flatMin.lightning ?? 0, flatMax.lightning ?? 0);
  addFlatTo(r, "chaos", flatMin.chaos ?? 0, flatMax.chaos ?? 0);

  // Apply increased percentages.
  r.physicalDamageMin *= 1 + (incPerc.physical ?? 0) / 100;
  r.physicalDamageMax *= 1 + (incPerc.physical ?? 0) / 100;
  if (r.fireDamageMin !== undefined) {
    r.fireDamageMin *= 1 + (incPerc.fire ?? 0) / 100;
    r.fireDamageMax = (r.fireDamageMax ?? 0) * (1 + (incPerc.fire ?? 0) / 100);
  }
  if (r.coldDamageMin !== undefined) {
    r.coldDamageMin *= 1 + (incPerc.cold ?? 0) / 100;
    r.coldDamageMax = (r.coldDamageMax ?? 0) * (1 + (incPerc.cold ?? 0) / 100);
  }
  if (r.lightningDamageMin !== undefined) {
    r.lightningDamageMin *= 1 + (incPerc.lightning ?? 0) / 100;
    r.lightningDamageMax = (r.lightningDamageMax ?? 0) * (1 + (incPerc.lightning ?? 0) / 100);
  }
  if (r.chaosDamageMin !== undefined) {
    r.chaosDamageMin *= 1 + (incPerc.chaos ?? 0) / 100;
    r.chaosDamageMax = (r.chaosDamageMax ?? 0) * (1 + (incPerc.chaos ?? 0) / 100);
  }

  return r;
}

function addFlatTo(r: ResolvedWeaponProperties, type: string, addMin: number, addMax: number): void {
  if (addMin === 0 && addMax === 0) return;
  switch (type) {
    case "physical":
      r.physicalDamageMin += addMin;
      r.physicalDamageMax += addMax;
      return;
    case "fire":
      r.fireDamageMin = (r.fireDamageMin ?? 0) + addMin;
      r.fireDamageMax = (r.fireDamageMax ?? 0) + addMax;
      return;
    case "cold":
      r.coldDamageMin = (r.coldDamageMin ?? 0) + addMin;
      r.coldDamageMax = (r.coldDamageMax ?? 0) + addMax;
      return;
    case "lightning":
      r.lightningDamageMin = (r.lightningDamageMin ?? 0) + addMin;
      r.lightningDamageMax = (r.lightningDamageMax ?? 0) + addMax;
      return;
    case "chaos":
      r.chaosDamageMin = (r.chaosDamageMin ?? 0) + addMin;
      r.chaosDamageMax = (r.chaosDamageMax ?? 0) + addMax;
      return;
  }
}
