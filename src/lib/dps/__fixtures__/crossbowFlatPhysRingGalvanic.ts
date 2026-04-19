import type { BuildPhase } from "../../../types/buildPlan";
import { EMPTY_GEAR_LAYOUT } from "../../../types/buildPlan";

/**
 * Fixture: Makeshift Crossbow + ring with flat-phys-to-attacks mod + Galvanic Shards lvl 1.
 *
 * PURPOSE: Exercises gear-mod flat damage aggregation via attack_-prefixed stat ids.
 * The ring carries mod "AddedPhysicalDamage6" (Adds 6–10 to 12–17 Physical Damage to Attacks)
 * at 100% roll, which resolves to min=10, max=17 via:
 *   attack_minimum_added_physical_damage = 10
 *   attack_maximum_added_physical_damage = 17
 *
 * HAND-CALC:
 *   Weapon phys: 7–12. Flat-added at 100% roll: min=10, max=17.
 *   Effective weapon phys: (7+10)=17 to (12+17)=29.
 *   Galvanic Shards stat sets (same as bareCrossbowGalvanic):
 *     Projectile set (dmgMult=15, 8 projectiles, 60% phys→lightning):
 *       physBase: 17×0.15=2.55 – 29×0.15=4.35
 *       60% converts to lightning → phys=1.02–1.74, lightning=1.53–2.61
 *       ×8 projectiles → 20.40–34.80
 *     Beam set (dmgMult=75, 1 projectile, 100% phys→lightning):
 *       physBase: 17×0.75=12.75 – 29×0.75=21.75
 *       100% converts to lightning → lightning=12.75–21.75
 *       ×1 → 12.75–21.75
 *   Total perHit: min=20.40+12.75=33.15, max=34.80+21.75=56.55
 *   avgPerHit = (33.15+56.55)/2 = 44.85
 *   rate = 1.6, critExpected = 1.05
 *   DPS = 44.85 × 1.6 × 1.05 ≈ 75.348
 */
export const crossbowFlatPhysRingGalvanic: BuildPhase = {
  id: "fixture-crossbow-flat-phys-ring-galvanic",
  name: "Crossbow Flat-Phys Ring Galvanic",
  order: 0,
  trigger: { type: "manual" },
  regexes: [],
  gear: {
    ...EMPTY_GEAR_LAYOUT,
    weapon: {
      id: "fx-weapon",
      slot: "weapon",
      baseItemId: "Metadata/Items/Weapons/TwoHandWeapons/Crossbows/FourCrossbow1",
      base: "Makeshift Crossbow",
      desiredModIds: [],
      desiredMods: [],
      notes: "",
      modRolls: {},
    },
    ring1: {
      id: "fx-ring1",
      slot: "ring1",
      baseItemId: "",
      base: "",
      // "AddedPhysicalDamage6": Adds (6-10) to (12-17) Physical Damage to Attacks
      // stats: attack_minimum_added_physical_damage, attack_maximum_added_physical_damage
      // At 100% roll: min=10, max=17
      desiredModIds: ["AddedPhysicalDamage6"],
      desiredMods: [],
      notes: "",
      modRolls: { AddedPhysicalDamage6: 100 },
    },
  },
  gems: [
    {
      id: "fx-group-1",
      skill: {
        id: "fx-skill-1",
        gemId: "Metadata/Items/Gem/SkillGemGalvanicShards",
        name: "Galvanic Shards",
        category: "skill",
        priority: 0,
        supports: [],
        craftingLevel: 1,
      },
      supports: [],
      priority: 0,
    },
  ],
};
