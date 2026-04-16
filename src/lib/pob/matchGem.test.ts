import { describe, it, expect } from "vitest";
import { allGems } from "../../data/gems";
import { matchSkillGroup } from "./matchGem";
import type { PoBSkill } from "./types";

function makeSkill(overrides: Partial<PoBSkill> = {}): PoBSkill {
  return {
    enabled: true,
    label: "Main",
    mainActiveSkill: 1,
    gems: [],
    ...overrides,
  };
}

describe("matchSkillGroup", () => {
  it("returns null for a disabled group and emits a warning", () => {
    const r = matchSkillGroup(makeSkill({ enabled: false, label: "Off" }));
    expect(r.group).toBeNull();
    expect(r.warnings.some((w) => /disabled/i.test(w.message))).toBe(true);
  });

  it("returns null for a group with no gems", () => {
    const r = matchSkillGroup(makeSkill({ gems: [] }));
    expect(r.group).toBeNull();
  });

  it("builds a group with matched main + supports", () => {
    // pick a gem we know exists
    const active = allGems.find((g) => g.gemType === "active");
    const support = allGems.find((g) => g.gemType === "support");
    if (!active || !support) return;
    const r = matchSkillGroup(
      makeSkill({
        gems: [
          { skillId: active.id, enabled: true, level: 20, quality: 0 },
          { skillId: support.id, enabled: true, level: 20, quality: 0 },
        ],
      }),
    );
    expect(r.group).not.toBeNull();
    expect(r.group!.skill.gemId).toBe(active.id);
    expect(r.group!.supports).toHaveLength(1);
    expect(r.group!.supports[0]!.gemId).toBe(support.id);
    expect(r.warnings).toEqual([]);
  });

  it("keeps an unmatched gem as a synthetic entry with a warning", () => {
    const active = allGems.find((g) => g.gemType === "active");
    if (!active) return;
    const r = matchSkillGroup(
      makeSkill({
        gems: [
          { skillId: active.id, enabled: true, level: 1, quality: 0 },
          { skillId: "UnknownXyzzySupport", enabled: true, level: 1, quality: 0 },
        ],
      }),
    );
    expect(r.group!.supports).toHaveLength(1);
    expect(r.group!.supports[0]!.name).toBe("UnknownXyzzySupport");
    expect(r.warnings.some((w) => /UnknownXyzzySupport/.test(w.message))).toBe(true);
  });

  it("honours mainActiveSkill index (1-based) when != 1", () => {
    const a = allGems.find((g) => g.gemType === "active");
    const b = allGems.find((g) => g.gemType === "active" && g.id !== a?.id);
    if (!a || !b) return;
    const r = matchSkillGroup(
      makeSkill({
        mainActiveSkill: 2,
        gems: [
          { skillId: a.id, enabled: true, level: 20, quality: 0 },
          { skillId: b.id, enabled: true, level: 20, quality: 0 },
        ],
      }),
    );
    expect(r.group!.skill.gemId).toBe(b.id);
  });
});
