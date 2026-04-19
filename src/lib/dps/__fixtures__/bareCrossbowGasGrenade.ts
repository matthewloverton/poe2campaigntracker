import type { BuildPhase } from "../../../types/buildPlan";
import { EMPTY_GEAR_LAYOUT } from "../../../types/buildPlan";

/**
 * Fixture: bare Makeshift Crossbow + Gas Grenade lvl 1, no supports, no gear mods.
 *
 * Same weapon as bareCrossbowGalvanic so the weapon-side math is identical;
 * this fixture isolates Gas Grenade's multi-stat-set behaviour.
 *
 * Resolved from data (src/data/raw/skill_gems.json):
 *
 * Weapon: "Metadata/Items/Weapons/TwoHandWeapons/Crossbows/FourCrossbow1" (Makeshift Crossbow)
 *   - physicalDamageMin: 7,  physicalDamageMax: 12
 *   - attackTime: 625 ms
 *   - criticalStrikeChance: 500 (= 5.00%, stored as hundredths-of-percent)
 *
 * Gas Grenade: "Metadata/Items/Gem/SkillGemGasGrenade"
 *   - activeSkillTypes: ["Attack", "RangedAttack", "Area", "ProjectileNumber",
 *       "ProjectileSpeed", "Cooldown", "Duration", "Grenade", "Chaos", "Fire",
 *       "UsableWhileMoving", "CreatesGroundEffect", "Limit", "Projectile",
 *       "DetonatesAfterTime"]
 *   - 3 stat sets at level 1:
 *       Impact:      damageMultiplier=40,  no base_number_of_projectiles (→ 1)
 *       Poison Cloud: damageMultiplier=150, no base_number_of_projectiles (→ 1)
 *       Explosion:   damageMultiplier=150, active_skill_base_physical_damage_%_to_convert_to_fire=100
 *
 * Note: Gas Grenade IS tagged "Projectile" so the engine calls projectileCount() for
 * each stat set. Since none define base_number_of_projectiles, the engine defaults to 1
 * for all three sets (unlike Galvanic Shards' Projectile set which has 8).
 *
 * Hand-calculation (bare, no mods, no supports):
 *
 *   Impact set (dmgMult=40, projectiles=1):
 *     physBase: 7×0.40=2.80 – 12×0.40=4.80
 *     No conversion stats → stays physical: 2.80–4.80
 *     ×1 projectile → perHit contribution: 2.80–4.80, avg=3.80
 *
 *   Poison Cloud set (dmgMult=150, projectiles=1):
 *     physBase: 7×1.50=10.50 – 12×1.50=18.00
 *     No conversion stats → stays physical: 10.50–18.00
 *     ×1 projectile → perHit contribution: 10.50–18.00, avg=14.25
 *
 *   Explosion set (dmgMult=150, projectiles=1, 100% phys→fire):
 *     physBase: 7×1.50=10.50 – 12×1.50=18.00
 *     100% convert phys→fire: phys=0, fire=10.50–18.00
 *     ×1 projectile → perHit contribution (fire): 10.50–18.00, avg=14.25
 *
 *   Total perHit: min=2.80+10.50+10.50=23.80, max=4.80+18.00+18.00=40.80
 *   avgPerHit = (23.80+40.80)/2 = 32.30
 *
 *
 *   skillAttackSpeedMultiplier = -25 (percent adjustment → 1 + (-25)/100 = 0.75)
 *   rate = (1000/625) × 0.75 = 1.6 × 0.75 = 1.20 attacks/s
 *
 *   crit: chance=500/10000=0.05, multi=2.0
 *     expectedMulti = 1 + 0.05×(2.0−1) = 1.05
 *
 *   DPS = 32.30 × 1.20 × 1.05 ≈ 40.698
 */
export const bareCrossbowGasGrenade: BuildPhase = {
  id: "fixture-bare-crossbow-gas-grenade",
  name: "Bare Crossbow Gas Grenade",
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
  },
  gems: [
    {
      id: "fx-group-1",
      skill: {
        id: "fx-skill-1",
        gemId: "Metadata/Items/Gem/SkillGemGasGrenade",
        name: "Gas Grenade",
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
