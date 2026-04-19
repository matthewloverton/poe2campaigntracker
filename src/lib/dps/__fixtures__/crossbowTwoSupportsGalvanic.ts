import type { BuildPhase } from "../../../types/buildPlan";
import { EMPTY_GEAR_LAYOUT } from "../../../types/buildPlan";

/**
 * Fixture: Makeshift Crossbow + Galvanic Shards lvl 1 + two support gems.
 *
 * PURPOSE: Exercises support-gem stat aggregation and tag-filter compatibility.
 * Both supports apply to Galvanic Shards (which includes the "Attack" type that
 * Rapid Attacks I requires).
 *
 * Supports chosen:
 *   Rapid Attacks I  (Metadata/Items/Gems/SupportGemMartialTempo)
 *     - allowedActiveSkillTypes: ["Attack", "CrossbowAmmoSkill"]
 *     - level-1 stats: { attack_speed_+%: 15 }  → increased attack speed
 *   Rapid Attacks II (Metadata/Items/Gems/SupportGemMartialTempoTwo)
 *     - allowedActiveSkillTypes: ["Attack", "CrossbowAmmoSkill"]
 *     - level-1 stats: { attack_speed_+%: 25 }  → increased attack speed
 *
 * NOTE ON SUPPORT STAT ID COVERAGE:
 *   Most support gems with damage bonuses use custom prefixed stat IDs such as
 *   "support_gem_elemental_damage_+%_final" or "support_brutality_physical_damage_+%_final".
 *   These are NOT read by the engine's applyMultipliers (which reads "damage_+%_final"
 *   and type-specific variants only). The Rapid Attacks pair was chosen because their
 *   stat "attack_speed_+%" IS handled by calcRate via sumInc(map, "attack_speed_+%", ...).
 *   This pair cleanly tests additive stacking of the same stat from two sources.
 *
 * Hand-calculation:
 *   Weapon + Galvanic Shards damage (stat sets) — identical to bareCrossbowGalvanic:
 *     Projectile set (dmgMult=15, 8 projectiles, 60% phys→lightning):
 *       perHit: 8.40–14.40
 *     Beam set (dmgMult=75, 1 projectile, 100% phys→lightning):
 *       perHit: 5.25–9.00
 *     Total perHit: min=13.65, max=23.40
 *     avgPerHit = (13.65+23.40)/2 = 18.525
 *
 *   Supports contribute only to attack speed (not damage):
 *     incAttackSpeed = 15 + 25 = 40%
 *     rate = (1000/625) × (1 + 40/100) = 1.6 × 1.4 = 2.24 attacks/s
 *
 *   crit: chance=0.05, multi=1.5, expectedMulti=1.025
 *
 *   DPS = 18.525 × 2.24 × 1.025 ≈ 42.533
 */
export const crossbowTwoSupportsGalvanic: BuildPhase = {
  id: "fixture-crossbow-two-supports-galvanic",
  name: "Crossbow Two Supports Galvanic",
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
        {
          id: "fx-sup-2",
          gemId: "Metadata/Items/Gems/SupportGemMartialTempoTwo",
          name: "Rapid Attacks II",
          category: "support",
          priority: 1,
          supports: [],
          craftingLevel: 1,
        },
      ],
      priority: 0,
    },
  ],
};
