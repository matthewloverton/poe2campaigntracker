import { describe, it, expect } from "vitest";
import {
  collectSkillStats,
  getSkillTags,
  getSkillLevel,
  statMapFromSkillLevel,
} from "./skillStats";
import { sumFlat, sumInc } from "./statMap";
import type { GemEntry, SkillLevelData } from "../../types/itemDatabase";

function makeLevel(stats: Record<string, number>): SkillLevelData {
  return { costs: {}, statText: [], stats };
}

function makeSkillGem(
  stats: Record<string, number>,
  types: string[] = ["Attack", "Projectile"],
): GemEntry {
  const levels = { "1": makeLevel(stats) };
  return {
    id: "test-skill",
    name: "Test Skill",
    gemType: "active",
    color: "g",
    craftingLevel: 1,
    craftingTypes: ["Crossbow"],
    tags: ["attack", "projectile"],
    recommendedSupports: [],
    requirementWeights: { strength: 0, dexterity: 100, intelligence: 0 },
    iconPath: "",
    skillDetail: {
      maxLevel: 20,
      levels,
      staticStatText: [],
      qualityStats: [],
      statSets: [{ name: "Primary", levels, staticStatText: [], qualityStats: [] }],
      activeSkillTypes: types,
    },
  };
}

describe("getSkillTags", () => {
  it("lowercases activeSkillTypes", () => {
    const gem = makeSkillGem({});
    expect(getSkillTags(gem)).toEqual(["attack", "projectile"]);
  });

  it("returns an empty array when activeSkillTypes is missing", () => {
    const gem = makeSkillGem({});
    delete gem.skillDetail!.activeSkillTypes;
    expect(getSkillTags(gem)).toEqual([]);
  });

  it("returns an empty array when the gem has no skillDetail", () => {
    const gem = makeSkillGem({});
    delete gem.skillDetail;
    expect(getSkillTags(gem)).toEqual([]);
  });
});

describe("getSkillLevel", () => {
  it("clamps below 1 to 1", () => {
    const gem = makeSkillGem({});
    expect(getSkillLevel(gem, 0)).toBe(1);
    expect(getSkillLevel(gem, -5)).toBe(1);
  });
  it("clamps above maxLevel to maxLevel", () => {
    const gem = makeSkillGem({});
    expect(getSkillLevel(gem, 999)).toBe(20);
  });
  it("returns the requested level when within range", () => {
    const gem = makeSkillGem({});
    expect(getSkillLevel(gem, 10)).toBe(10);
  });
  it("returns 1 when the gem has no skillDetail", () => {
    const gem = makeSkillGem({});
    delete gem.skillDetail;
    expect(getSkillLevel(gem, 5)).toBe(1);
  });
});

describe("collectSkillStats (primary stat set)", () => {
  it("emits flat base damage stats as flat contributions", () => {
    const gem = makeSkillGem({ base_fire_damage_min: 15, base_fire_damage_max: 22 });
    const map = collectSkillStats(gem, 1);
    expect(sumFlat(map, "base_fire_damage_min")).toBe(15);
    expect(sumFlat(map, "base_fire_damage_max")).toBe(22);
  });

  it("emits +% stats as increased contributions tagged with skill tags", () => {
    const gem = makeSkillGem({ "physical_damage_+%": 30 });
    const map = collectSkillStats(gem, 1);
    expect(sumInc(map, "physical_damage_+%", ["attack", "projectile"])).toBe(30);
  });

  it("skips zero-valued stats", () => {
    const gem = makeSkillGem({ base_fire_damage_min: 0 });
    const map = collectSkillStats(gem, 1);
    expect(map.size).toBe(0);
  });

  it("returns an empty map when level data is missing", () => {
    const gem = makeSkillGem({});
    const map = collectSkillStats(gem, 1);
    expect(map.size).toBe(0);
  });

  it("falls back to maxLevel level data when requested level is missing", () => {
    const gem = makeSkillGem({ base_fire_damage_min: 10 });
    // maxLevel is 20 in the fixture, but only level 1 has data; the fallback should still emit
    const map = collectSkillStats(gem, 5);
    expect(sumFlat(map, "base_fire_damage_min")).toBe(10);
  });

  it("attaches source type 'skill' with the gem id and name", () => {
    const gem = makeSkillGem({ base_fire_damage_min: 10 });
    const map = collectSkillStats(gem, 1);
    const list = map.get("base_fire_damage_min")!;
    expect(list[0].source.type).toBe("skill");
    expect(list[0].source.id).toBe("test-skill");
    expect(list[0].source.label).toBe("Test Skill");
  });
});

describe("statMapFromSkillLevel (per stat-set)", () => {
  it("emits stats tagged with provided skill tags", () => {
    const lvl: SkillLevelData = { costs: {}, statText: [], stats: { base_fire_damage_min: 7 } };
    const map = statMapFromSkillLevel("Impact", lvl, ["attack", "grenade"]);
    expect(sumFlat(map, "base_fire_damage_min")).toBe(7);
    const list = map.get("base_fire_damage_min")!;
    expect(list[0].tags).toEqual(["attack", "grenade"]);
  });

  it("skips zero-valued stats", () => {
    const lvl: SkillLevelData = { costs: {}, statText: [], stats: { x: 0, y: 5 } };
    const map = statMapFromSkillLevel("S", lvl, []);
    expect(map.size).toBe(1);
    expect(sumFlat(map, "y")).toBe(5);
  });

  it("attaches source with provided set name as label and id", () => {
    const lvl: SkillLevelData = { costs: {}, statText: [], stats: { q: 1 } };
    const map = statMapFromSkillLevel("Beam", lvl, []);
    const list = map.get("q")!;
    expect(list[0].source.type).toBe("skill");
    expect(list[0].source.id).toBe("Beam");
    expect(list[0].source.label).toBe("Beam");
  });
});
