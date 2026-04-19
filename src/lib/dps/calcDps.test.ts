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
    //   DPS = 18.525 × 1.6 × 1.025 = 30.381
    // See fixture file for base hand-calc without projectile scaling.
    const EXPECTED = 30.381;
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
    // crit: 5% chance, 1.5x multi
    expect(gs.crit.chance).toBeCloseTo(0.05, 4);
    expect(gs.crit.multi).toBeCloseTo(1.5, 4);
    expect(gs.crit.expectedMulti).toBeCloseTo(1.025, 4);
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
    // rate = 1.6 × 0.75 = 1.20, critExpected=1.025
    // DPS = 32.30 × 1.20 × 1.025 ≈ 39.729
    const snap = snapshotFromPhase(bareCrossbowGasGrenade, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gg = results[0];
    expect(gg.skillName).toBe("Gas Grenade");
    const EXPECTED = 39.729;
    expect(gg.dps).toBeCloseTo(EXPECTED, 0);
  });

  it("computes Galvanic Shards DPS with flat-phys ring (engine limitation documented)", () => {
    // Ring carries "AddedPhysicalDamage6" (attack_minimum/maximum_added_physical_damage)
    // Engine Phase 1 only reads base_physical_damage_min/max from gear, so the flat phys
    // contributes 0 and the result equals the bare-crossbow baseline (30.381).
    // See crossbowFlatPhysRingGalvanic fixture JSDoc for the full expected value once
    // attack_*_added_physical_damage is supported by the pipeline.
    const snap = snapshotFromPhase(crossbowFlatPhysRingGalvanic, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gs = results[0];
    expect(gs.skillName).toBe("Galvanic Shards");
    const EXPECTED = 30.381; // same as bare crossbow — ring flat-phys not yet read
    expect(gs.dps).toBeCloseTo(EXPECTED, 0);
  });

  it("computes Galvanic Shards DPS with two attack-speed supports stacked", () => {
    // Rapid Attacks I (attack_speed_+%=15) + Rapid Attacks II (attack_speed_+%=25)
    // Stacked incAttackSpeed = 40% → rate = 1.6 × 1.40 = 2.24
    // Damage unchanged from bare crossbow (supports only add speed, not damage)
    // DPS = 18.525 × 2.24 × 1.025 ≈ 42.533
    const snap = snapshotFromPhase(crossbowTwoSupportsGalvanic, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gs = results[0];
    expect(gs.skillName).toBe("Galvanic Shards");
    const EXPECTED = 42.533;
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
    // DPS = 198.90 × 1.50 × 1.025 ≈ 305.809
    const snap = snapshotFromPhase(fullMercenaryBuild, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gg = results[0];
    expect(gg.skillName).toBe("Gas Grenade");
    const EXPECTED = 305.809;
    expect(gg.dps).toBeCloseTo(EXPECTED, 0);
  });
});
