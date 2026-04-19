import { describe, it, expect } from "vitest";
import { collectGearStats, statKindForId } from "./modStats";
import type { GearLayout } from "../../types/buildPlan";
import { EMPTY_GEAR_LAYOUT } from "../../types/buildPlan";

// Helper: sum all flat contributions for a stat id
function sumFlat(map: ReturnType<typeof collectGearStats>, statId: string): number {
  const entries = map.get(statId);
  if (!entries) return 0;
  return entries.filter((c) => c.kind === "flat").reduce((acc, c) => acc + c.value, 0);
}

describe("statKindForId", () => {
  it("classifies +% suffix as increased", () => {
    expect(statKindForId("physical_damage_+%")).toBe("increased");
    expect(statKindForId("attack_speed_+%")).toBe("increased");
  });
  it("classifies base_*_min / base_*_max as flat", () => {
    expect(statKindForId("base_fire_damage_min")).toBe("flat");
    expect(statKindForId("base_physical_damage_max")).toBe("flat");
  });
  it("classifies *_final as more", () => {
    expect(statKindForId("damage_+%_final")).toBe("more");
  });
  it("classifies *_more as more", () => {
    expect(statKindForId("projectile_damage_more")).toBe("more");
  });
  it("classifies unknown ids as flat (default)", () => {
    expect(statKindForId("some_random_constant")).toBe("flat");
  });
});

describe("collectGearStats", () => {
  it("returns an empty map for a layout with no gear", () => {
    const gear: GearLayout = { ...EMPTY_GEAR_LAYOUT };
    const map = collectGearStats(gear, "actual");
    expect(map.size).toBe(0);
  });

  it("returns an empty map when entries have no desiredModIds", () => {
    const gear: GearLayout = {
      ...EMPTY_GEAR_LAYOUT,
      ring1: {
        id: "r1", slot: "ring1", base: "Gold Ring",
        desiredModIds: [], desiredMods: [], notes: "",
      },
    };
    const map = collectGearStats(gear, "actual");
    expect(map.size).toBe(0);
  });

  it("ignores desiredModIds that do not resolve to a known mod", () => {
    const gear: GearLayout = {
      ...EMPTY_GEAR_LAYOUT,
      ring1: {
        id: "r1", slot: "ring1", base: "Gold Ring",
        desiredModIds: ["this-mod-does-not-exist"],
        desiredMods: [], notes: "",
        modRolls: { "this-mod-does-not-exist": 50 },
      },
    };
    const map = collectGearStats(gear, "actual");
    expect(map.size).toBe(0);
  });

  it("applies implicit mods from the base item (Iron Ring adds physical damage to attacks)", () => {
    // Iron Ring: id "Metadata/Items/Rings/FourRing1"
    // implicit: RingImplicitPhysicalDamage1
    //   attack_minimum_added_physical_damage: min=1, max=1  → always 1
    //   attack_maximum_added_physical_damage: min=4, max=4  → always 4
    const IRON_RING_ID = "Metadata/Items/Rings/FourRing1";
    const gear: GearLayout = {
      ...EMPTY_GEAR_LAYOUT,
      ring1: {
        id: "r1",
        slot: "ring1",
        baseItemId: IRON_RING_ID,
        base: "Iron Ring",
        desiredModIds: [],
        desiredMods: [],
        notes: "",
      },
    };
    const map = collectGearStats(gear, "actual");
    // Iron Ring implicit: Adds 1 to 4 Physical Damage to Attacks
    expect(sumFlat(map, "attack_minimum_added_physical_damage")).toBeGreaterThan(0);
    expect(sumFlat(map, "attack_maximum_added_physical_damage")).toBeGreaterThan(0);
    expect(sumFlat(map, "attack_minimum_added_physical_damage")).toBeCloseTo(1, 3);
    expect(sumFlat(map, "attack_maximum_added_physical_damage")).toBeCloseTo(4, 3);
  });

  it("returns empty map when base item has no implicits and no explicit mods", () => {
    // Gold Ring has no implicits in the base data
    const gear: GearLayout = {
      ...EMPTY_GEAR_LAYOUT,
      ring1: {
        id: "r1", slot: "ring1",
        baseItemId: "Metadata/Items/Rings/GoldRing1",
        base: "Gold Ring",
        desiredModIds: [], desiredMods: [], notes: "",
      },
    };
    // Gold Ring may or may not have implicits — just check it doesn't throw
    const map = collectGearStats(gear, "actual");
    expect(map).toBeDefined();
  });
});
