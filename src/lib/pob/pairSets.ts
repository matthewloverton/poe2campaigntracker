import type { PoBItemSet, PoBSkillSet } from "./types";

export interface SetPair {
  itemSet: PoBItemSet;
  skillSet: PoBSkillSet | null;
}

/**
 * Pair each PoB item set with a skill set.
 * 1. Name match first (non-empty titles that match exactly).
 * 2. Index fallback for any remaining item sets, in original order.
 * 3. Leftover item sets use the active skill set (by id), or null if there are none.
 */
export function pairSets(
  itemSets: PoBItemSet[],
  skillSets: PoBSkillSet[],
  activeSkillSetId: number,
): SetPair[] {
  const result: SetPair[] = [];
  const takenSkillIds = new Set<number>();

  // Pass 1: name match (only when title is non-empty).
  const pairedByName = new Map<number, PoBSkillSet>();
  for (const i of itemSets) {
    if (!i.title) continue;
    const match = skillSets.find((s) => s.title === i.title && !takenSkillIds.has(s.id));
    if (match) {
      pairedByName.set(i.id, match);
      takenSkillIds.add(match.id);
    }
  }

  // Pass 2: index fallback over remaining.
  const remainingSkills = skillSets.filter((s) => !takenSkillIds.has(s.id));
  let skillCursor = 0;
  const activeSkillSet = skillSets.find((s) => s.id === activeSkillSetId) ?? null;

  for (const i of itemSets) {
    const named = pairedByName.get(i.id);
    if (named) {
      result.push({ itemSet: i, skillSet: named });
      continue;
    }
    if (skillCursor < remainingSkills.length) {
      result.push({ itemSet: i, skillSet: remainingSkills[skillCursor] });
      skillCursor++;
      continue;
    }
    // Pass 3: leftover → active skill set (may be null if there are none).
    result.push({ itemSet: i, skillSet: activeSkillSet });
  }

  return result;
}
