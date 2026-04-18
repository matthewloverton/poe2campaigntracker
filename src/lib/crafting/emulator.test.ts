import { describe, it, expect } from "vitest";
import { itemsByClass } from "../../data/items";
import {
  emptyItem,
  transmute,
  augment,
  regal,
  alchemy,
  exalt,
  annul,
  chaos,
  vaal,
  capsFor,
} from "./emulator";

// Deterministic PRNG for tests — xorshift seeded.
function seededRng(seed: number) {
  let state = seed | 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xffffffff);
  };
}

function pickArmourBase() {
  const bodyArmours = itemsByClass.get("Body Armour") ?? [];
  // Pick a mid-tier INT body armour so most normal mods are in pool.
  return bodyArmours.find((b) => b.tags.includes("int_armour") && b.requirements.level >= 20 && b.requirements.level <= 60)!;
}

describe("craft emulator", () => {
  it("transmute adds exactly one mod to a normal item", () => {
    const base = pickArmourBase();
    expect(base).toBeDefined();
    const rng = seededRng(1);
    const item = emptyItem(base, 82);
    const next = transmute(item, base, rng);
    expect(next.rarity).toBe("magic");
    expect(next.prefixes.length + next.suffixes.length).toBe(1);
  });

  it("augment fills the open affix slot on a 1-mod magic item", () => {
    const base = pickArmourBase();
    const rng = seededRng(2);
    let item = emptyItem(base, 82);
    item = transmute(item, base, rng);
    const before = item.prefixes.length + item.suffixes.length;
    item = augment(item, base, rng);
    const after = item.prefixes.length + item.suffixes.length;
    expect(after).toBe(before + 1);
    expect(item.prefixes.length).toBeLessThanOrEqual(1);
    expect(item.suffixes.length).toBeLessThanOrEqual(1);
  });

  it("regal promotes magic to rare and adds a mod", () => {
    const base = pickArmourBase();
    const rng = seededRng(3);
    let item = emptyItem(base, 82);
    item = transmute(item, base, rng);
    item = augment(item, base, rng);
    expect(item.prefixes.length + item.suffixes.length).toBe(2);
    item = regal(item, base, rng);
    expect(item.rarity).toBe("rare");
    expect(item.prefixes.length + item.suffixes.length).toBe(3);
  });

  it("alchemy produces a rare with 4 mods", () => {
    const base = pickArmourBase();
    const rng = seededRng(4);
    let item = emptyItem(base, 82);
    item = alchemy(item, base, rng);
    expect(item.rarity).toBe("rare");
    expect(item.prefixes.length + item.suffixes.length).toBe(4);
  });

  it("exalt adds a mod to rare without removing", () => {
    const base = pickArmourBase();
    const rng = seededRng(5);
    let item = emptyItem(base, 82);
    item = alchemy(item, base, rng);
    const before = item.prefixes.length + item.suffixes.length;
    item = exalt(item, base, rng);
    const after = item.prefixes.length + item.suffixes.length;
    expect(after).toBe(before + 1);
  });

  it("annul removes exactly one mod", () => {
    const base = pickArmourBase();
    const rng = seededRng(6);
    let item = emptyItem(base, 82);
    item = alchemy(item, base, rng);
    const before = item.prefixes.length + item.suffixes.length;
    item = annul(item, rng);
    const after = item.prefixes.length + item.suffixes.length;
    expect(after).toBe(before - 1);
  });

  it("chaos swaps one mod for another (count stays equal)", () => {
    const base = pickArmourBase();
    const rng = seededRng(7);
    let item = emptyItem(base, 82);
    item = alchemy(item, base, rng);
    const before = item.prefixes.length + item.suffixes.length;
    item = chaos(item, base, rng);
    const after = item.prefixes.length + item.suffixes.length;
    expect(after).toBe(before);
  });

  it("vaal marks the item corrupted and blocks further crafting", () => {
    const base = pickArmourBase();
    const rng = seededRng(8);
    let item = emptyItem(base, 82);
    item = alchemy(item, base, rng);
    item = vaal(item, base, rng);
    expect(item.corrupted).toBe(true);
    // Exalt should be a no-op on corrupted
    const beforeCount = item.prefixes.length + item.suffixes.length;
    item = exalt(item, base, rng);
    expect(item.prefixes.length + item.suffixes.length).toBe(beforeCount);
  });

  it("caps for rarity", () => {
    expect(capsFor("normal")).toEqual({ prefix: 0, suffix: 0 });
    expect(capsFor("magic")).toEqual({ prefix: 1, suffix: 1 });
    expect(capsFor("rare")).toEqual({ prefix: 3, suffix: 3 });
  });
});
