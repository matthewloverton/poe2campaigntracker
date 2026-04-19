import { describe, it, expect } from "vitest";
import { collectGearStats, statKindForId } from "./modStats";
import type { GearLayout } from "../../types/buildPlan";
import { EMPTY_GEAR_LAYOUT } from "../../types/buildPlan";

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
});
