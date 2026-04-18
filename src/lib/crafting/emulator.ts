import type { BaseItem, ItemMod } from "../../types/itemDatabase";
import { allMods, modWeightOnItem, modById } from "../../data/mods";

export type Rarity = "normal" | "magic" | "rare";

export interface EmulatedMod {
  modId: string;
  /** 0–100 percentile controlling where in the range the stat lands. */
  roll: number;
}

export interface EmulatedItem {
  baseItemId: string;
  rarity: Rarity;
  prefixes: EmulatedMod[];
  suffixes: EmulatedMod[];
  /** A single corrupted implicit, if the item has been Vaaled. */
  corruptedImplicit: EmulatedMod | null;
  corrupted: boolean;
  itemLevel: number;
}

export type GenType = "prefix" | "suffix";

export function capsFor(rarity: Rarity): { prefix: number; suffix: number } {
  if (rarity === "magic") return { prefix: 1, suffix: 1 };
  if (rarity === "rare") return { prefix: 3, suffix: 3 };
  return { prefix: 0, suffix: 0 };
}

export function emptyItem(base: BaseItem, itemLevel: number): EmulatedItem {
  return {
    baseItemId: base.id,
    rarity: "normal",
    prefixes: [],
    suffixes: [],
    corruptedImplicit: null,
    corrupted: false,
    itemLevel,
  };
}

function collectExistingGroups(item: EmulatedItem): Set<string> {
  const groups = new Set<string>();
  for (const m of [...item.prefixes, ...item.suffixes]) {
    const mod = modById.get(m.modId);
    if (mod) groups.add(mod.group);
  }
  return groups;
}

function weightedPick(
  pool: Array<{ mod: ItemMod; weight: number }>,
  total: number,
  rng: () => number,
): ItemMod | null {
  if (total <= 0 || pool.length === 0) return null;
  let r = rng() * total;
  for (const entry of pool) {
    r -= entry.weight;
    if (r <= 0) return entry.mod;
  }
  return pool[pool.length - 1].mod;
}

/**
 * Pick one weighted-random mod that can roll on this item at its item level,
 * respecting mutual-exclusion groups already present.
 */
export function pickRollableMod(
  base: BaseItem,
  itemLevel: number,
  generationType: GenType | "corrupted",
  existingGroups: Set<string>,
  rng: () => number = Math.random,
): ItemMod | null {
  const pool: Array<{ mod: ItemMod; weight: number }> = [];
  let totalWeight = 0;
  const source = generationType === "corrupted" ? "corrupted" : "normal";
  for (const mod of allMods) {
    if (mod.source !== source) continue;
    if (mod.generationType !== generationType) continue;
    if (existingGroups.has(mod.group)) continue;
    if (mod.requiredLevel > itemLevel) continue;
    const w = modWeightOnItem(mod, base);
    if (w <= 0) continue;
    pool.push({ mod, weight: w });
    totalWeight += w;
  }
  return weightedPick(pool, totalWeight, rng);
}

function randomRoll(rng: () => number): number {
  return Math.floor(rng() * 101);
}

function addMod(item: EmulatedItem, base: BaseItem, gen: GenType, rng: () => number): EmulatedItem {
  const caps = capsFor(item.rarity);
  const list = gen === "prefix" ? item.prefixes : item.suffixes;
  if (list.length >= caps[gen]) return item;
  const mod = pickRollableMod(base, item.itemLevel, gen, collectExistingGroups(item), rng);
  if (!mod) return item;
  const em: EmulatedMod = { modId: mod.id, roll: randomRoll(rng) };
  return gen === "prefix"
    ? { ...item, prefixes: [...item.prefixes, em] }
    : { ...item, suffixes: [...item.suffixes, em] };
}

/** Pick an open gen-type uniformly among those with free slots. */
function pickOpenGen(item: EmulatedItem, rng: () => number): GenType | null {
  const caps = capsFor(item.rarity);
  const hasPrefix = item.prefixes.length < caps.prefix;
  const hasSuffix = item.suffixes.length < caps.suffix;
  if (!hasPrefix && !hasSuffix) return null;
  if (hasPrefix && hasSuffix) return rng() < 0.5 ? "prefix" : "suffix";
  return hasPrefix ? "prefix" : "suffix";
}

/** Normal → Magic with 1 random mod (prefix or suffix, 50/50). */
export function transmute(item: EmulatedItem, base: BaseItem, rng: () => number = Math.random): EmulatedItem {
  if (item.rarity !== "normal" || item.corrupted) return item;
  const withRarity: EmulatedItem = { ...item, rarity: "magic" };
  const gen: GenType = rng() < 0.5 ? "prefix" : "suffix";
  return addMod(withRarity, base, gen, rng);
}

/** Magic with 1 mod → Magic with 2 mods (add opposite-type mod). */
export function augment(item: EmulatedItem, base: BaseItem, rng: () => number = Math.random): EmulatedItem {
  if (item.rarity !== "magic" || item.corrupted) return item;
  const gen = pickOpenGen(item, rng);
  if (!gen) return item;
  return addMod(item, base, gen, rng);
}

/** Magic → Rare, keeping existing mods and adding 1 more. */
export function regal(item: EmulatedItem, base: BaseItem, rng: () => number = Math.random): EmulatedItem {
  if (item.rarity !== "magic" || item.corrupted) return item;
  const asRare: EmulatedItem = { ...item, rarity: "rare" };
  const gen = pickOpenGen(asRare, rng);
  if (!gen) return asRare;
  return addMod(asRare, base, gen, rng);
}

/** Normal → Rare with 4 mods. */
export function alchemy(item: EmulatedItem, base: BaseItem, rng: () => number = Math.random): EmulatedItem {
  if (item.rarity !== "normal" || item.corrupted) return item;
  let next: EmulatedItem = {
    ...item,
    rarity: "rare",
    prefixes: [],
    suffixes: [],
  };
  // 4 mods on alchemy. Pick each slot independently among whichever type
  // still has capacity, weighted 50/50 when both are open.
  for (let i = 0; i < 4; i++) {
    const gen = pickOpenGen(next, rng);
    if (!gen) break;
    const before = next;
    next = addMod(next, base, gen, rng);
    // If the pool for this gen was exhausted, force the other side.
    if (next === before) {
      const other: GenType = gen === "prefix" ? "suffix" : "prefix";
      next = addMod(next, base, other, rng);
      if (next === before) break;
    }
  }
  return next;
}

/** Exalt: add a random mod to a rare (filling any open prefix/suffix slot). */
export function exalt(item: EmulatedItem, base: BaseItem, rng: () => number = Math.random): EmulatedItem {
  if (item.rarity !== "rare" || item.corrupted) return item;
  const gen = pickOpenGen(item, rng);
  if (!gen) return item;
  return addMod(item, base, gen, rng);
}

/** Annul: remove a random mod. */
export function annul(item: EmulatedItem, rng: () => number = Math.random): EmulatedItem {
  if (item.corrupted) return item;
  const all = [...item.prefixes.map((m, i) => ({ m, i, gen: "prefix" as GenType })),
               ...item.suffixes.map((m, i) => ({ m, i, gen: "suffix" as GenType }))];
  if (all.length === 0) return item;
  const pick = all[Math.floor(rng() * all.length)];
  if (pick.gen === "prefix") {
    return { ...item, prefixes: item.prefixes.filter((_, i) => i !== pick.i) };
  }
  return { ...item, suffixes: item.suffixes.filter((_, i) => i !== pick.i) };
}

/** Chaos: remove one random mod and add one new random mod (PoE2 behaviour). */
export function chaos(item: EmulatedItem, base: BaseItem, rng: () => number = Math.random): EmulatedItem {
  if (item.rarity !== "rare" || item.corrupted) return item;
  // Remove one
  const afterRemove = annul(item, rng);
  if (afterRemove === item) return item; // no mods to remove
  // Add one — prefer the gen that just freed up; but any open gen works.
  const gen = pickOpenGen(afterRemove, rng);
  if (!gen) return afterRemove;
  return addMod(afterRemove, base, gen, rng);
}

/** Divine: reroll values on every mod (both affix + corrupted implicit). */
export function divine(item: EmulatedItem, rng: () => number = Math.random): EmulatedItem {
  const reroll = (m: EmulatedMod): EmulatedMod => ({ ...m, roll: randomRoll(rng) });
  return {
    ...item,
    prefixes: item.prefixes.map(reroll),
    suffixes: item.suffixes.map(reroll),
    corruptedImplicit: item.corruptedImplicit ? reroll(item.corruptedImplicit) : null,
  };
}

/** Vaal: corrupt the item. MVP behaviour: add a corrupted implicit, mark corrupted. */
export function vaal(item: EmulatedItem, base: BaseItem, rng: () => number = Math.random): EmulatedItem {
  if (item.corrupted) return item;
  const mod = pickRollableMod(base, item.itemLevel, "corrupted", new Set(), rng);
  const implicit: EmulatedMod | null = mod ? { modId: mod.id, roll: randomRoll(rng) } : null;
  return { ...item, corrupted: true, corruptedImplicit: implicit };
}

/** Reset to a normal unmodified base. */
export function scour(item: EmulatedItem): EmulatedItem {
  if (item.corrupted) return item;
  return {
    ...item,
    rarity: "normal",
    prefixes: [],
    suffixes: [],
  };
}
