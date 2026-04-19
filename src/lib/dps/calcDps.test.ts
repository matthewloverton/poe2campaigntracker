import { describe, it, expect } from "vitest";
import { calcDps, snapshotFromPhase } from "./index";
import { bareCrossbowGalvanic } from "./__fixtures__/bareCrossbowGalvanic";
import { bareCrossbowGasGrenade } from "./__fixtures__/bareCrossbowGasGrenade";
import { crossbowFlatPhysRingGalvanic } from "./__fixtures__/crossbowFlatPhysRingGalvanic";
import { crossbowTwoSupportsGalvanic } from "./__fixtures__/crossbowTwoSupportsGalvanic";
import { fullMercenaryBuild } from "./__fixtures__/fullMercenaryBuild";
import { crossbowLocalIncPhysGalvanic } from "./__fixtures__/crossbowLocalIncPhysGalvanic";

describe("calcDps — end-to-end", () => {
  it("computes Galvanic Shards DPS for bare crossbow", () => {
    const snap = snapshotFromPhase(bareCrossbowGalvanic, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gs = results[0];
    expect(gs.skillName).toBe("Galvanic Shards");
    expect(gs.level).toBe(1);
    // Per-projectile DPS (PoB default — one projectile hits the target):
    //   Projectile set: (1.05–1.80) × 1 = 1.05–1.80
    //   Beam set:       (5.25–9.00) × 1 = 5.25–9.00
    //   Total perHit: min=6.30, max=10.80, avg=8.55
    //   DPS = 8.55 × 1.6 × 1.05 ≈ 14.364
    // Note: per-projectile DPS (PoB default). Projectile count of 8 is informational.
    // See fixture file for base hand-calc without projectile scaling.
    const EXPECTED = 14.364;
    expect(gs.dps).toBeCloseTo(EXPECTED, 0);
  });

  it("has correct per-hit and rate values", () => {
    const snap = snapshotFromPhase(bareCrossbowGalvanic, "", "actual");
    const results = calcDps(snap);
    const gs = results[0];
    // perHit: Projectile(1.05–1.80)×1 + Beam(5.25–9.00)×1 = 6.30–10.80
    // Note: per-projectile DPS (PoB default). Projectile count of 8 is informational.
    expect(gs.perHit.min).toBeCloseTo(6.30, 1);
    expect(gs.perHit.max).toBeCloseTo(10.80, 1);
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
    // Per-projectile DPS (PoB default — one projectile hits the target):
    // Ring carries "AddedPhysicalDamage6" (attack_minimum/maximum_added_physical_damage)
    // At 100% roll: min=10, max=17 added to attacks.
    // Weapon phys: 7–12. Effective phys: (7+10)=17 to (12+17)=29.
    // Projectile set (dmgMult=15, ×1, 60% phys→lightning):
    //   physBase: 17×0.15=2.55 to 29×0.15=4.35 => phys=1.02–1.74, lightning=1.53–2.61
    // Beam set (dmgMult=75, ×1, 100% phys→lightning):
    //   physBase: 17×0.75=12.75 to 29×0.75=21.75 => lightning=12.75–21.75
    // Total perHit: min=15.30, max=26.10, avg=20.70
    // DPS = 20.70 × 1.6 × 1.05 ≈ 34.776
    // Note: per-projectile DPS (PoB default). Projectile count of 8 is informational.
    const snap = snapshotFromPhase(crossbowFlatPhysRingGalvanic, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gs = results[0];
    expect(gs.skillName).toBe("Galvanic Shards");
    const EXPECTED = 34.776;
    expect(gs.dps).toBeCloseTo(EXPECTED, 0);
  });

  it("computes Galvanic Shards DPS with two attack-speed supports stacked", () => {
    // Per-projectile DPS (PoB default — one projectile hits the target):
    // Rapid Attacks I (attack_speed_+%=15) + Rapid Attacks II (attack_speed_+%=25)
    // Stacked incAttackSpeed = 40% → rate = 1.6 × 1.40 = 2.24
    // Damage unchanged from bare crossbow (supports only add speed, not damage)
    // perHit: min=6.30, max=10.80, avg=8.55
    // DPS = 8.55 × 2.24 × 1.05 ≈ 20.1096
    // Note: per-projectile DPS (PoB default). Projectile count of 8 is informational.
    const snap = snapshotFromPhase(crossbowTwoSupportsGalvanic, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gs = results[0];
    expect(gs.skillName).toBe("Galvanic Shards");
    const EXPECTED = 20.1096;
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

it("applies local_physical_damage_+% to weapon base before skill formula (crossbow + Heavy prefix)", () => {
  // Per-projectile DPS (PoB default — one projectile hits the target):
  // Makeshift Crossbow (7–12 phys) + LocalIncreasedPhysicalDamagePercent1 at 100th percentile (49%)
  // Resolved weapon phys: 7×1.49=10.43 – 12×1.49=17.88
  // Projectile set (dmgMult=15, ×1): 1.5645–2.682
  // Beam set (dmgMult=75, ×1): 7.8225–13.41
  // perHit: min=9.387, max=16.092, avg=12.7395
  // DPS = 12.7395 × 1.6 × 1.05 ≈ 21.402
  // Note: per-projectile DPS (PoB default). Projectile count of 8 is informational.
  const snap = snapshotFromPhase(crossbowLocalIncPhysGalvanic, "", "actual");
  const results = calcDps(snap);
  expect(results.length).toBe(1);
  const r = results[0];
  const EXPECTED = 21.402;
  expect(r.dps).toBeCloseTo(EXPECTED, 0);
  // Confirm local mod increased the DPS beyond bare crossbow (14.364).
  expect(r.dps).toBeGreaterThan(14);
});
