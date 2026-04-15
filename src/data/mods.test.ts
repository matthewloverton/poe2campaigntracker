import { describe, it, expect } from "vitest";
import { allMods, getModsForItem, getModsForItemAtLevel, groupModsByType } from "./mods";
import { allItems } from "./items";

describe("mods data module", () => {
  it("loads all item mods", () => {
    expect(allMods.length).toBeGreaterThan(1300);
  });

  it("gets mods for a crossbow", () => {
    const crossbow = allItems.find((i) => i.name === "Varnished Crossbow");
    expect(crossbow).toBeDefined();
    const { prefixes, suffixes } = getModsForItem(crossbow!);
    expect(prefixes.length).toBeGreaterThan(0);
    expect(suffixes.length).toBeGreaterThan(0);
    expect(prefixes.every((m) => m.generationType === "prefix")).toBe(true);
    expect(suffixes.every((m) => m.generationType === "suffix")).toBe(true);
  });

  it("filters mods by ilvl", () => {
    const crossbow = allItems.find((i) => i.name === "Varnished Crossbow");
    const allCrossbowMods = getModsForItem(crossbow!);
    const ilvl16Mods = getModsForItemAtLevel(crossbow!, 16);
    const allCount = allCrossbowMods.prefixes.length + allCrossbowMods.suffixes.length;
    const filteredCount = ilvl16Mods.prefixes.length + ilvl16Mods.suffixes.length;
    expect(filteredCount).toBeLessThanOrEqual(allCount);
    expect(ilvl16Mods.prefixes.every((m) => m.requiredLevel <= 16)).toBe(true);
    expect(ilvl16Mods.suffixes.every((m) => m.requiredLevel <= 16)).toBe(true);
  });

  it("groups mods by type", () => {
    const crossbow = allItems.find((i) => i.name === "Varnished Crossbow");
    const { prefixes } = getModsForItem(crossbow!);
    const groups = groupModsByType(prefixes);
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(group.type).toBeTruthy();
      expect(group.tiers.length).toBeGreaterThan(0);
      for (let i = 1; i < group.tiers.length; i++) {
        expect(group.tiers[i].requiredLevel).toBeGreaterThanOrEqual(
          group.tiers[i - 1].requiredLevel
        );
      }
    }
  });

  it("does not include mods with no matching tags", () => {
    const ring = allItems.find((i) => i.itemClass === "Ring");
    if (!ring) return;
    const { prefixes } = getModsForItem(ring);
    const weaponLocalMod = prefixes.find((m) => m.type.startsWith("LocalIncreasedPhysicalDamage"));
    expect(weaponLocalMod).toBeUndefined();
  });

  it("respects spawn weight priority (str_armour vs int_armour)", () => {
    const strArmour = allItems.find(
      (i) => i.itemClass === "Body Armour" && i.tags.includes("str_armour") && !i.tags.includes("int_armour")
    );
    const intArmour = allItems.find(
      (i) => i.itemClass === "Body Armour" && i.tags.includes("int_armour") && !i.tags.includes("str_armour")
    );
    if (!strArmour || !intArmour) return;

    const strPrefixes = getModsForItem(strArmour).prefixes;
    const intPrefixes = getModsForItem(intArmour).prefixes;

    // Flat ES mods should appear on int armour but not str armour
    const strHasLocalES = strPrefixes.some((m) => m.type === "LocalEnergyShield");
    const intHasLocalES = intPrefixes.some((m) => m.type === "LocalEnergyShield");
    expect(strHasLocalES).toBe(false);
    expect(intHasLocalES).toBe(true);

    // Pure increased Armour should appear on str but not int
    const strHasArmour = strPrefixes.some((m) => m.type === "LocalPhysicalDamageReductionRatingPercent");
    const intHasArmour = intPrefixes.some((m) => m.type === "LocalPhysicalDamageReductionRatingPercent");
    expect(strHasArmour).toBe(true);
    expect(intHasArmour).toBe(false);
  });

  it("mods have tags (crafting tags)", () => {
    const lifeMod = allMods.find((m) => m.type === "IncreasedLife");
    expect(lifeMod).toBeDefined();
    expect(lifeMod!.tags).toContain("life");
  });
});
