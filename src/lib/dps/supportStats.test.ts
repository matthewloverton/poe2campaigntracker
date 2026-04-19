import { describe, it, expect } from "vitest";
import { supportApplies, collectSupportStats } from "./supportStats";
import { sumInc, sumFlat } from "./statMap";
import type { GemEntry } from "../../types/itemDatabase";

function makeSkill(types: string[]): GemEntry {
  return {
    id: "skill",
    name: "Skill",
    gemType: "active",
    color: "g",
    craftingLevel: 1,
    craftingTypes: [],
    tags: [],
    recommendedSupports: [],
    requirementWeights: { strength: 0, dexterity: 0, intelligence: 0 },
    iconPath: "",
    skillDetail: {
      maxLevel: 1,
      levels: { "1": { costs: {}, statText: [], stats: {} } },
      staticStatText: [],
      qualityStats: [],
      statSets: [],
      activeSkillTypes: types,
    },
  };
}

function makeSupport(
  stats: Record<string, number>,
  opts: { allowed?: string[]; excluded?: string[] } = {},
): GemEntry {
  return {
    id: "support-1",
    name: "Support One",
    gemType: "support",
    color: "g",
    craftingLevel: 1,
    craftingTypes: [],
    tags: [],
    recommendedSupports: [],
    requirementWeights: { strength: 0, dexterity: 0, intelligence: 0 },
    iconPath: "",
    allowedActiveSkillTypes: opts.allowed,
    excludedActiveSkillTypes: opts.excluded,
    skillDetail: {
      maxLevel: 1,
      levels: { "1": { costs: {}, statText: [], stats } },
      staticStatText: [],
      qualityStats: [],
      statSets: [],
    },
  };
}

describe("supportApplies", () => {
  it("applies when allowed types intersect the skill's types", () => {
    const skill = makeSkill(["Attack", "Projectile"]);
    const sup = makeSupport({}, { allowed: ["Projectile"] });
    expect(supportApplies(sup, skill)).toBe(true);
  });

  it("does not apply when allowed types are non-empty and do not intersect", () => {
    const skill = makeSkill(["Spell"]);
    const sup = makeSupport({}, { allowed: ["Projectile"] });
    expect(supportApplies(sup, skill)).toBe(false);
  });

  it("applies when allowed types are undefined (no allow-list constraint)", () => {
    const skill = makeSkill(["Spell"]);
    const sup = makeSupport({});
    expect(supportApplies(sup, skill)).toBe(true);
  });

  it("does not apply when excluded types intersect the skill's types", () => {
    const skill = makeSkill(["Attack", "Channelled"]);
    const sup = makeSupport({}, { allowed: ["Attack"], excluded: ["Channelled"] });
    expect(supportApplies(sup, skill)).toBe(false);
  });

  it("applies when excluded types do not intersect", () => {
    const skill = makeSkill(["Attack"]);
    const sup = makeSupport({}, { excluded: ["Channelled"] });
    expect(supportApplies(sup, skill)).toBe(true);
  });

  it("applies when allowed types list is empty (empty array treated as no constraint)", () => {
    const skill = makeSkill(["Attack"]);
    const sup = makeSupport({}, { allowed: [] });
    expect(supportApplies(sup, skill)).toBe(true);
  });

  it("applies when the skill has no activeSkillTypes but no allow list", () => {
    const skill = makeSkill([]);
    const sup = makeSupport({});
    expect(supportApplies(sup, skill)).toBe(true);
  });

  it("does not apply when the skill has no activeSkillTypes but support has an allow list", () => {
    const skill = makeSkill([]);
    const sup = makeSupport({}, { allowed: ["Attack"] });
    expect(supportApplies(sup, skill)).toBe(false);
  });
});

describe("collectSupportStats", () => {
  it("adds increased contributions tagged with the skill's tags", () => {
    const skill = makeSkill(["Attack", "Projectile"]);
    const sup = makeSupport({ "projectile_damage_+%": 40 });
    const map = collectSupportStats([sup], skill);
    expect(sumInc(map, "projectile_damage_+%", ["attack", "projectile"])).toBe(40);
  });

  it("adds flat contributions", () => {
    const skill = makeSkill(["Attack"]);
    const sup = makeSupport({ base_fire_damage_min: 6 });
    const map = collectSupportStats([sup], skill);
    expect(sumFlat(map, "base_fire_damage_min")).toBe(6);
  });

  it("skips non-applying supports", () => {
    const skill = makeSkill(["Spell"]);
    const sup = makeSupport({ "projectile_damage_+%": 40 }, { allowed: ["Projectile"] });
    const map = collectSupportStats([sup], skill);
    expect(map.size).toBe(0);
  });

  it("skips zero-valued stats", () => {
    const skill = makeSkill(["Attack"]);
    const sup = makeSupport({ base_fire_damage_min: 0, base_fire_damage_max: 9 });
    const map = collectSupportStats([sup], skill);
    expect(map.size).toBe(1);
    expect(sumFlat(map, "base_fire_damage_max")).toBe(9);
  });

  it("sources each contribution to the support gem's id and name", () => {
    const skill = makeSkill(["Attack"]);
    const sup = makeSupport({ base_fire_damage_min: 6 });
    const map = collectSupportStats([sup], skill);
    const list = map.get("base_fire_damage_min")!;
    expect(list[0].source.type).toBe("support");
    expect(list[0].source.id).toBe("support-1");
    expect(list[0].source.label).toBe("Support One");
  });

  it("aggregates multiple supports with the same stat id", () => {
    const skill = makeSkill(["Attack"]);
    const a = makeSupport({ "damage_+%": 20 });
    const b = makeSupport({ "damage_+%": 15 });
    b.id = "support-2";
    b.name = "Support Two";
    const map = collectSupportStats([a, b], skill);
    expect(sumInc(map, "damage_+%", ["attack"])).toBe(35);
  });

  it("returns an empty map when supports array is empty", () => {
    const skill = makeSkill(["Attack"]);
    const map = collectSupportStats([], skill);
    expect(map.size).toBe(0);
  });

  it("falls back to maxLevel data when level missing (default level=1)", () => {
    const skill = makeSkill(["Attack"]);
    const sup = makeSupport({ "damage_+%": 20 });
    // Request level=5 which is not explicitly present; must fall back
    const map = collectSupportStats([sup], skill, 5);
    expect(sumInc(map, "damage_+%", ["attack"])).toBe(20);
  });
});
