import type { BuildPhase } from "../../../types/buildPlan";
import { EMPTY_GEAR_LAYOUT } from "../../../types/buildPlan";

/**
 * Fixture: Makeshift Crossbow + 49% local increased physical damage (max roll) + Galvanic Shards L1.
 *
 * Mod: LocalIncreasedPhysicalDamagePercent1 (mod id)
 *   Stat id: local_physical_damage_+%
 *   Text: "(40-49)% increased Physical Damage"
 *   Tags: ["physical_damage", "damage", "physical", "attack"]
 *
 * Roll: 100th percentile → 49% (range is 40–49; max = 49, not 40).
 *   For a strict "40%" fixture, use modRolls: { LocalIncreasedPhysicalDamagePercent1: 0 }.
 *
 * Expected DPS (local mods applied via resolveWeaponProperties, PoB-equivalent):
 *   Base weapon phys: 7–12. With 49% local inc phys: 7×1.49=10.43 – 12×1.49=17.88.
 *   Projectile set (dmgMult=15, 8 projectiles, 60% phys→lightning):
 *     perProjectile: 10.43×0.15=1.5645 – 17.88×0.15=2.682
 *     ×8 = 12.516 – 21.456
 *   Beam set (dmgMult=75, 1 projectile, 100% phys→lightning):
 *     physBase: 10.43×0.75=7.8225 – 17.88×0.75=13.41
 *     ×1 = 7.8225 – 13.41
 *   Total perHit: min=20.3385, max=34.866
 *   avgPerHit = (20.3385+34.866)/2 = 27.6023
 *   DPS = 27.6023 × 1.6 × 1.05 ≈ 46.372
 */
export const crossbowLocalIncPhysGalvanic: BuildPhase = {
  id: "fixture-crossbow-local-inc-phys-galvanic",
  name: "Crossbow Local Inc Phys Galvanic",
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
      desiredModIds: ["LocalIncreasedPhysicalDamagePercent1"],
      desiredMods: [],
      notes: "",
      modRolls: { LocalIncreasedPhysicalDamagePercent1: 100 },
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
