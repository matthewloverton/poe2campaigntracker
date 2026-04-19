import type { BuildPhase } from "../../../types/buildPlan";
import { EMPTY_GEAR_LAYOUT } from "../../../types/buildPlan";

/**
 * Fixture: Makeshift Crossbow + LocalAddedLightningDamageTwoHand1_ ("Adds 1 to 7-10") at
 * roll≈66 → lightningMin=1, lightningMax=9, + Galvanic Shards level 5, quality 0.
 *
 * This is the exact PoB parity scenario from the forensic investigation:
 *   Weapon base phys: 7–12, weapon lightning: 1–9
 *   Roll for max: rollValue(7, 10, 66) = 8.98 → Math.round → 9
 *
 * PoB verified outputs (screenshots):
 *   Projectile stat set (dmgMult=21, 60% phys→lightning):
 *     base.phys = {7×0.21=1.47, 12×0.21=2.52}
 *     base.light = {1×0.21=0.21, 9×0.21=1.89}
 *     convertedFromPhys = {1.47×0.6=0.882→round=1, 2.52×0.6=1.512→round=2}  ← PoB intermediate round
 *     phys retained = {1.47×0.4=0.588, 2.52×0.4=1.008} → final round: 1, 1
 *     light total = {0.21+1=1.21, 1.89+2=3.89} → final round: 1, 4
 *     Projectile perHit: Phys 1–1, Light 1–4, total 2–5, avg 3.5, DPS 2.58
 *
 *   Beam stat set (dmgMult=107, 100% phys→lightning):
 *     base.phys = {7.49, 12.84}
 *     base.light = {1.07, 9.63}
 *     convertedFromPhys = {7.49→round=7, 12.84→round=13}
 *     light total = {1.07+7=8.07, 9.63+13=22.63} → final round: 8, 23
 *     Beam perHit: Light 8–23, avg 15.5, DPS 11.42
 *
 *   Total perHit: min=2+8=10, max=5+23=28, avg=19.0
 *   Cycle rate (1 bolt, 625ms attack, 800ms reload): 1/(1/1.6+0.8) = 0.7018/s
 *   crit expectedMulti = 1.05
 *   DPS = 19.0 × 0.7018 × 1.05 ≈ 14.0
 *
 * Previously our engine showed Light 1–3 for projectile (not 1–4) because applyConversions
 * lacked intermediate rounding of converted amounts. The fix (matching PoB's calcConvertedDamage)
 * rounds converted amounts per target type before adding to retained base.
 */
export const crossbowLocalLightningL5Galvanic: BuildPhase = {
  id: "fixture-crossbow-local-lightning-l5-galvanic",
  name: "Crossbow Local Lightning L5 Galvanic",
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
      desiredModIds: ["LocalAddedLightningDamageTwoHand1_"],
      desiredMods: [],
      notes: "",
      // roll≈66 → lightningMax = Math.round(rollValue(7, 10, 66)) = Math.round(8.98) = 9
      modRolls: { LocalAddedLightningDamageTwoHand1_: 66 },
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
        craftingLevel: 5,
        skillLevel: 5,
      },
      supports: [],
      priority: 0,
    },
  ],
};
