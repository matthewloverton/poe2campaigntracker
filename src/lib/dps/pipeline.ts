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
  weapon: {
    physicalDamageMin?: number;
    physicalDamageMax?: number;
    fireDamageMin?: number;
    fireDamageMax?: number;
    coldDamageMin?: number;
    coldDamageMax?: number;
    lightningDamageMin?: number;
    lightningDamageMax?: number;
    chaosDamageMin?: number;
    chaosDamageMax?: number;
  } | null;
  skillFlat: DamageByType;
  statMap: StatMap;
}

export function calcBaseDamage(input: CalcBaseInput): DamageByType {
  const out = zeroDamageByType();
  const eff = input.damageEffectiveness / 100;
  const effMult = input.isAttack ? eff : 1;

  const weaponDamage: Record<DamageType, { min: number; max: number }> = {
    physical: {
      min: input.weapon?.physicalDamageMin ?? 0,
      max: input.weapon?.physicalDamageMax ?? 0,
    },
    fire: {
      min: input.weapon?.fireDamageMin ?? 0,
      max: input.weapon?.fireDamageMax ?? 0,
    },
    cold: {
      min: input.weapon?.coldDamageMin ?? 0,
      max: input.weapon?.coldDamageMax ?? 0,
    },
    lightning: {
      min: input.weapon?.lightningDamageMin ?? 0,
      max: input.weapon?.lightningDamageMax ?? 0,
    },
    chaos: {
      min: input.weapon?.chaosDamageMin ?? 0,
      max: input.weapon?.chaosDamageMax ?? 0,
    },
  };

  for (const t of DAMAGE_TYPES) {
    const weaponMin = weaponDamage[t].min;
    const weaponMax = weaponDamage[t].max;

    // Flat added damage common to all skills (mostly on weapons themselves).
    const baseMin = sumFlat(input.statMap, `base_${t}_damage_min`);
    const baseMax = sumFlat(input.statMap, `base_${t}_damage_max`);

    // Flat added damage conditional on skill category.
    // attack_minimum_added_<type>_damage / attack_maximum_added_<type>_damage:
    //   applies only to attack skills (rings, gloves, amulets with "to Attacks" mods).
    // spell_minimum_added_<type>_damage / spell_maximum_added_<type>_damage:
    //   applies only to spell skills — no such mods exist in current RePoE2 data,
    //   but reads are included here so no code change is needed when they appear.
    const attackMin = input.isAttack ? sumFlat(input.statMap, `attack_minimum_added_${t}_damage`) : 0;
    const attackMax = input.isAttack ? sumFlat(input.statMap, `attack_maximum_added_${t}_damage`) : 0;
    const spellMin = !input.isAttack ? sumFlat(input.statMap, `spell_minimum_added_${t}_damage`) : 0;
    const spellMax = !input.isAttack ? sumFlat(input.statMap, `spell_maximum_added_${t}_damage`) : 0;

    const skillMin = input.skillFlat[t].min;
    const skillMax = input.skillFlat[t].max;

    out[t].min = (weaponMin + skillMin + baseMin + attackMin + spellMin) * effMult;
    out[t].max = (weaponMax + skillMax + baseMax + attackMax + spellMax) * effMult;
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

/**
 * Apply physical → elemental/chaos conversions, matching PoB2's intermediate-rounding
 * algorithm from CalcOffence.lua / calcConvertedDamage:
 *
 *   1. Accumulate conversion fractions per (from, to) pair (multiple stat IDs can map
 *      to the same pair; cap total outflow from each source at 100%).
 *   2. For each target damage type, sum the incoming converted amounts from all source
 *      types using the full pre-retention base (PoB uses `output[otherType.."MinBase"]`).
 *   3. Round those incoming-conversion totals (PoB: only if both min and max non-zero).
 *   4. Retained base for each source type = base * (1 - totalOutFrac), continuous.
 *   5. out[target] = retained_target + roundedIncoming_target.
 *   6. A final per-type round is applied by the caller (index.ts).
 *
 * Without step 3 our Lightning max for a 7–12 phys + 1–9 light weapon at L5 Galvanic
 * (21% multiplier, 60% phys→light) came out 3 instead of PoB's 4:
 *   converted phys→light: 2.52 × 0.6 = 1.512 → round → 2  (PoB)
 *   vs keeping 1.512 and only rounding final 3.402 → 3      (old code)
 */
export function applyConversions(base: DamageByType, map: StatMap): DamageByType {
  // Step 1: accumulate fractions per unique (from, to) pair, track total out per source.
  const pairFrac = new Map<string, { from: DamageType; to: DamageType; frac: number }>();
  const totalOutPct: Partial<Record<DamageType, number>> = {};

  for (const { from, to, id } of CONVERSION_STAT_IDS) {
    const pct = sumFlat(map, id);
    if (pct <= 0) continue;
    const key = `${from}->${to}`;
    const entry = pairFrac.get(key);
    if (entry) {
      entry.frac += pct / 100;
    } else {
      pairFrac.set(key, { from, to, frac: pct / 100 });
    }
    totalOutPct[from] = (totalOutPct[from] ?? 0) + pct;
  }

  // Cap per-pair fractions if total outflow > 100%
  for (const entry of pairFrac.values()) {
    const total = totalOutPct[entry.from] ?? 0;
    if (total > 100) {
      entry.frac *= 100 / total;
    }
  }

  // Step 2: collect incoming conversions per target type (using full pre-retention base).
  const incomingMin: Partial<Record<DamageType, number>> = {};
  const incomingMax: Partial<Record<DamageType, number>> = {};
  const totalOutFrac: Partial<Record<DamageType, number>> = {};

  for (const { from, to, frac } of pairFrac.values()) {
    incomingMin[to] = (incomingMin[to] ?? 0) + base[from].min * frac;
    incomingMax[to] = (incomingMax[to] ?? 0) + base[from].max * frac;
    totalOutFrac[from] = (totalOutFrac[from] ?? 0) + frac;
  }

  // Step 3: round incoming conversions per target (PoB: only when both min and max non-zero).
  for (const t of DAMAGE_TYPES) {
    const cMin = incomingMin[t] ?? 0;
    const cMax = incomingMax[t] ?? 0;
    if (cMin !== 0 && cMax !== 0) {
      incomingMin[t] = Math.round(cMin);
      incomingMax[t] = Math.round(cMax);
    }
  }

  // Steps 4–5: output = retained base + rounded incoming conversions.
  const out: DamageByType = {
    physical: { ...base.physical },
    fire: { ...base.fire },
    cold: { ...base.cold },
    lightning: { ...base.lightning },
    chaos: { ...base.chaos },
  };

  for (const t of DAMAGE_TYPES) {
    const outFrac = totalOutFrac[t] ?? 0;
    if (outFrac > 0) {
      out[t].min = base[t].min * (1 - outFrac);
      out[t].max = base[t].max * (1 - outFrac);
    }
    out[t].min += incomingMin[t] ?? 0;
    out[t].max += incomingMax[t] ?? 0;
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
  /** Percent adjustment from RePoE2 `static.attack_speed_multiplier`, e.g. -25 means
   *  25% slower (multiplier = 0.75), +10 means 10% faster (multiplier = 1.10).
   *  A value of 0 (or undefined coerced to 0) means no adjustment — treated as 1.0. */
  skillAttackSpeedMultiplier: number;
  statMap: StatMap;
  skillTags: string[];
  /** Magazine size for ammo-consuming attacks. When provided with weaponReloadTime, applies
   *  the PoB cycle formula: effective_rate = magazine / (magazine / firingRate + reloadTimeSec). */
  ammoCapacity?: number;
  /** Weapon reload time in ms (e.g. 800 for crossbows). */
  weaponReloadTime?: number;
}

export function calcRate(input: CalcRateInput): number {
  const baseTimeMs = input.isAttack
    ? input.weaponAttackTime ?? input.skillAttackTime ?? 1000
    : input.castTime ?? 1000;
  const baseRate = 1000 / baseTimeMs;
  // skillAttackSpeedMultiplier is a percent delta (e.g. -25 = 75%, 0 = 100%, 10 = 110%)
  const skillRateMult = 1 + (input.skillAttackSpeedMultiplier || 0) / 100;
  const incSpeed = input.isAttack
    ? sumInc(input.statMap, "attack_speed_+%", input.skillTags)
    : sumInc(input.statMap, "cast_speed_+%", input.skillTags);
  const moreSpeed = input.isAttack
    ? productMore(input.statMap, "attack_speed_+%_final", input.skillTags)
    : productMore(input.statMap, "cast_speed_+%_final", input.skillTags);
  const firingRate = baseRate * skillRateMult * (1 + incSpeed / 100) * moreSpeed;

  // If this is an ammo-consuming attack with a defined reload time, compute cycle rate.
  // Formula: magazine / (magazine / firingRate + reloadTimeSec)
  // Matches PoB: e.g. 1 bolt, 625ms attack, 800ms reload → 1 / (1/1.6 + 0.8) = 0.702/s
  if (
    input.isAttack &&
    input.ammoCapacity !== undefined &&
    input.ammoCapacity > 0 &&
    input.weaponReloadTime !== undefined &&
    input.weaponReloadTime > 0
  ) {
    const magazine = input.ammoCapacity;
    const firingTimeSec = magazine / firingRate;
    const reloadTimeSec = input.weaponReloadTime / 1000;
    return magazine / (firingTimeSec + reloadTimeSec);
  }

  return firingRate;
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

/**
 * Resolve the total projectile count for a projectile-tagged skill:
 *   base (from static skill stats) + additional (from gear/supports/gems).
 * Returns 1 if the skill is not projectile-tagged.
 *
 * `statMap` should be the per-stat-set statmap merged with all contributions
 * (gear + support + skill). We pull flat values from it.
 */
export function projectileCount(
  skillTags: string[],
  statMap: StatMap,
): number {
  if (!skillTags.includes("projectile")) return 1;
  const base = sumFlat(statMap, "base_number_of_projectiles");
  const additional = sumFlat(statMap, "number_of_additional_projectiles");
  // If the skill doesn't define base (non-standard projectile), default to 1
  const total = (base > 0 ? base : 1) + additional;
  return Math.max(1, total);
}
