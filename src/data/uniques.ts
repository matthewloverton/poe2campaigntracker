import type { UniqueItem } from "../types/itemDatabase";
import rawUniques from "./raw/uniques.json";

export const allUniques: UniqueItem[] = rawUniques as UniqueItem[];

export const uniquesByClass: Map<string, UniqueItem[]> = new Map();
for (const unique of allUniques) {
  const list = uniquesByClass.get(unique.itemClass) ?? [];
  list.push(unique);
  uniquesByClass.set(unique.itemClass, list);
}

export function getUniquesByClass(itemClass: string): UniqueItem[] {
  return uniquesByClass.get(itemClass) ?? [];
}

export function searchUniques(query: string, itemClass?: string): UniqueItem[] {
  const q = query.toLowerCase();
  const pool = itemClass ? (uniquesByClass.get(itemClass) ?? []) : allUniques;
  if (!q) return pool;
  return pool.filter((u) => u.name.toLowerCase().includes(q));
}
