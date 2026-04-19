import type { BuildPhase } from "../../../types/buildPlan";
import { EMPTY_GEAR_LAYOUT } from "../../../types/buildPlan";

/**
 * Post Task 17.11: this fixture now matches PoB's two-stage rounding output exactly.
 *
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
 * Expected DPS (local mods applied via resolveWeaponProperties, PoB two-stage rounding):
 *   Stage 1 — weapon rounding: 7×1.49=10.43→10, 12×1.49=17.88→18.
 *   Projectile set (dmgMult=15, per-projectile, 60% phys→lightning):
 *     phys=10×0.15=1.50–18×0.15=2.70; phys(40%)=0.60–1.08, lightning(60%)=0.90–1.62
 *     Stage 2 — per-type rounding: round(0.60)=1, round(0.90)=1; round(1.08)=1, round(1.62)=2
 *     Sum for set: 2–3
 *   Beam set (dmgMult=75, 100% phys→lightning):
 *     lightning=10×0.75=7.50–18×0.75=13.50
 *     Stage 2 — per-type rounding: round(7.5)=8, round(13.5)=14
 *     Sum for set: 8–14
 *   Total perHit: min=2+8=10, max=3+14=17, avgPerHit=13.5
 *   Cycle rate (1 bolt, 625ms attack, 800ms reload): 0.7018/s
 *   crit expectedMulti = 1.05
 *   DPS = 13.5 × 0.7018 × 1.05 ≈ 9.95
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
