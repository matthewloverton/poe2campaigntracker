import { describe, it, expect } from "vitest";
import { allItems } from "../../data/items";
import { allMods } from "../../data/mods";
import { encodeItem } from "./encodeItem";
import type { BuildGearEntry } from "../../types/buildPlan";

describe("encodeItem", () => {
  const bow = allItems.find((i) => i.name === "Zealot Bow");

  it("emits the expected top-of-block markers for a rare", () => {
    if (!bow) return;
    const entry: BuildGearEntry = {
      id: "1",
      slot: "weapon",
      base: bow.name,
      baseItemId: bow.id,
      desiredMods: [],
      notes: "",
    };
    const text = encodeItem(entry);
    expect(text).toContain(`Item Class: ${bow.itemClass}`);
    expect(text).toContain("Rarity: Rare");
    expect(text).toContain(bow.name);
    expect(text).toContain("Item Level: 82");
    expect(text).toMatch(/--------/); // has dividers
    expect(text).toMatch(/Note: Crafted in PoE2 Campaign Tracker$/m);
  });

  it("emits 'Rarity: Unique' with the unique name when uniqueId is set", () => {
    if (!bow) return;
    const entry: BuildGearEntry = {
      id: "1",
      slot: "weapon",
      base: bow.name,
      baseItemId: bow.id,
      uniqueId: "228",
      desiredMods: ["(15-30)% increased Movement Speed"],
      notes: "",
    };
    const text = encodeItem(entry);
    expect(text).toContain("Rarity: Unique");
  });

  it("includes quality line when quality > 0", () => {
    if (!bow) return;
    const entry: BuildGearEntry = {
      id: "1",
      slot: "weapon",
      base: bow.name,
      baseItemId: bow.id,
      desiredMods: [],
      notes: "",
      quality: 20,
    };
    expect(encodeItem(entry)).toContain("Quality: +20% (augmented)");
  });

  it("omits quality line when quality is 0 or undefined", () => {
    if (!bow) return;
    const entry: BuildGearEntry = {
      id: "1",
      slot: "weapon",
      base: bow.name,
      baseItemId: bow.id,
      desiredMods: [],
      notes: "",
    };
    expect(encodeItem(entry)).not.toContain("Quality:");
  });

  it("resolves mod roll values from modRolls when available", () => {
    const lifeMod = allMods.find((m) =>
      m.text.includes("to maximum Life") && m.stats.some((s) => s.id.includes("life"))
    );
    if (!bow || !lifeMod) return;
    const stat = lifeMod.stats[0];
    const entry: BuildGearEntry = {
      id: "1",
      slot: "weapon",
      base: bow.name,
      baseItemId: bow.id,
      desiredMods: [lifeMod.text],
      desiredModIds: [lifeMod.id],
      modRolls: { [lifeMod.id]: 100 },  // max roll
      notes: "",
    };
    const text = encodeItem(entry);
    // max roll should appear as a concrete number, not as "(min-max)"
    expect(text).toContain(String(stat.max));
    expect(text).not.toMatch(/\(\d+[–—-]\d+\)/);
  });

  it("passes unresolved (free-text) mods through verbatim", () => {
    if (!bow) return;
    const entry: BuildGearEntry = {
      id: "1",
      slot: "weapon",
      base: bow.name,
      baseItemId: bow.id,
      desiredMods: ["Gives you +5 extra jumps"],
      notes: "",
    };
    expect(encodeItem(entry)).toContain("Gives you +5 extra jumps");
  });

  it("falls back gracefully when baseItemId is unknown", () => {
    const entry: BuildGearEntry = {
      id: "1",
      slot: "weapon",
      base: "Made-up Thing",
      desiredMods: ["+10 to Life"],
      notes: "",
    };
    const text = encodeItem(entry);
    expect(text).toContain("Made-up Thing");
    expect(text).toContain("+10 to Life");
  });
});
