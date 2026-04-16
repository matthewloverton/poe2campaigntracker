import { describe, it, expect } from "vitest";
import { allItems } from "../../data/items";
import { allUniques } from "../../data/uniques";
import { allMods } from "../../data/mods";
import { matchItem, normalizeModText, POB_SLOT_MAP } from "./matchItem";
import type { PoBItem } from "./types";

function fakeItem(overrides: Partial<PoBItem> = {}): PoBItem {
  return {
    id: 1,
    rarity: "RARE",
    name: "Fake",
    baseType: "Zealot Bow",
    implicits: [],
    explicits: [],
    explicitRolls: [],
    raw: "",
    ...overrides,
  };
}

describe("normalizeModText", () => {
  it("replaces numbers with #", () => {
    expect(normalizeModText("+83 to maximum Life")).toBe("# to maximum Life");
    expect(normalizeModText("Adds 30 to 60 Fire Damage")).toBe("Adds # to # Fire Damage");
    expect(normalizeModText("15% increased Attack Speed")).toBe("#% increased Attack Speed");
  });

  it("strips (crafted)/(fractured) suffixes", () => {
    expect(normalizeModText("+50 to Life (crafted)")).toBe("# to Life");
    expect(normalizeModText("15% increased Damage (fractured)")).toBe("#% increased Damage");
  });

  it("strips extra whitespace", () => {
    expect(normalizeModText("  15%   increased   Attack Speed  "))
      .toBe("#% increased Attack Speed");
  });
});

describe("POB_SLOT_MAP", () => {
  it("maps known slot names", () => {
    expect(POB_SLOT_MAP["Weapon 1"]).toBe("weapon");
    expect(POB_SLOT_MAP["Weapon 2"]).toBe("offhand");
    expect(POB_SLOT_MAP["Body Armour"]).toBe("bodyArmour");
    expect(POB_SLOT_MAP["Ring 1"]).toBe("ring1");
  });
});

describe("matchItem", () => {
  const baseBow = allItems.find((i) => i.name === "Zealot Bow");

  it("is a smoke test for the DB — Zealot Bow exists", () => {
    expect(baseBow).toBeDefined();
  });

  it("matches a rare with known base", () => {
    if (!baseBow) return;
    const pobItem = fakeItem({
      baseType: baseBow.name,
      explicits: ["15% increased Attack Speed"],
    });
    const { entry, warnings } = matchItem(pobItem, "weapon");
    expect(entry).not.toBeNull();
    expect(entry!.baseItemId).toBe(baseBow.id);
    expect(entry!.slot).toBe("weapon");
    expect(warnings).toEqual([]);
  });

  it("falls back to free text for an unmatched base", () => {
    const pobItem = fakeItem({ baseType: "Unknown Xyzzy Bow" });
    const { entry, warnings } = matchItem(pobItem, "weapon");
    expect(entry).not.toBeNull();
    expect(entry!.baseItemId).toBeUndefined();
    expect(entry!.base).toBe("Unknown Xyzzy Bow");
    expect(warnings.some((w) => w.scope === "item" && /not in database/i.test(w.message))).toBe(true);
  });

  it("emits a warning for an unmatched mod but still stores its raw text", () => {
    if (!baseBow) return;
    const pobItem = fakeItem({
      baseType: baseBow.name,
      explicits: ["Gives you 3 extra jumps on Tuesdays"],
    });
    const { entry, warnings } = matchItem(pobItem, "weapon");
    expect(entry!.desiredMods).toContain("Gives you 3 extra jumps on Tuesdays");
    expect(warnings.some((w) => /fell back to free text/i.test(w.message))).toBe(true);
  });

  it("resolves a unique by name", () => {
    const u = allUniques[0];
    if (!u) return;
    const pobItem = fakeItem({ rarity: "UNIQUE", name: u.name, baseType: u.itemClass });
    const { entry } = matchItem(pobItem, "amulet");
    expect(entry!.uniqueId).toBe(u.id);
  });

  it("picks the tier whose stat range contains the actual value, and derives the roll", () => {
    if (!baseBow) return;
    // Use a concrete mod we can control. Build fake DB-like data is hard; instead
    // use a real mod: find one with a known range we can hit.
    const tiers = allMods.filter((m) =>
      /^\(\d+-\d+\)%\s+increased\s+Physical Damage$/i.test(m.text.replace(/\[[^\]]*\]/g, "")) &&
      m.generationType === "prefix"
    );
    if (tiers.length < 2) return;
    // Pick tier-A (smaller numbers). Pick a value that falls in tier-A but NOT tier-B.
    const tierA = tiers.find((t) => t.stats[0] && t.stats[0].max < tiers.sort((a, b) => b.stats[0].min - a.stats[0].min)[0].stats[0].min);
    if (!tierA) return;
    const midValue = Math.round((tierA.stats[0].min + tierA.stats[0].max) / 2);
    const pobItem = fakeItem({
      baseType: baseBow.name,
      explicits: [`${midValue}% increased Physical Damage`],
      explicitRolls: [0.0],  // wrong fraction — should be ignored in favour of value-fitting
    });
    const { entry } = matchItem(pobItem, "weapon");
    expect(entry!.desiredModIds![0]).toBe(tierA.id);
    // Mid-value → ~50% roll
    expect(entry!.modRolls![tierA.id]).toBeGreaterThan(40);
    expect(entry!.modRolls![tierA.id]).toBeLessThan(60);
  });

  it("leaves modRolls undefined when no value can be extracted and no fraction is given", () => {
    if (!baseBow) return;
    // A mod whose text has no numbers (rare but possible) — synthetic case.
    const pobItem = fakeItem({
      baseType: baseBow.name,
      explicits: ["Totally free text mod without numbers"],
      explicitRolls: [undefined],
    });
    const { entry } = matchItem(pobItem, "weapon");
    expect(entry!.modRolls).toBeUndefined();
  });

  it("strips (crafted) suffix before matching mods", () => {
    if (!baseBow) return;
    // pick an existing mod we can recognize
    const existingMod = allMods.find((m) => m.text.includes("increased Attack Speed"));
    if (!existingMod) return;
    const normalized = normalizeModText(existingMod.text);
    const withSuffix = `${existingMod.text.replace(/\(\d+-\d+\)/g, "15")} (crafted)`;
    expect(normalizeModText(withSuffix)).toBe(normalized);
  });
});
