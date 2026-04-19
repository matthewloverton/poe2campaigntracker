import type { BuildPhase } from "../../../types/buildPlan";
import { EMPTY_GEAR_LAYOUT } from "../../../types/buildPlan";

/**
 * Fixture: mid-campaign Mercenary build — Construct Crossbow, Gas Grenade, one support,
 * attack-speed gloves, damage amulet.
 *
 * PURPOSE: Integration test across multiple gear slots, one support gem, and a
 * multi-stat-set skill. Expects ~8× DPS vs bareCrossbowGalvanic due to better weapon
 * and gear/support buffs.
 *
 * Weapon: "Metadata/Items/Weapons/TwoHandWeapons/Crossbows/FourCrossbow8" (Construct Crossbow)
 *   - physicalDamageMin: 18,  physicalDamageMax: 72
 *   - attackTime: 625 ms
 *   - criticalStrikeChance: 500 (= 5.00%)
 *
 * Skill: Gas Grenade ("Metadata/Items/Gem/SkillGemGasGrenade"), level 1
 *   (3 stat sets — same as bareCrossbowGasGrenade; see that fixture for stat-set details)
 *
 * Support: Rapid Attacks I ("Metadata/Items/Gems/SupportGemMartialTempo")
 *   - level-1 stats: { attack_speed_+%: 15 }  → increased attack speed
 *
 * Gear mods (all at modRolls: 100 for maximum clean values):
 *   Gloves slot — IncreasedAttackSpeed2 (attack_speed_+%: 8..10, at 100% = 10)
 *   Amulet slot — CorruptionAllDamage1  (damage_+%: 20..30, at 100% = 30)
 *
 * NOTE: "AddedPhysicalDamage6" (flat phys to attacks) is intentionally excluded because
 *   its stat IDs ("attack_minimum_added_physical_damage" etc.) are not yet read by the
 *   engine. See crossbowFlatPhysRingGalvanic for that documented limitation.
 *
 * Hand-calculation:
 *
 *   Damage buffs from gear:
 *     CorruptionAllDamage1 at 100%: damage_+% = 30
 *     statKindForId("damage_+%") → "increased" (ends with _+% but not _final)
 *     applyMultipliers: globalInc = 30, typeInc = 0 for each type
 *     totalInc = 1 + (30)/100 = 1.30
 *
 *   Impact set (dmgMult=40, projectiles=1):
 *     physBase: 18×0.40=7.20 – 72×0.40=28.80
 *     after inc: 7.20×1.30=9.36 – 28.80×1.30=37.44
 *     ×1 → avg = (9.36+37.44)/2 = 23.40
 *
 *   Poison Cloud set (dmgMult=150, projectiles=1):
 *     physBase: 18×1.50=27.00 – 72×1.50=108.00
 *     after inc: 27.00×1.30=35.10 – 108.00×1.30=140.40
 *     ×1 → avg = (35.10+140.40)/2 = 87.75
 *
 *   Explosion set (dmgMult=150, projectiles=1, 100% phys→fire):
 *     physBase: 18×1.50=27.00 – 72×1.50=108.00
 *     100% convert phys→fire → fire: 27.00–108.00
 *     after inc: 27.00×1.30=35.10 – 108.00×1.30=140.40
 *     ×1 → avg = 87.75
 *
 *   Total avgPerHit = 23.40 + 87.75 + 87.75 = 198.90
 *
 *   Attack speed:
 *     Gas Grenade skillAttackSpeedMultiplier = -25 → factor = 1 + (-25)/100 = 0.75
 *     Support Rapid Attacks I: attack_speed_+% = 15  (increased)
 *     Gloves IncreasedAttackSpeed2 at 100%: attack_speed_+% = 10  (increased)
 *     incSpeed = 15 + 10 = 25%  →  (1 + 25/100) = 1.25
 *     rate = (1000/625) × 0.75 × 1.25 = 1.6 × 0.75 × 1.25 = 1.50 attacks/s
 *
 *   crit: chance=0.05, multi=2.0, expectedMulti=1.05
 *
 *   DPS = 198.90 × 1.50 × 1.05 ≈ 313.2675
 */
export const fullMercenaryBuild: BuildPhase = {
  id: "fixture-full-mercenary-build",
  name: "Full Mercenary Build",
  order: 0,
  trigger: { type: "manual" },
  regexes: [],
  gear: {
    ...EMPTY_GEAR_LAYOUT,
    weapon: {
      id: "fx-weapon",
      slot: "weapon",
      baseItemId: "Metadata/Items/Weapons/TwoHandWeapons/Crossbows/FourCrossbow8",
      base: "Construct Crossbow",
      desiredModIds: [],
      desiredMods: [],
      notes: "",
      modRolls: {},
    },
    gloves: {
      id: "fx-gloves",
      slot: "gloves",
      baseItemId: "",
      base: "",
      // IncreasedAttackSpeed2: (8-10)% increased Attack Speed
      // stats: { attack_speed_+%: min=8, max=10 }
      // at 100% roll: value = 10
      desiredModIds: ["IncreasedAttackSpeed2"],
      desiredMods: [],
      notes: "",
      modRolls: { IncreasedAttackSpeed2: 100 },
    },
    amulet: {
      id: "fx-amulet",
      slot: "amulet",
      baseItemId: "",
      base: "",
      // CorruptionAllDamage1: (20-30)% increased Damage
      // stats: { damage_+%: min=20, max=30 }
      // at 100% roll: value = 30
      desiredModIds: ["CorruptionAllDamage1"],
      desiredMods: [],
      notes: "",
      modRolls: { CorruptionAllDamage1: 100 },
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
      supports: [
        {
          id: "fx-sup-1",
          gemId: "Metadata/Items/Gems/SupportGemMartialTempo",
          name: "Rapid Attacks I",
          category: "support",
          priority: 0,
          supports: [],
          craftingLevel: 1,
        },
      ],
      priority: 0,
    },
  ],
};
