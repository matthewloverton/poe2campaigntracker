import { describe, it, expect } from "vitest";
import { calcDps, snapshotFromPhase } from "./index";
import { bareCrossbowGalvanic } from "./__fixtures__/bareCrossbowGalvanic";
import { bareCrossbowGasGrenade } from "./__fixtures__/bareCrossbowGasGrenade";
import { crossbowFlatPhysRingGalvanic } from "./__fixtures__/crossbowFlatPhysRingGalvanic";
import { crossbowTwoSupportsGalvanic } from "./__fixtures__/crossbowTwoSupportsGalvanic";
import { fullMercenaryBuild } from "./__fixtures__/fullMercenaryBuild";
import { crossbowLocalIncPhysGalvanic } from "./__fixtures__/crossbowLocalIncPhysGalvanic";
import { crossbowLocalLightningGalvanic } from "./__fixtures__/crossbowLocalLightningGalvanic";
import { crossbowLocalLightningL5Galvanic } from "./__fixtures__/crossbowLocalLightningL5Galvanic";

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
    //   Firing rate: 1000/625ms = 1.6/s
    //   Cycle rate (1 bolt, 800ms reload): 1 / (1/1.6 + 0.8) = 1/1.425 = 0.7018/s
    //   DPS = 8.55 × 0.7018 × 1.05 ≈ 6.30  (matches PoB: 6.3)
    // Note: per-projectile DPS (PoB default). Projectile count of 8 is informational.
    // See fixture file for base hand-calc without projectile scaling.
    const EXPECTED = 6.30;
    expect(gs.dps).toBeCloseTo(EXPECTED, 0);
  });

  it("has correct per-hit and rate values", () => {
    const snap = snapshotFromPhase(bareCrossbowGalvanic, "", "actual");
    const results = calcDps(snap);
    const gs = results[0];
    // Post Task 17.11 two-stage rounding:
    //   Projectile set (dmgMult=15, 60% phys→lightning):
    //     phys=0.42–0.72 → round(0.42)=0, round(0.72)=1
    //     lightning=0.63–1.08 → round(0.63)=1, round(1.08)=1
    //     per-type sum: 0+1=1 – 1+1=2
    //   Beam set (dmgMult=75, 100% phys→lightning):
    //     lightning=5.25–9.00 → round(5.25)=5, round(9.00)=9
    //   Total perHit: min=1+5=6, max=2+9=11
    // Note: per-projectile DPS (PoB default). Projectile count of 8 is informational.
    expect(gs.perHit.min).toBeCloseTo(6, 0);
    expect(gs.perHit.max).toBeCloseTo(11, 0);
    // cycle rate: 1 bolt, 625ms attack (1.6/s firing), 800ms reload
    // = 1 / (1/1.6 + 0.8) = 1/1.425 ≈ 0.7018/s  (matches PoB MH Att. per second: 0.70)
    expect(gs.rate).toBeCloseTo(0.7018, 3);
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
    // Post Task 17.11 two-stage rounding:
    //   Impact(dmgMult=40): phys=2.80–4.80 → round(2.80)=3, round(4.80)=5 → sum=3–5
    //   PoisonCloud(dmgMult=150): phys=10.50–18.00 → round(10.5)=11, round(18.0)=18 → sum=11–18
    //   Explosion(dmgMult=150, 100%phys→fire): fire=10.50–18.00 → round(10.5)=11, round(18.0)=18 → sum=11–18
    //   Total perHit: min=3+11+11=25, max=5+18+18=41, avg=33.0
    //   Gas Grenade skillAttackSpeedMultiplier=-25 → skillRateMult=0.75
    //   rate = 1.6 × 0.75 = 1.20, critExpected=1.05
    //   DPS = 33.0 × 1.20 × 1.05 = 41.58
    const snap = snapshotFromPhase(bareCrossbowGasGrenade, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gg = results[0];
    expect(gg.skillName).toBe("Gas Grenade");
    const EXPECTED = 41.58;
    expect(gg.dps).toBeCloseTo(EXPECTED, 0);
  });

  it("computes Galvanic Shards DPS with flat-phys ring (ring flat damage stacks)", () => {
    // Per-projectile DPS (PoB default — one projectile hits the target):
    // Post Task 17.11 two-stage rounding:
    // Ring carries "AddedPhysicalDamage6" (attack_minimum/maximum_added_physical_damage)
    // At 100% roll: min=10, max=17 added to attacks.
    // Weapon phys: 7–12. Effective phys: (7+10)=17 to (12+17)=29.
    // Projectile set (dmgMult=15, 60% phys→lightning):
    //   physBase: 17×0.15=2.55 – 29×0.15=4.35
    //   phys(40%)=1.02–1.74, lightning(60%)=1.53–2.61
    //   round(1.02)=1, round(1.53)=2; round(1.74)=2, round(2.61)=3 → sum=3–5
    // Beam set (dmgMult=75, 100% phys→lightning):
    //   lightning=12.75–21.75 → round(12.75)=13, round(21.75)=22 → sum=13–22
    // Total perHit: min=3+13=16, max=5+22=27, avg=21.5
    // Cycle rate (1 bolt, 800ms reload): 1 / (1/1.6 + 0.8) = 0.7018/s
    // DPS = 21.5 × 0.7018 × 1.05 ≈ 15.84
    // Note: per-projectile DPS (PoB default). Projectile count of 8 is informational.
    const snap = snapshotFromPhase(crossbowFlatPhysRingGalvanic, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gs = results[0];
    expect(gs.skillName).toBe("Galvanic Shards");
    const EXPECTED = 15.84;
    expect(gs.dps).toBeCloseTo(EXPECTED, 0);
  });

  it("computes Galvanic Shards DPS with two attack-speed supports stacked", () => {
    // Per-projectile DPS (PoB default — one projectile hits the target):
    // Rapid Attacks I (attack_speed_+%=15) + Rapid Attacks II (attack_speed_+%=25)
    // Stacked incAttackSpeed = 40% → firing rate = 1.6 × 1.40 = 2.24/s
    // Cycle rate (1 bolt, 800ms reload): 1 / (1/2.24 + 0.8) = 1/1.2464 ≈ 0.8023/s
    // Damage unchanged from bare crossbow (supports only add speed, not damage)
    // perHit: min=6.30, max=10.80, avg=8.55
    // DPS = 8.55 × 0.8023 × 1.05 ≈ 7.20
    // Note: per-projectile DPS (PoB default). Projectile count of 8 is informational.
    const snap = snapshotFromPhase(crossbowTwoSupportsGalvanic, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gs = results[0];
    expect(gs.skillName).toBe("Galvanic Shards");
    const EXPECTED = 7.20;
    expect(gs.dps).toBeCloseTo(EXPECTED, 0);
  });

  it("computes Gas Grenade DPS for full Mercenary build (integration)", () => {
    // Post Task 17.11 two-stage rounding:
    // Construct Crossbow (physMin=18, physMax=72), Gas Grenade lvl1
    // Rapid Attacks I support (+15% atk speed)
    // Gloves: IncreasedAttackSpeed2 @100% (+10% atk speed)
    // Amulet: CorruptionAllDamage1 @100% (+30% damage inc → totalInc=1.30)
    //   Impact(dmgMult=40): phys=7.20–28.80 × 1.30=9.36–37.44 → round(9.36)=9, round(37.44)=37 → 9–37
    //   PoisonCloud(dmgMult=150): phys=27.00–108.00 × 1.30=35.10–140.40 → round=35–140 → 35–140
    //   Explosion(dmgMult=150, 100%→fire): fire=35.10–140.40 → round=35–140 → 35–140
    //   Total perHit: min=9+35+35=79, max=37+140+140=317, avg=198.0
    // Gas Grenade skillAttackSpeedMultiplier=-25 → skillRateMult=0.75
    // incSpeed=15+10=25% → rate = 1.6 × 0.75 × 1.25 = 1.50
    // DPS = 198.0 × 1.50 × 1.05 = 311.85
    const snap = snapshotFromPhase(fullMercenaryBuild, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gg = results[0];
    expect(gg.skillName).toBe("Gas Grenade");
    const EXPECTED = 311.85;
    expect(gg.dps).toBeCloseTo(EXPECTED, 0);
  });
});

it("honours explicit skillLevel override", () => {
  const phase = {
    ...bareCrossbowGalvanic,
    gems: bareCrossbowGalvanic.gems.map((g) => ({
      ...g,
      skill: { ...g.skill, skillLevel: 5 },
    })),
  };
  const snap = snapshotFromPhase(phase, "", "actual");
  const [r] = calcDps(snap);
  expect(r.level).toBe(5);
  // DPS at L5 ≠ DPS at L1 — sanity check it actually scaled up
  expect(r.dps).toBeGreaterThan(7); // bare L1 is 6.26; L5 should be higher
});

it("applies local added lightning damage to weapon (crossbow + Galvanic Shards L1)", () => {
  // Makeshift Crossbow (7–12 phys) + LocalAddedLightningDamageTwoHand2 @100% roll
  // lightningMin=2, lightningMax=27 contributed via resolveWeaponProperties → calcBaseDamage
  // Expected perHit: min=8, max=35, avg=21.5
  // Cycle rate: 0.7018/s, crit expectedMulti=1.05
  // DPS = 21.5 × 0.7018 × 1.05 ≈ 15.84
  // Note: per-projectile DPS (PoB default). Projectile count of 8 is informational.
  const snap = snapshotFromPhase(crossbowLocalLightningGalvanic, "", "actual");
  const results = calcDps(snap);
  expect(results.length).toBe(1);
  const r = results[0];
  const EXPECTED = 15.84;
  expect(r.dps).toBeCloseTo(EXPECTED, 0);
  // Local lightning boosted DPS well above bare crossbow baseline (~6.26).
  expect(r.dps).toBeGreaterThan(6.5);
  // Lightning portion of damageByType must be non-zero and greater than bare crossbow.
  expect(r.damageByType.lightning.max).toBeGreaterThan(2);
});

it("PoB parity: 7-12 phys + 1-9 light weapon + Galvanic Shards L5 → ~14 DPS", () => {
  // Forensic investigation scenario (2026-04-19):
  // Root cause: applyConversions lacked intermediate rounding of converted amounts,
  // which PoB applies in calcConvertedDamage before summing with retained base.
  //
  // With the fix (intermediate round):
  //   Projectile (dmgMult=21, 60% phys→light):
  //     convertedFromPhys: {1.47×0.6=0.882→round=1, 2.52×0.6=1.512→round=2}
  //     light total: {0.21+1=1.21→1, 1.89+2=3.89→4}  → Light 1–4  (was 1–3)
  //     Proj perHit: 2–5, avg 3.5
  //   Beam (dmgMult=107, 100% phys→light):
  //     convertedFromPhys: {7.49→round=7, 12.84→round=13}
  //     light total: {1.07+7=8.07→8, 9.63+13=22.63→23}  → Light 8–23
  //     Beam perHit: 8–23, avg 15.5
  //   Total: min=10, max=28, avg=19.0
  //   Rate=0.7018/s, crit×1.05, DPS = 19.0 × 0.7018 × 1.05 ≈ 14.0
  const snap = snapshotFromPhase(crossbowLocalLightningL5Galvanic, "", "actual");
  const results = calcDps(snap);
  expect(results.length).toBe(1);
  const r = results[0];
  expect(r.skillName).toBe("Galvanic Shards");
  expect(r.level).toBe(5);
  // PoB-verified total DPS ≈ 14
  expect(r.dps).toBeCloseTo(14.0, 0);
  // Projectile + beam perHit total
  expect(r.perHit.min).toBe(10);
  expect(r.perHit.max).toBe(28);
  // Lightning damage range must reflect PoB's intermediate-round value
  expect(r.damageByType.lightning.max).toBe(27); // 4 (proj) + 23 (beam)
});

it("applies local_physical_damage_+% to weapon base before skill formula (crossbow + Heavy prefix)", () => {
  // Post Task 17.11: this fixture now matches PoB's two-stage rounding output exactly.
  // Per-projectile DPS (PoB default — one projectile hits the target):
  // Makeshift Crossbow (7–12 phys) + LocalIncreasedPhysicalDamagePercent1 at 100th percentile (49%)
  // Stage 1 — weapon rounding: 7×1.49=10.43→10, 12×1.49=17.88→18
  // Projectile set (dmgMult=15, 60% phys→lightning):
  //   phys=10×0.15=1.50–18×0.15=2.70; phys(40%)=0.60–1.08, lightning(60%)=0.90–1.62
  //   round(0.60)=1, round(0.90)=1; round(1.08)=1, round(1.62)=2 → sum=2–3
  // Beam set (dmgMult=75, 100% phys→lightning):
  //   lightning=10×0.75=7.50–18×0.75=13.50 → round(7.5)=8, round(13.5)=14 → sum=8–14
  // perHit: min=2+8=10, max=3+14=17, avg=13.5
  // Cycle rate (1 bolt, 800ms reload, 625ms attack): 0.7018/s
  // DPS = 13.5 × 0.7018 × 1.05 ≈ 9.95 (matches PoB ~12.5 at L5; at L1 rate limited)
  // Note: per-projectile DPS (PoB default). Projectile count of 8 is informational.
  const snap = snapshotFromPhase(crossbowLocalIncPhysGalvanic, "", "actual");
  const results = calcDps(snap);
  expect(results.length).toBe(1);
  const r = results[0];
  const EXPECTED = 9.95;
  expect(r.dps).toBeCloseTo(EXPECTED, 0);
  // Confirm local mod increased the DPS beyond bare crossbow (~6.26).
  expect(r.dps).toBeGreaterThan(6);
});
