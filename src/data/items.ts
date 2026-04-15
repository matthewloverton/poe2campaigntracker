import type { BaseItem } from "../types/itemDatabase";
import rawItems from "./raw/base_items.json";

export const allItems: BaseItem[] = rawItems as BaseItem[];

export const itemsByClass: Map<string, BaseItem[]> = new Map();
for (const item of allItems) {
  const list = itemsByClass.get(item.itemClass) ?? [];
  list.push(item);
  itemsByClass.set(item.itemClass, list);
}
for (const list of itemsByClass.values()) {
  list.sort((a, b) => a.dropLevel - b.dropLevel);
}

export const itemById: Map<string, BaseItem> = new Map(
  allItems.map((item) => [item.id, item])
);

export function getItemsByClass(itemClass: string): BaseItem[] {
  return itemsByClass.get(itemClass) ?? [];
}

export function searchItems(query: string, itemClass?: string): BaseItem[] {
  const q = query.toLowerCase();
  const pool = itemClass ? (itemsByClass.get(itemClass) ?? []) : allItems;
  if (!q) return pool;
  return pool.filter((item) => item.name.toLowerCase().includes(q));
}
