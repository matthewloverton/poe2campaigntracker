import { describe, it, expect } from "vitest";
import { pairSets } from "./pairSets";
import type { PoBItemSet, PoBSkillSet } from "./types";

function makeItemSet(id: number, title: string): PoBItemSet {
  return { id, title, slots: {} };
}
function makeSkillSet(id: number, title: string): PoBSkillSet {
  return { id, title, skills: [] };
}

describe("pairSets", () => {
  it("pairs by name when both have matching titles", () => {
    const items = [makeItemSet(1, "Endgame"), makeItemSet(2, "Leveling")];
    const skills = [makeSkillSet(10, "Leveling"), makeSkillSet(20, "Endgame")];
    const pairs = pairSets(items, skills, 0);
    expect(pairs).toEqual([
      { itemSet: items[0], skillSet: skills[1] }, // Endgame ↔ Endgame
      { itemSet: items[1], skillSet: skills[0] }, // Leveling ↔ Leveling
    ]);
  });

  it("falls back to index pairing when no name match", () => {
    const items = [makeItemSet(1, "A"), makeItemSet(2, "B")];
    const skills = [makeSkillSet(10, "X"), makeSkillSet(20, "Y")];
    const pairs = pairSets(items, skills, 0);
    expect(pairs).toEqual([
      { itemSet: items[0], skillSet: skills[0] },
      { itemSet: items[1], skillSet: skills[1] },
    ]);
  });

  it("mixes name match with index fallback", () => {
    const items = [makeItemSet(1, "Endgame"), makeItemSet(2, "Leveling"), makeItemSet(3, "Extra")];
    const skills = [makeSkillSet(10, "Leveling"), makeSkillSet(20, "Endgame")];
    const pairs = pairSets(items, skills, 20);
    expect(pairs[0]).toEqual({ itemSet: items[0], skillSet: skills[1] }); // Endgame
    expect(pairs[1]).toEqual({ itemSet: items[1], skillSet: skills[0] }); // Leveling
    expect(pairs[2]).toEqual({ itemSet: items[2], skillSet: skills[1] }); // Extra → active
  });

  it("leftover item sets with no skill sets at all use the active skill set", () => {
    const items = [makeItemSet(1, "A"), makeItemSet(2, "B")];
    const skills = [makeSkillSet(10, "Only")];
    const pairs = pairSets(items, skills, 10);
    expect(pairs[0].skillSet).toBe(skills[0]);
    expect(pairs[1].skillSet).toBe(skills[0]);
  });

  it("empty skill sets → pairs with null", () => {
    const items = [makeItemSet(1, "A")];
    const pairs = pairSets(items, [], 0);
    expect(pairs).toEqual([{ itemSet: items[0], skillSet: null }]);
  });

  it("empty item sets → empty result", () => {
    expect(pairSets([], [makeSkillSet(1, "A")], 1)).toEqual([]);
  });
});
