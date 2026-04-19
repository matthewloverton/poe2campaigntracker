import type { StatContribution, StatId, StatMap } from "./types";

export function emptyStatMap(): StatMap {
  return new Map();
}

export function addContribution(map: StatMap, id: StatId, c: StatContribution): void {
  const list = map.get(id);
  if (list) list.push(c);
  else map.set(id, [c]);
}

export function mergeStatMaps(...maps: StatMap[]): StatMap {
  const out = emptyStatMap();
  for (const m of maps) {
    for (const [id, list] of m) {
      for (const c of list) addContribution(out, id, c);
    }
  }
  return out;
}

/** A contribution matches when it has no tags (global), OR every required tag
 *  is present in its tag list (contribution may have extra tags — still matches). */
function tagsMatch(contribTags: string[], required: string[]): boolean {
  if (contribTags.length === 0) return true;
  return required.every((t) => contribTags.includes(t));
}

export function sumInc(map: StatMap, id: StatId, required: string[]): number {
  const list = map.get(id);
  if (!list) return 0;
  let sum = 0;
  for (const c of list) {
    if (c.kind !== "increased") continue;
    if (!tagsMatch(c.tags, required)) continue;
    sum += c.value;
  }
  return sum;
}

export function productMore(map: StatMap, id: StatId, required: string[]): number {
  const list = map.get(id);
  if (!list) return 1;
  let prod = 1;
  for (const c of list) {
    if (c.kind !== "more") continue;
    if (!tagsMatch(c.tags, required)) continue;
    prod *= 1 + c.value / 100;
  }
  return prod;
}

export function sumFlat(map: StatMap, id: StatId): number {
  const list = map.get(id);
  if (!list) return 0;
  let sum = 0;
  for (const c of list) if (c.kind === "flat") sum += c.value;
  return sum;
}

export function listMatching(map: StatMap, id: StatId, required: string[]): StatContribution[] {
  const list = map.get(id);
  if (!list) return [];
  return list.filter((c) => tagsMatch(c.tags, required));
}
