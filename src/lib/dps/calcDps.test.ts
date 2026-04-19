import { describe, it, expect } from "vitest";
import { calcDps, snapshotFromPhase } from "./index";
import { bareCrossbowGalvanic } from "./__fixtures__/bareCrossbowGalvanic";

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
});
