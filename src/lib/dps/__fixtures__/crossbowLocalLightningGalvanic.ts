import type { BuildPhase } from "../../../types/buildPlan";
import { EMPTY_GEAR_LAYOUT } from "../../../types/buildPlan";

/**
 * Fixture: Makeshift Crossbow + LocalAddedLightningDamageTwoHand2 (max roll) + Galvanic Shards L1.
 *
 * Mod: LocalAddedLightningDamageTwoHand2
 *   Stats: local_minimum_added_lightning_damage (1–2), local_maximum_added_lightning_damage (19–27)
 *   Text: "Adds (1-2) to (19-27) [Lightning|Lightning] Damage"
 *   Valid for crossbow.
 *
 * Roll: 100th percentile → lightningMin=2, lightningMax=27
 *
 * Expected DPS (local added lightning flows through resolveWeaponProperties → calcBaseDamage):
 *   Weapon base phys: 7–12, weapon lightning: 2–27
 *   Projectile stat-set (dmgMult=15, 60% phys→lightning):
 *     phys portion (40%): 7×0.15×0.4=0.42–12×0.15×0.4=0.72
 *     lightning from phys (60%): 7×0.15×0.6=0.63–12×0.15×0.6=1.08
 *     lightning from weapon: 2×0.15=0.30–27×0.15=4.05
 *     total lightning in set: 0.63+0.30=0.93–1.08+4.05=5.13
 *     Stage 2 rounding: phys round(0.42)=0–round(0.72)=1, lightning round(0.93)=1–round(5.13)=5
 *     Set sum: min=0+1=1, max=1+5=6
 *   Beam stat-set (dmgMult=75, 100% phys→lightning):
 *     phys→lightning: 7×0.75=5.25–12×0.75=9.00
 *     weapon lightning: 2×0.75=1.50–27×0.75=20.25
 *     total lightning: 5.25+1.50=6.75–9.00+20.25=29.25
 *     Stage 2 rounding: round(6.75)=7–round(29.25)=29
 *     Set sum: min=7, max=29
 *   Total perHit: min=1+7=8, max=6+29=35, avg=21.5
 *   Cycle rate (1 bolt, 625ms attack, 800ms reload): 0.7018/s
 *   crit expectedMulti = 1.05
 *   DPS = 21.5 × 0.7018 × 1.05 ≈ 15.84
 */
export const crossbowLocalLightningGalvanic: BuildPhase = {
  id: "fixture-crossbow-local-lightning-galvanic",
  name: "Crossbow Local Lightning Galvanic",
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
      desiredModIds: ["LocalAddedLightningDamageTwoHand2"],
      desiredMods: [],
      notes: "",
      modRolls: { LocalAddedLightningDamageTwoHand2: 100 },
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
