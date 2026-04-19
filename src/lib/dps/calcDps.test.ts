import { describe, it, expect } from "vitest";
import { calcDps, snapshotFromPhase } from "./index";
import { bareCrossbowGalvanic } from "./__fixtures__/bareCrossbowGalvanic";
import { bareCrossbowGasGrenade } from "./__fixtures__/bareCrossbowGasGrenade";
import { crossbowFlatPhysRingGalvanic } from "./__fixtures__/crossbowFlatPhysRingGalvanic";
import { crossbowTwoSupportsGalvanic } from "./__fixtures__/crossbowTwoSupportsGalvanic";
import { fullMercenaryBuild } from "./__fixtures__/fullMercenaryBuild";

describe("calcDps — end-to-end", () => {
  it("computes Galvanic Shards DPS for bare crossbow", () => {
    const snap = snapshotFromPhase(bareCrossbowGalvanic, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gs = results[0];
    expect(gs.skillName).toBe("Galvanic Shards");
    expect(gs.level).toBe(1);
    // Hand-calculated with projectile scaling (×8 for Projectile set, ×1 for Beam set):
    //   Projectile set: (1.05–1.80) × 8 = 8.40–14.40
    //   Beam set:       (5.25–9.00) × 1 = 5.25–9.00
    //   Total perHit: min=13.65, max=23.40, avg=18.525
    //   DPS = 18.525 × 1.6 × 1.05 = 31.122
    // See fixture file for base hand-calc without projectile scaling.
    const EXPECTED = 31.122;
    expect(gs.dps).toBeCloseTo(EXPECTED, 0);
  });

  it("has correct per-hit and rate values", () => {
    const snap = snapshotFromPhase(bareCrossbowGalvanic, "", "actual");
    const results = calcDps(snap);
    const gs = results[0];
    // perHit: Projectile(1.05–1.80)×8 + Beam(5.25–9.00)×1 = 13.65–23.40
    expect(gs.perHit.min).toBeCloseTo(13.65, 1);
    expect(gs.perHit.max).toBeCloseTo(23.40, 1);
    // rate = 1000 / 625ms = 1.6/s
    expect(gs.rate).toBeCloseTo(1.6, 4);
    // crit: 5% chance, 2.0x multi
    expect(gs.crit.chance).toBeCloseTo(0.05, 4);
    expect(gs.crit.multi).toBeCloseTo(2.0, 4);
    expect(gs.crit.expectedMulti).toBeCloseTo(1.05, 4);
  });

  it("returns empty array for snapshot with no skills", () => {
    const emptyPhase = { ...bareCrossbowGalvanic, gems: [] };
    const snap = snapshotFromPhase(emptyPhase, "", "actual");
    expect(calcDps(snap)).toHaveLength(0);
  });

  it("computes Gas Grenade DPS for bare crossbow (multi-stat-set)", () => {
    // Impact(dmgMult=40)×1 + PoisonCloud(dmgMult=150)×1 + Explosion(dmgMult=150,100%phys→fire)×1
    // perHit: min=23.80 max=40.80 avg=32.30
    // Gas Grenade skillAttackSpeedMultiplier=-25 → skillRateMult=0.75
    // rate = 1.6 × 0.75 = 1.20, critExpected=1.05
    // DPS = 32.30 × 1.20 × 1.05 ≈ 40.698
    const snap = snapshotFromPhase(bareCrossbowGasGrenade, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gg = results[0];
    expect(gg.skillName).toBe("Gas Grenade");
    const EXPECTED = 40.698;
    expect(gg.dps).toBeCloseTo(EXPECTED, 0);
  });

  it("computes Galvanic Shards DPS with flat-phys ring (ring flat damage stacks)", () => {
    // Ring carries "AddedPhysicalDamage6" (attack_minimum/maximum_added_physical_damage)
    // At 100% roll: min=10, max=17 added to attacks.
    // Weapon phys: 7–12. Effective phys: (7+10)=17 to (12+17)=29.
    // Projectile set (dmgMult=15, 8 projectiles, 60% phys→lightning):
    //   physBase: 17×0.15=2.55–29×0.15=4.35 → phys=1.02–1.74, lightning=1.53–2.61 → ×8 = 20.40–34.80
    // Beam set (dmgMult=75, 1 projectile, 100% phys→lightning):
    //   physBase: 17×0.75=12.75–29×0.75=21.75 → lightning=12.75–21.75
    // Total perHit: min=33.15, max=56.55, avg=44.85
    // DPS = 44.85 × 1.6 × 1.05 ≈ 75.348
    const snap = snapshotFromPhase(crossbowFlatPhysRingGalvanic, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gs = results[0];
    expect(gs.skillName).toBe("Galvanic Shards");
    const EXPECTED = 75.348;
    expect(gs.dps).toBeCloseTo(EXPECTED, 0);
  });

  it("computes Galvanic Shards DPS with two attack-speed supports stacked", () => {
    // Rapid Attacks I (attack_speed_+%=15) + Rapid Attacks II (attack_speed_+%=25)
    // Stacked incAttackSpeed = 40% → rate = 1.6 × 1.40 = 2.24
    // Damage unchanged from bare crossbow (supports only add speed, not damage)
    // DPS = 18.525 × 2.24 × 1.05 ≈ 43.5708
    const snap = snapshotFromPhase(crossbowTwoSupportsGalvanic, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gs = results[0];
    expect(gs.skillName).toBe("Galvanic Shards");
    const EXPECTED = 43.5708;
    expect(gs.dps).toBeCloseTo(EXPECTED, 0);
  });

  it("computes Gas Grenade DPS for full Mercenary build (integration)", () => {
    // Construct Crossbow (physMin=18, physMax=72), Gas Grenade lvl1
    // Rapid Attacks I support (+15% atk speed)
    // Gloves: IncreasedAttackSpeed2 @100% (+10% atk speed)
    // Amulet: CorruptionAllDamage1 @100% (+30% damage inc → totalInc=1.30)
    // avgPerHit = 23.40 + 87.75 + 87.75 = 198.90
    // Gas Grenade skillAttackSpeedMultiplier=-25 → skillRateMult=0.75
    // incSpeed=15+10=25% → rate = 1.6 × 0.75 × 1.25 = 1.50
    // DPS = 198.90 × 1.50 × 1.05 ≈ 313.2675
    const snap = snapshotFromPhase(fullMercenaryBuild, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gg = results[0];
    expect(gg.skillName).toBe("Gas Grenade");
    const EXPECTED = 313.2675;
    expect(gg.dps).toBeCloseTo(EXPECTED, 0);
  });
});
