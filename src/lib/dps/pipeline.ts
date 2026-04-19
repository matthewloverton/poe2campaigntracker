import type {
  CritInfo,
  DamageByType,
  DamageRange,
  DamageType,
  StatMap,
} from "./types";
import { DAMAGE_TYPES } from "./types";
import { productMore, sumFlat, sumInc } from "./statMap";

export function zeroDamageByType(): DamageByType {
  const o = {} as DamageByType;
  for (const t of DAMAGE_TYPES) o[t] = { min: 0, max: 0 };
  return o;
}

export function sumPerHit(byType: DamageByType): DamageRange {
  let min = 0, max = 0;
  for (const t of DAMAGE_TYPES) { min += byType[t].min; max += byType[t].max; }
  return { min, max };
}

export function avg(range: DamageRange): number {
  return (range.min + range.max) / 2;
}

export interface CalcBaseInput {
  isAttack: boolean;
  /** Percent, e.g. 100 or 150. Applied only to attacks. */
  damageEffectiveness: number;
  weapon: { physicalDamageMin?: number; physicalDamageMax?: number } | null;
  skillFlat: DamageByType;
  statMap: StatMap;
}

export function calcBaseDamage(input: CalcBaseInput): DamageByType {
  const out = zeroDamageByType();
  const eff = input.damageEffectiveness / 100;
  const effMult = input.isAttack ? eff : 1;

  const weaponPhysMin = input.weapon?.physicalDamageMin ?? 0;
  const weaponPhysMax = input.weapon?.physicalDamageMax ?? 0;
  const gearPhysMin = sumFlat(input.statMap, "base_physical_damage_min");
  const gearPhysMax = sumFlat(input.statMap, "base_physical_damage_max");

  out.physical.min = (weaponPhysMin + input.skillFlat.physical.min + gearPhysMin) * effMult;
  out.physical.max = (weaponPhysMax + input.skillFlat.physical.max + gearPhysMax) * effMult;

  for (const t of ["fire", "cold", "lightning", "chaos"] as DamageType[]) {
    const gearMin = sumFlat(input.statMap, `base_${t}_damage_min`);
    const gearMax = sumFlat(input.statMap, `base_${t}_damage_max`);
    out[t].min = (input.skillFlat[t].min + gearMin) * effMult;
    out[t].max = (input.skillFlat[t].max + gearMax) * effMult;
  }

  return out;
}

/** Physical → elemental/chaos conversions. Consumes from physical, distributes to target types. */
const CONVERSION_STAT_IDS: Array<{ from: DamageType; to: DamageType; id: string }> = [
  { from: "physical", to: "fire", id: "skill_physical_damage_%_to_convert_to_fire" },
  { from: "physical", to: "cold", id: "skill_physical_damage_%_to_convert_to_cold" },
  { from: "physical", to: "lightning", id: "skill_physical_damage_%_to_convert_to_lightning" },
  { from: "physical", to: "chaos", id: "skill_physical_damage_%_to_convert_to_chaos" },
  // RePoE2 actual stat ids (skill innate conversions from stat_sets):
  { from: "physical", to: "fire", id: "active_skill_base_physical_damage_%_to_convert_to_fire" },
  { from: "physical", to: "cold", id: "active_skill_base_physical_damage_%_to_convert_to_cold" },
  { from: "physical", to: "lightning", id: "active_skill_base_physical_damage_%_to_convert_to_lightning" },
  { from: "physical", to: "chaos", id: "active_skill_base_physical_damage_%_to_convert_to_chaos" },
];

export function applyConversions(base: DamageByType, map: StatMap): DamageByType {
  const out: DamageByType = {
    physical: { ...base.physical },
    fire: { ...base.fire },
    cold: { ...base.cold },
    lightning: { ...base.lightning },
    chaos: { ...base.chaos },
  };
  for (const { from, to, id } of CONVERSION_STAT_IDS) {
    const pct = sumFlat(map, id);
    if (pct <= 0) continue;
    const capped = Math.min(100, pct);
    const frac = capped / 100;
    const movedMin = out[from].min * frac;
    const movedMax = out[from].max * frac;
    out[from].min -= movedMin;
    out[from].max -= movedMax;
    out[to].min += movedMin;
    out[to].max += movedMax;
  }
  return out;
}

export function applyMultipliers(
  base: DamageByType,
  map: StatMap,
  skillTags: string[],
): DamageByType {
  const out = zeroDamageByType();
  const globalInc = sumInc(map, "damage_+%", skillTags);
  const globalMore = productMore(map, "damage_+%_final", skillTags);

  for (const t of DAMAGE_TYPES) {
    const typeInc = sumInc(map, `${t}_damage_+%`, skillTags);
    const typeMore = productMore(map, `${t}_damage_+%_final`, skillTags);
    const totalInc = 1 + (globalInc + typeInc) / 100;
    const totalMore = globalMore * typeMore;
    out[t].min = base[t].min * totalInc * totalMore;
    out[t].max = base[t].max * totalInc * totalMore;
  }
  return out;
}

export interface CalcRateInput {
  isAttack: boolean;
  /** ms */
  weaponAttackTime?: number;
  /** ms */
  skillAttackTime?: number;
  /** ms */
  castTime?: number;
  /** Decimal multiplier from RePoE2 `static.attack_speed_multiplier`, e.g. 1.25.
   *  A value of 0 means "no multiplier set" and is treated as 1.0. */
  skillAttackSpeedMultiplier: number;
  statMap: StatMap;
  skillTags: string[];
}

export function calcRate(input: CalcRateInput): number {
  const baseTimeMs = input.isAttack
    ? input.weaponAttackTime ?? input.skillAttackTime ?? 1000
    : input.castTime ?? 1000;
  const baseRate = 1000 / baseTimeMs;
  const skillRateMult = input.skillAttackSpeedMultiplier || 1;
  const incSpeed = input.isAttack
    ? sumInc(input.statMap, "attack_speed_+%", input.skillTags)
    : sumInc(input.statMap, "cast_speed_+%", input.skillTags);
  const moreSpeed = input.isAttack
    ? productMore(input.statMap, "attack_speed_+%_final", input.skillTags)
    : productMore(input.statMap, "cast_speed_+%_final", input.skillTags);
  return baseRate * skillRateMult * (1 + incSpeed / 100) * moreSpeed;
}

export interface CalcCritInput {
  /** 0..1 */
  baseCritChance: number;
  /** e.g. 1.5 for a base +50% crit multi */
  baseCritMulti: number;
  statMap: StatMap;
  tags: string[];
}

export function calcCrit(input: CalcCritInput): CritInfo {
  const incChance = sumInc(input.statMap, "critical_strike_chance_+%", input.tags);
  const chance = Math.max(0, Math.min(1, input.baseCritChance * (1 + incChance / 100)));
  const flatMulti = sumFlat(input.statMap, "critical_strike_multiplier_+");
  const multi = input.baseCritMulti + flatMulti / 100;
  const expectedMulti = 1 + chance * (multi - 1);
  return { chance, multi, expectedMulti };
}
