import type { BaseItem, ItemMod } from "../../types/itemDatabase";
import { allMods, modWeightOnItem, modById } from "../../data/mods";

export type Rarity = "normal" | "magic" | "rare";

/**
 * Currency tier variant. Greater/Perfect apply a minimum-modifier-level
 * filter (see applyMinLevelFilter); the concrete levels are passed per
 * currency by callers (different currencies may use different floors).
 */
export type TierType = "normal" | "greater" | "perfect";

/**
 * Greater/Perfect orbs restrict the pool to mods whose required level is at
 * least `minLevel`. Exception: if applying the cutoff would remove every
 * tier of a mod family, keep its highest-tier entry — the game's rule is
 * "a specific modifier type is never excluded entirely just by the floor".
 */
export function applyMinLevelFilter<T extends { mod: ItemMod; weight: number }>(
  pool: T[],
  minLevel: number,
): T[] {
  if (minLevel <= 0) return pool;
  const byType = new Map<string, T[]>();
  for (const p of pool) {
    const arr = byType.get(p.mod.type) ?? [];
    arr.push(p);
    byType.set(p.mod.type, arr);
  }
  const kept: T[] = [];
  for (const arr of byType.values()) {
    const qualifying = arr.filter((p) => p.mod.requiredLevel >= minLevel);
    if (qualifying.length > 0) {
      kept.push(...qualifying);
    } else {
      // All tiers below threshold → retain the single highest-tier entry.
      arr.sort((a, b) => b.mod.requiredLevel - a.mod.requiredLevel);
      kept.push(arr[0]);
    }
  }
  return kept;
}

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
 * respecting mutual-exclusion groups already present. `minModLevel` is the
 * Greater/Perfect minimum-modifier-level floor (0 = no floor).
 */
export function pickRollableMod(
  base: BaseItem,
  itemLevel: number,
  generationType: GenType | "corrupted",
  existingGroups: Set<string>,
  rng: () => number = Math.random,
  minModLevel: number = 0,
): ItemMod | null {
  const pool: Array<{ mod: ItemMod; weight: number }> = [];
  const source = generationType === "corrupted" ? "corrupted" : "normal";
  for (const mod of allMods) {
    if (mod.source !== source) continue;
    if (mod.generationType !== generationType) continue;
    if (existingGroups.has(mod.group)) continue;
    if (mod.requiredLevel > itemLevel) continue;
    const w = modWeightOnItem(mod, base);
    if (w <= 0) continue;
    pool.push({ mod, weight: w });
  }
  const scoped = applyMinLevelFilter(pool, minModLevel);
  const total = scoped.reduce((acc, p) => acc + p.weight, 0);
  return weightedPick(scoped, total, rng);
}

function randomRoll(rng: () => number): number {
  return Math.floor(rng() * 101);
}

function addMod(
  item: EmulatedItem,
  base: BaseItem,
  gen: GenType,
  rng: () => number,
  minModLevel: number = 0,
): EmulatedItem {
  const caps = capsFor(item.rarity);
  const list = gen === "prefix" ? item.prefixes : item.suffixes;
  if (list.length >= caps[gen]) return item;
  const mod = pickRollableMod(base, item.itemLevel, gen, collectExistingGroups(item), rng, minModLevel);
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
export function transmute(item: EmulatedItem, base: BaseItem, rng: () => number = Math.random, minModLevel: number = 0): EmulatedItem {
  if (item.rarity !== "normal" || item.corrupted) return item;
  const withRarity: EmulatedItem = { ...item, rarity: "magic" };
  const gen: GenType = rng() < 0.5 ? "prefix" : "suffix";
  return addMod(withRarity, base, gen, rng, minModLevel);
}

/** Magic with 1 mod → Magic with 2 mods (add opposite-type mod). */
export function augment(item: EmulatedItem, base: BaseItem, rng: () => number = Math.random, minModLevel: number = 0): EmulatedItem {
  if (item.rarity !== "magic" || item.corrupted) return item;
  const gen = pickOpenGen(item, rng);
  if (!gen) return item;
  return addMod(item, base, gen, rng, minModLevel);
}

/** Magic → Rare, keeping existing mods and adding 1 more. */
export function regal(item: EmulatedItem, base: BaseItem, rng: () => number = Math.random, minModLevel: number = 0): EmulatedItem {
  if (item.rarity !== "magic" || item.corrupted) return item;
  const asRare: EmulatedItem = { ...item, rarity: "rare" };
  const gen = pickOpenGen(asRare, rng);
  if (!gen) return asRare;
  return addMod(asRare, base, gen, rng, minModLevel);
}

/** Normal → Rare with 4 mods. */
export function alchemy(item: EmulatedItem, base: BaseItem, rng: () => number = Math.random, minModLevel: number = 0): EmulatedItem {
  if (item.rarity !== "normal" || item.corrupted) return item;
  let next: EmulatedItem = {
    ...item,
    rarity: "rare",
    prefixes: [],
    suffixes: [],
  };
  for (let i = 0; i < 4; i++) {
    const gen = pickOpenGen(next, rng);
    if (!gen) break;
    const before = next;
    next = addMod(next, base, gen, rng, minModLevel);
    if (next === before) {
      const other: GenType = gen === "prefix" ? "suffix" : "prefix";
      next = addMod(next, base, other, rng, minModLevel);
      if (next === before) break;
    }
  }
  return next;
}

/** Exalt: add a random mod to a rare (filling any open prefix/suffix slot). */
export function exalt(item: EmulatedItem, base: BaseItem, rng: () => number = Math.random, minModLevel: number = 0): EmulatedItem {
  if (item.rarity !== "rare" || item.corrupted) return item;
  const gen = pickOpenGen(item, rng);
  if (!gen) return item;
  return addMod(item, base, gen, rng, minModLevel);
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
export function chaos(item: EmulatedItem, base: BaseItem, rng: () => number = Math.random, minModLevel: number = 0): EmulatedItem {
  if (item.rarity !== "rare" || item.corrupted) return item;
  const afterRemove = annul(item, rng);
  if (afterRemove === item) return item;
  const gen = pickOpenGen(afterRemove, rng);
  if (!gen) return afterRemove;
  return addMod(afterRemove, base, gen, rng, minModLevel);
}

/** Divine: reroll values on every mod. Blocked once the item is corrupted. */
export function divine(item: EmulatedItem, rng: () => number = Math.random): EmulatedItem {
  if (item.corrupted) return item;
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
