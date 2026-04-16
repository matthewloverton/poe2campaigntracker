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

describe("parseBuildXml — PoB PoE2 (PathOfBuilding2) format", () => {
  const pob2 = readFileSync(
    join(__dirname, "__fixtures__", "sample-build-pob2.xml"),
    "utf-8",
  );
  const build = parseBuildXml(pob2);

  it("accepts <PathOfBuilding2> as the root element", () => {
    expect(build.items).toHaveLength(1);
  });

  it("parses the PoB-internal item format (no dividers, Prefix/Suffix metadata)", () => {
    const item = build.items[0];
    expect(item.rarity).toBe("RARE");
    expect(item.name).toBe("New Item");
    expect(item.baseType).toBe("Varnished Crossbow");
    expect(item.quality).toBe(20);
    expect(item.implicits).toEqual([]);
    expect(item.explicits).toEqual([
      "58% increased Physical Damage",
      "Adds 9 to 17 Physical Damage",
      "+2 to Level of all Projectile Skills",
    ]);
  });

  it("ignores <ModRange> child elements when extracting item text", () => {
    // ModRange elements are siblings of the text content. Their attributes
    // ("id", "range") must not leak into the parsed explicit mod list.
    const explicits = build.items[0].explicits;
    expect(explicits.every((l) => !/^\s*0?\.\d+\s*$/.test(l))).toBe(true);
    expect(explicits.some((l) => /range/i.test(l))).toBe(false);
  });

  it("captures PoB-PoE2 gem attributes (gemId, skillId, nameSpec)", () => {
    const gems = build.skillSets[0].skills[0].gems;
    expect(gems).toHaveLength(2);
    expect(gems[0].gemId).toBe("Metadata/Items/Gem/SkillGemExplosiveGrenade");
    expect(gems[0].skillId).toBe("ExplosiveGrenadePlayer");
    expect(gems[0].nameSpec).toBe("Explosive Grenade");
  });

  it("skips slots whose itemId is 0 (empty) — they remain in the map but as 0", () => {
    // Current parser keeps only slots with itemId > 0; verify.
    const slots = build.itemSets[0].slots;
    expect(slots["Weapon 1"]).toBe(1);
    expect(slots["Body Armour"]).toBeUndefined();
  });

  it("extracts explicitRolls from Prefix/Suffix {range:X} annotations", () => {
    const item = build.items[0];
    // fixture has 2 prefixes + 1 suffix with rolls 0.549, 0.345, 0.634
    expect(item.explicitRolls).toEqual([0.549, 0.345, 0.634]);
  });
});
