import { describe, it, expect } from "vitest";
import {
  calcBaseDamage,
  applyConversions,
  applyMultipliers,
  calcRate,
  calcCrit,
  projectileCount,
  zeroDamageByType,
  sumPerHit,
  avg,
} from "./pipeline";
import { emptyStatMap, addContribution } from "./statMap";
import type { DamageType, StatContribution } from "./types";

const gearFlat = (id: string, value: number): StatContribution => ({
  value,
  kind: "flat",
  tags: [],
  source: { type: "gear", id, label: id },
});

describe("zeroDamageByType", () => {
  it("initialises all five types to 0/0", () => {
    const z = zeroDamageByType();
    for (const t of ["physical", "fire", "cold", "lightning", "chaos"] as DamageType[]) {
      expect(z[t]).toEqual({ min: 0, max: 0 });
    }
  });
});

describe("sumPerHit / avg", () => {
  it("sumPerHit sums min/max across all types", () => {
    const d = zeroDamageByType();
    d.physical = { min: 10, max: 20 };
    d.fire = { min: 5, max: 15 };
    expect(sumPerHit(d)).toEqual({ min: 15, max: 35 });
  });
  it("avg returns midpoint of a range", () => {
    expect(avg({ min: 10, max: 20 })).toBe(15);
  });
});

describe("calcBaseDamage — attack skill with weapon", () => {
  it("combines weapon phys + gear flat phys × effectiveness", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "base_physical_damage_min", gearFlat("a", 5));
    addContribution(statMap, "base_physical_damage_max", gearFlat("a", 10));
    const base = calcBaseDamage({
      isAttack: true,
      damageEffectiveness: 150,
      weapon: { physicalDamageMin: 20, physicalDamageMax: 40 },
      skillFlat: zeroDamageByType(),
      statMap,
    });
    // (20 + 5) * 1.5 = 37.5; (40 + 10) * 1.5 = 75
    expect(base.physical.min).toBeCloseTo(37.5, 3);
    expect(base.physical.max).toBeCloseTo(75, 3);
  });

  it("does not multiply by effectiveness when isAttack = false", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "base_fire_damage_min", gearFlat("a", 10));
    addContribution(statMap, "base_fire_damage_max", gearFlat("a", 20));
    const base = calcBaseDamage({
      isAttack: false,
      damageEffectiveness: 300,
      weapon: null,
      skillFlat: zeroDamageByType(),
      statMap,
    });
    // no weapon, no effectiveness: just the gear flat
    expect(base.fire.min).toBe(10);
    expect(base.fire.max).toBe(20);
  });

  it("treats absent weapon as 0 phys", () => {
    const statMap = emptyStatMap();
    const base = calcBaseDamage({
      isAttack: true,
      damageEffectiveness: 100,
      weapon: null,
      skillFlat: zeroDamageByType(),
      statMap,
    });
    expect(base.physical.min).toBe(0);
    expect(base.physical.max).toBe(0);
  });

  it("adds skillFlat to the base alongside gear flat and weapon", () => {
    const statMap = emptyStatMap();
    const skillFlat = zeroDamageByType();
    skillFlat.fire = { min: 4, max: 6 };
    const base = calcBaseDamage({
      isAttack: false,
      damageEffectiveness: 100,
      weapon: null,
      skillFlat,
      statMap,
    });
    expect(base.fire.min).toBe(4);
    expect(base.fire.max).toBe(6);
  });

  it("applies effectiveness to every damage type on attacks", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "base_cold_damage_min", gearFlat("a", 10));
    addContribution(statMap, "base_cold_damage_max", gearFlat("a", 10));
    const base = calcBaseDamage({
      isAttack: true,
      damageEffectiveness: 200,
      weapon: null,
      skillFlat: zeroDamageByType(),
      statMap,
    });
    expect(base.cold.min).toBeCloseTo(20, 3);
    expect(base.cold.max).toBeCloseTo(20, 3);
  });
});

describe("applyConversions", () => {
  it("converts a percentage of physical to fire", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "skill_physical_damage_%_to_convert_to_fire", gearFlat("s", 50));
    const base = zeroDamageByType();
    base.physical = { min: 100, max: 100 };
    const out = applyConversions(base, statMap);
    expect(out.physical.min).toBeCloseTo(50, 3);
    expect(out.fire.min).toBeCloseTo(50, 3);
  });

  it("caps conversion at 100%", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "skill_physical_damage_%_to_convert_to_fire", gearFlat("a", 80));
    addContribution(statMap, "skill_physical_damage_%_to_convert_to_cold", gearFlat("b", 80));
    const base = zeroDamageByType();
    base.physical = { min: 100, max: 100 };
    const out = applyConversions(base, statMap);
    // Each conversion runs independently; the cap is per-entry at 100.
    // Implementation detail: first conversion eats 80, then next runs against the remaining 20.
    // The invariant we assert: final total across damage types equals original total.
    const total = out.physical.min + out.fire.min + out.cold.min + out.lightning.min + out.chaos.min;
    expect(total).toBeCloseTo(100, 3);
  });

  it("returns a non-aliased result (does not mutate input)", () => {
    const statMap = emptyStatMap();
    const base = zeroDamageByType();
    base.physical = { min: 100, max: 100 };
    const out = applyConversions(base, statMap);
    expect(out).not.toBe(base);
    expect(base.physical).toEqual({ min: 100, max: 100 });
  });
});

describe("applyMultipliers", () => {
  it("applies (1 + sum inc) × product(more) per type", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "physical_damage_+%", {
      value: 50, kind: "increased", tags: [], source: { type: "gear", id: "x", label: "X" },
    });
    addContribution(statMap, "damage_+%_final", {
      value: 40, kind: "more", tags: [], source: { type: "support", id: "y", label: "Y" },
    });
    const base = zeroDamageByType();
    base.physical = { min: 10, max: 20 };
    const out = applyMultipliers(base, statMap, []);
    // 10 * (1 + 0.5) * 1.4 = 21
    expect(out.physical.min).toBeCloseTo(21, 3);
    expect(out.physical.max).toBeCloseTo(42, 3);
  });

  it("combines global damage_+% with type-specific inc", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "damage_+%", {
      value: 20, kind: "increased", tags: [], source: { type: "gear", id: "a", label: "A" },
    });
    addContribution(statMap, "fire_damage_+%", {
      value: 30, kind: "increased", tags: [], source: { type: "gear", id: "b", label: "B" },
    });
    const base = zeroDamageByType();
    base.fire = { min: 100, max: 100 };
    const out = applyMultipliers(base, statMap, []);
    // 100 * (1 + 0.2 + 0.3) = 150
    expect(out.fire.min).toBeCloseTo(150, 3);
  });

  it("filters multipliers by skill tags", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "damage_+%", {
      value: 100, kind: "increased", tags: ["spell"], source: { type: "gear", id: "a", label: "A" },
    });
    const base = zeroDamageByType();
    base.fire = { min: 100, max: 100 };
    const out = applyMultipliers(base, statMap, ["attack"]);
    // Spell-tagged mod shouldn't apply to an attack
    expect(out.fire.min).toBeCloseTo(100, 3);
  });
});

describe("calcRate", () => {
  it("attack: uses weapon attack time with inc attack speed", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "attack_speed_+%", {
      value: 20, kind: "increased", tags: [], source: { type: "gear", id: "x", label: "X" },
    });
    const rate = calcRate({
      isAttack: true,
      weaponAttackTime: 800,
      skillAttackTime: undefined,
      castTime: undefined,
      skillAttackSpeedMultiplier: 0,
      statMap,
      skillTags: [],
    });
    // base = 1000/800 = 1.25; *1.2 = 1.5
    expect(rate).toBeCloseTo(1.5, 3);
  });

  it("attack: skill attack-speed multiplier scales the base", () => {
    const statMap = emptyStatMap();
    const rate = calcRate({
      isAttack: true,
      weaponAttackTime: 1000,
      skillAttackTime: undefined,
      castTime: undefined,
      // RePoE2 stores this as a percent delta: 25 = 25% faster (×1.25), -25 = 25% slower (×0.75)
      skillAttackSpeedMultiplier: 25,
      statMap,
      skillTags: [],
    });
    // base 1/s × (1 + 25/100) = 1.25
    expect(rate).toBeCloseTo(1.25, 3);
  });

  it("attack: falls back to skillAttackTime when weapon time absent", () => {
    const statMap = emptyStatMap();
    const rate = calcRate({
      isAttack: true,
      weaponAttackTime: undefined,
      skillAttackTime: 500,
      castTime: undefined,
      skillAttackSpeedMultiplier: 0,
      statMap,
      skillTags: [],
    });
    expect(rate).toBeCloseTo(2, 3);
  });

  it("spell: uses cast time with inc cast speed", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "cast_speed_+%", {
      value: 25, kind: "increased", tags: [], source: { type: "gear", id: "x", label: "X" },
    });
    const rate = calcRate({
      isAttack: false,
      weaponAttackTime: undefined,
      skillAttackTime: undefined,
      castTime: 1000,
      skillAttackSpeedMultiplier: 0,
      statMap,
      skillTags: [],
    });
    expect(rate).toBeCloseTo(1.25, 3);
  });

  it("defaults to 1 second when no timing info given", () => {
    const statMap = emptyStatMap();
    const rate = calcRate({
      isAttack: false,
      weaponAttackTime: undefined,
      skillAttackTime: undefined,
      castTime: undefined,
      skillAttackSpeedMultiplier: 0,
      statMap,
      skillTags: [],
    });
    expect(rate).toBeCloseTo(1, 3);
  });
});

describe("projectileCount", () => {
  it("returns 1 for non-projectile skills", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "base_number_of_projectiles", gearFlat("a", 8));
    expect(projectileCount(["attack"], statMap)).toBe(1);
  });

  it("returns base count for projectile skills", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "base_number_of_projectiles", gearFlat("a", 8));
    expect(projectileCount(["attack", "projectile"], statMap)).toBe(8);
  });

  it("adds additional projectiles to base", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "base_number_of_projectiles", gearFlat("a", 3));
    addContribution(statMap, "number_of_additional_projectiles", gearFlat("b", 2));
    expect(projectileCount(["projectile"], statMap)).toBe(5);
  });

  it("defaults base to 1 when not set, still adds additional", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "number_of_additional_projectiles", gearFlat("a", 2));
    expect(projectileCount(["projectile"], statMap)).toBe(3);
  });

  it("never returns less than 1", () => {
    const statMap = emptyStatMap();
    expect(projectileCount(["projectile"], statMap)).toBe(1);
  });
});

describe("calcBaseDamage — attack-prefixed flat added damage", () => {
  it("attack skills read attack_minimum_added_physical_damage / attack_maximum_added_physical_damage", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "attack_minimum_added_physical_damage", gearFlat("ring", 5));
    addContribution(statMap, "attack_maximum_added_physical_damage", gearFlat("ring", 10));
    const base = calcBaseDamage({
      isAttack: true,
      damageEffectiveness: 100,
      weapon: { physicalDamageMin: 0, physicalDamageMax: 0 },
      skillFlat: zeroDamageByType(),
      statMap,
    });
    expect(base.physical.min).toBeCloseTo(5, 3);
    expect(base.physical.max).toBeCloseTo(10, 3);
  });

  it("non-attack skills do NOT read attack_-prefixed flat damage", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "attack_minimum_added_physical_damage", gearFlat("ring", 5));
    addContribution(statMap, "attack_maximum_added_physical_damage", gearFlat("ring", 10));
    const base = calcBaseDamage({
      isAttack: false,
      damageEffectiveness: 100,
      weapon: null,
      skillFlat: zeroDamageByType(),
      statMap,
    });
    expect(base.physical.min).toBe(0);
    expect(base.physical.max).toBe(0);
  });

  it("attack-prefixed flat damage is multiplied by effectiveness", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "attack_minimum_added_physical_damage", gearFlat("ring", 10));
    addContribution(statMap, "attack_maximum_added_physical_damage", gearFlat("ring", 20));
    const base = calcBaseDamage({
      isAttack: true,
      damageEffectiveness: 150,
      weapon: null,
      skillFlat: zeroDamageByType(),
      statMap,
    });
    expect(base.physical.min).toBeCloseTo(15, 3); // 10 × 1.5
    expect(base.physical.max).toBeCloseTo(30, 3);
  });

  it("base_ and attack_ flat damage stack for attacks", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "base_physical_damage_min", gearFlat("weapon_mod", 2));
    addContribution(statMap, "attack_minimum_added_physical_damage", gearFlat("ring", 5));
    const base = calcBaseDamage({
      isAttack: true,
      damageEffectiveness: 100,
      weapon: { physicalDamageMin: 10, physicalDamageMax: 20 },
      skillFlat: zeroDamageByType(),
      statMap,
    });
    // (10 weapon + 2 base_ + 5 attack_) × 1.0 = 17
    expect(base.physical.min).toBeCloseTo(17, 3);
  });

  it("attack skills read attack_-prefixed flat damage for elemental types (e.g. fire)", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "attack_minimum_added_fire_damage", gearFlat("ring", 8));
    addContribution(statMap, "attack_maximum_added_fire_damage", gearFlat("ring", 15));
    const base = calcBaseDamage({
      isAttack: true,
      damageEffectiveness: 100,
      weapon: null,
      skillFlat: zeroDamageByType(),
      statMap,
    });
    expect(base.fire.min).toBeCloseTo(8, 3);
    expect(base.fire.max).toBeCloseTo(15, 3);
  });
});

describe("calcCrit", () => {
  it("expectedMulti = 1 + chance * (multi - 1)", () => {
    const statMap = emptyStatMap();
    const out = calcCrit({ baseCritChance: 0.05, baseCritMulti: 1.5, statMap, tags: [] });
    expect(out.expectedMulti).toBeCloseTo(1.025, 4);
  });

  it("clamps chance at 1.0 (100%)", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "critical_strike_chance_+%", {
      value: 10000, kind: "increased", tags: [], source: { type: "gear", id: "x", label: "X" },
    });
    const out = calcCrit({ baseCritChance: 0.2, baseCritMulti: 2, statMap, tags: [] });
    expect(out.chance).toBe(1);
  });

  it("applies flat crit multiplier additions (percent)", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "critical_strike_multiplier_+", {
      value: 50, kind: "flat", tags: [], source: { type: "gear", id: "x", label: "X" },
    });
    const out = calcCrit({ baseCritChance: 0.05, baseCritMulti: 1.5, statMap, tags: [] });
    // baseMulti 1.5 + 50/100 = 2.0
    expect(out.multi).toBeCloseTo(2.0, 4);
  });
});
