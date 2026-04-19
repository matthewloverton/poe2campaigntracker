import { describe, it, expect } from "vitest";
import { resolveWeaponProperties } from "./localWeaponMods";
import type { BuildGearEntry } from "../../types/buildPlan";

function entry(modRolls: Record<string, number>, desiredModIds: string[]): BuildGearEntry {
  return {
    id: "w1",
    slot: "weapon",
    base: "Makeshift Crossbow",
    baseItemId: "Metadata/Items/Weapons/TwoHandWeapons/Crossbows/FourCrossbow1",
    desiredMods: [],
    desiredModIds,
    notes: "",
    modRolls,
  };
}

describe("resolveWeaponProperties", () => {
  it("returns null when no weapon entry", () => {
    const resolved = resolveWeaponProperties(null, "actual");
    expect(resolved).toBeNull();
  });

  it("returns unmodified base properties when weapon has no local mods", () => {
    const e = entry({}, []);
    const resolved = resolveWeaponProperties(e, "actual");
    // Base Makeshift Crossbow: phys 7-12, attack 625ms, crit 500 (hundredths-of-percent).
    expect(resolved).not.toBeNull();
    expect(resolved!.physicalDamageMin).toBe(7);
    expect(resolved!.physicalDamageMax).toBe(12);
    expect(resolved!.attackTime).toBe(625);
  });

  it("applies local_physical_damage_+% at max roll", () => {
    // LocalIncreasedPhysicalDamagePercent1 ("Heavy") has stat local_physical_damage_+%
    // with range 40-49. At 100th percentile → 49%.
    const modId = "LocalIncreasedPhysicalDamagePercent1";
    const resolved = resolveWeaponProperties(entry({ [modId]: 100 }, [modId]), "actual");
    expect(resolved).not.toBeNull();
    // 7 * 1.49 = 10.43; 12 * 1.49 = 17.88
    expect(resolved!.physicalDamageMin).toBeCloseTo(10.43, 2);
    expect(resolved!.physicalDamageMax).toBeCloseTo(17.88, 2);
  });

  it("applies local_physical_damage_+% at min roll", () => {
    const modId = "LocalIncreasedPhysicalDamagePercent1";
    // 0th percentile → 40%
    const resolved = resolveWeaponProperties(entry({ [modId]: 0 }, [modId]), "actual");
    expect(resolved!.physicalDamageMin).toBeCloseTo(9.8, 2);
    expect(resolved!.physicalDamageMax).toBeCloseTo(16.8, 2);
  });

  it("max rollMode forces 100th percentile regardless of modRolls", () => {
    const modId = "LocalIncreasedPhysicalDamagePercent1";
    const resolved = resolveWeaponProperties(entry({ [modId]: 0 }, [modId]), "max");
    expect(resolved!.physicalDamageMin).toBeCloseTo(10.43, 2);
  });

  it("does not apply non-local mods in the resolver", () => {
    // Fake a global mod id; resolver should skip gracefully (not in data or no local_ stats).
    const fakeGlobalModId = "attack_minimum_added_physical_damage_placeholder";
    const resolved = resolveWeaponProperties(entry({ [fakeGlobalModId]: 100 }, [fakeGlobalModId]), "actual");
    expect(resolved!.physicalDamageMin).toBe(7);
    expect(resolved!.physicalDamageMax).toBe(12);
  });
});
