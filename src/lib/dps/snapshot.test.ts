import { describe, it, expect } from "vitest";
import { snapshotFromPhase, swapWeapon } from "./snapshot";
import type { BuildPhase, BuildGearEntry } from "../../types/buildPlan";
import { EMPTY_GEAR_LAYOUT } from "../../types/buildPlan";

function makePhase(overrides: Partial<BuildPhase> = {}): BuildPhase {
  return {
    id: "p1",
    name: "Phase 1",
    order: 0,
    trigger: { type: "manual" },
    gear: { ...EMPTY_GEAR_LAYOUT },
    gems: [],
    regexes: [],
    ...overrides,
  };
}

function makeSkillGroup(skillId: string, name: string, priority = 0) {
  return {
    id: `g-${skillId}`,
    skill: {
      id: skillId,
      name,
      category: "skill" as const,
      priority,
      supports: [] as string[],
    },
    supports: [],
    priority,
  };
}

describe("snapshotFromPhase", () => {
  it("produces a snapshot with the phase's gear and skill groups by reference", () => {
    const phase = makePhase({ gems: [makeSkillGroup("s1", "Gas Grenade")] });
    const snap = snapshotFromPhase(phase, "s1", "actual");
    expect(snap.gear).toBe(phase.gear);
    expect(snap.skillGroups).toBe(phase.gems);
    expect(snap.primarySkillId).toBe("s1");
    expect(snap.rollMode).toBe("actual");
  });

  it("defaults primarySkillId to the first skill group when given empty string", () => {
    const phase = makePhase({
      gems: [
        makeSkillGroup("s1", "A"),
        makeSkillGroup("s2", "B", 1),
      ],
    });
    expect(snapshotFromPhase(phase, "", "actual").primarySkillId).toBe("s1");
  });

  it("defaults primarySkillId to empty string when no skill groups present", () => {
    const phase = makePhase({ gems: [] });
    expect(snapshotFromPhase(phase, "", "actual").primarySkillId).toBe("");
  });

  it("passes through rollMode unchanged", () => {
    const phase = makePhase();
    expect(snapshotFromPhase(phase, "", "max").rollMode).toBe("max");
  });
});

describe("swapWeapon", () => {
  it("returns a new snapshot with the replacement weapon", () => {
    const phase = makePhase();
    const base = snapshotFromPhase(phase, "", "actual");
    const weapon: BuildGearEntry = {
      id: "rolled-1",
      slot: "weapon",
      base: "Expert Crossbow",
      desiredMods: [],
      notes: "",
    };
    const swapped = swapWeapon(base, weapon);
    expect(swapped.gear.weapon).toBe(weapon);
  });

  it("preserves all other gear slots", () => {
    const phase = makePhase();
    const base = snapshotFromPhase(phase, "", "actual");
    const weapon: BuildGearEntry = {
      id: "rolled-1", slot: "weapon", base: "Expert Crossbow", desiredMods: [], notes: "",
    };
    const swapped = swapWeapon(base, weapon);
    expect(swapped.gear.helmet).toBe(base.gear.helmet);
    expect(swapped.gear.ring1).toBe(base.gear.ring1);
    expect(swapped.gear.amulet).toBe(base.gear.amulet);
  });

  it("accepts null to clear the weapon", () => {
    const phase = makePhase();
    const base = snapshotFromPhase(phase, "", "actual");
    const swapped = swapWeapon(base, null);
    expect(swapped.gear.weapon).toBeNull();
  });

  it("does not mutate the original snapshot or its gear", () => {
    const phase = makePhase();
    const base = snapshotFromPhase(phase, "", "actual");
    const beforeGear = base.gear;
    const weapon: BuildGearEntry = {
      id: "rolled-1", slot: "weapon", base: "Expert Crossbow", desiredMods: [], notes: "",
    };
    swapWeapon(base, weapon);
    expect(base.gear).toBe(beforeGear);
    expect(base.gear.weapon).toBeNull();
  });
});
