import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseBuildXml } from "./parseBuild";

const sample = readFileSync(
  join(__dirname, "__fixtures__", "sample-build.xml"),
  "utf-8",
);

describe("parseBuildXml", () => {
  const build = parseBuildXml(sample);

  it("extracts items with rarity and name", () => {
    expect(build.items).toHaveLength(2);
    const rare = build.items.find((i) => i.id === 1)!;
    expect(rare.rarity).toBe("RARE");
    expect(rare.name).toBe("Doom Song");
    expect(rare.baseType).toBe("Expert Zealot Bow");
    expect(rare.quality).toBe(20);
    expect(rare.itemLevel).toBe(82);
    expect(rare.implicits).toEqual(["20% increased Physical Damage"]);
    expect(rare.explicits).toEqual([
      "+83 to maximum Life",
      "Adds 30 to 60 Fire Damage",
      "15% increased Attack Speed",
    ]);
  });

  it("extracts unique items", () => {
    const unique = build.items.find((i) => i.id === 2)!;
    expect(unique.rarity).toBe("UNIQUE");
    expect(unique.name).toBe("Pillar of the Caged God");
    expect(unique.baseType).toBe("Long Staff");
  });

  it("extracts item sets with slot mapping", () => {
    expect(build.itemSets).toHaveLength(2);
    expect(build.itemSets[0].title).toBe("Leveling");
    expect(build.itemSets[0].slots).toEqual({ "Weapon 1": 1 });
    expect(build.itemSets[1].title).toBe("");
    expect(build.itemSets[1].slots).toEqual({ "Weapon 1": 2 });
    expect(build.activeItemSetId).toBe(1);
  });

  it("extracts skill sets with gems", () => {
    expect(build.skillSets).toHaveLength(2);
    expect(build.activeSkillSetId).toBe(2);
    const endgame = build.skillSets[1];
    expect(endgame.title).toBe("Endgame");
    expect(endgame.skills).toHaveLength(2);
    expect(endgame.skills[0].enabled).toBe(true);
    expect(endgame.skills[0].gems.map((g) => g.skillId))
      .toEqual(["LightningArrowOfTheStorm", "SupportMartialTempo"]);
    expect(endgame.skills[1].enabled).toBe(false);
  });

  it("falls back to empty build on missing Items/Skills", () => {
    const result = parseBuildXml("<PathOfBuilding><Build/></PathOfBuilding>");
    expect(result.items).toEqual([]);
    expect(result.itemSets).toEqual([]);
    expect(result.skillSets).toEqual([]);
  });

  it("throws on non-XML input", () => {
    expect(() => parseBuildXml("not xml at all")).toThrow();
  });
});
