import { describe, it, expect } from "vitest";
import { itemsByClass } from "../../data/items";
import { emptyItem, transmute, applyEssence } from "./emulator";

function seededRng(seed: number) {
  let state = seed | 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xffffffff);
  };
}

describe("applyEssence", () => {
  it("essence of flames (normal) upgrades a magic bow to rare with a forced fire-dmg mod", () => {
    const bow = (itemsByClass.get("Bow") ?? []).find((b) => b.requirements.level >= 20);
    expect(bow).toBeDefined();
    const rng = seededRng(42);
    let item = emptyItem(bow!, 82);
    item = transmute(item, bow!, rng);
    expect(item.rarity).toBe("magic");

    const beforeCount = item.prefixes.length + item.suffixes.length;
    const res = applyEssence(item, bow!, "flames", "normal", rng);
    expect(res).not.toBeNull();
    expect(res!.item.rarity).toBe("rare");
    // Existing magic mods preserved + 1 forced mod (no auto-fill)
    const totalMods = res!.item.prefixes.length + res!.item.suffixes.length;
    expect(totalMods).toBe(beforeCount + 1);
    const hasForced = [...res!.item.prefixes, ...res!.item.suffixes].some(
      (m) => m.modId === res!.forcedModId,
    );
    expect(hasForced).toBe(true);
  });

  it("perfect essence (corrupted-style) removes one mod and injects forced on a rare", () => {
    // Use Hysteria — its "perfect" tier covers many item categories including bows.
    const bow = (itemsByClass.get("Bow") ?? []).find((b) => b.requirements.level >= 20);
    const rng = seededRng(7);
    let item = emptyItem(bow!, 82);
    item = transmute(item, bow!, rng);
    const pre = applyEssence(item, bow!, "flames", "normal", rng);
    expect(pre).not.toBeNull();
    item = pre!.item;
    const before = item.prefixes.length + item.suffixes.length;

    const post = applyEssence(item, bow!, "flames", "perfect", rng);
    expect(post).not.toBeNull();
    const after = post!.item.prefixes.length + post!.item.suffixes.length;
    expect(after).toBe(before);
  });
});
