import type { BuildPhase } from "../../../types/buildPlan";
import { EMPTY_GEAR_LAYOUT } from "../../../types/buildPlan";

/**
 * Fixture: a bare Makeshift Crossbow (lowest-level base) + Galvanic Shards at level 1, no supports.
 * Used as the engine's first end-to-end golden-number test.
 *
 * Resolved from data (src/data/raw/base_items.json, src/data/raw/skill_gems.json):
 *
 * Weapon: "Metadata/Items/Weapons/TwoHandWeapons/Crossbows/FourCrossbow1" (Makeshift Crossbow)
 *   - physicalDamageMin: 7,  physicalDamageMax: 12
 *   - attackTime: 625 ms
 *   - criticalStrikeChance: 500 (= 5.00%, stored as hundredths-of-percent)
 *
 * Galvanic Shards: "Metadata/Items/Gem/SkillGemGalvanicShards"
 *   - activeSkillTypes: ["Attack", ...] → isAttack = true
 *   - attackSpeedMultiplier: undefined → treated as 1.0
 *   - 3 stat sets, level 1 damage multipliers:
 *       Ammunition: undefined → SKIPPED (no damage contribution)
 *       Projectile: 15  → effectiveness = 0.15, converts 60% phys → lightning
 *       Beam:       75  → effectiveness = 0.75, converts 100% phys → lightning
 *
 * Hand-calculation (bare, no mods, no supports):
 *
 *   Projectile set (dmgMult=15, base_number_of_projectiles=8):
 *     basePhys: 7*0.15=1.05 – 12*0.15=1.80
 *     convert 60% → lightning: phys=0.42–0.72, lightning=0.63–1.08
 *     perProjectile: 1.05 – 1.80 (total unchanged by conversion)
 *     × 8 projectiles → perHit contribution: 8.40 – 14.40
 *
 *   Beam set (dmgMult=75, no base_number_of_projectiles → 1 projectile):
 *     basePhys: 7*0.75=5.25 – 12*0.75=9.00
 *     convert 100% → lightning: phys=0, lightning=5.25–9.00
 *     × 1 projectile → perHit contribution: 5.25 – 9.00
 *
 *   Total perHit: min=8.40+5.25=13.65, max=14.40+9.00=23.40
 *   avgPerHit = (13.65 + 23.40) / 2 = 18.525
 *
 *   rate = 1000 / 625 = 1.6 attacks/s
 *
 *   crit: chance=500/10000=0.05, multi=2.0
 *     expectedMulti = 1 + 0.05*(2.0-1) = 1.05
 *
 *   DPS = 18.525 × 1.6 × 1.05 = 31.122
 */
export const bareCrossbowGalvanic: BuildPhase = {
  id: "fixture-bare-crossbow-galvanic",
  name: "Bare Crossbow Galvanic",
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
