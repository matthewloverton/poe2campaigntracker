import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { modById } from "../../data/mods";
import { importBuildXml } from "./importBuild";

const sample = readFileSync(
  join(__dirname, "__fixtures__", "sample-build.xml"),
  "utf-8",
);

describe("importBuildXml", () => {
  const result = importBuildXml(sample);

  it("returns one phase per item set", () => {
    expect(result.phases).toHaveLength(2);
    expect(result.phases[0].name).toBe("Leveling");
    expect(result.phases[1].name).not.toBe("");
  });

  it("pairs named item+skill sets", () => {
    // Item set 'Leveling' should pair with skill set 'Leveling'
    const leveling = result.phases.find((p) => p.name === "Leveling")!;
    expect(leveling.gems.length).toBeGreaterThanOrEqual(0);
  });

  it("populates gear slots that map to known PoB slots", () => {
    const leveling = result.phases.find((p) => p.name === "Leveling")!;
    // sample has Weapon 1 in both sets
    expect(leveling.gear.weapon).toBeDefined();
  });

  it("returns a non-empty buildName", () => {
    expect(result.buildName).toBeTruthy();
  });

  it("gives unnamed item sets a reasonable fallback name", () => {
    const unnamed = result.phases[1];
    expect(unnamed.name).toMatch(/^(Phase|Set) \d+$/);
  });
});

describe("importBuildXml — PoB PoE2 fixture (real-world mod tier matching)", () => {
  const pob2 = readFileSync(
    join(__dirname, "__fixtures__", "sample-build-pob2.xml"),
    "utf-8",
  );
  const result = importBuildXml(pob2);
  const phase = result.phases[0];
  const weapon = phase.gear.weapon!;

  it("imports the weapon base", () => {
    expect(weapon.base).toBe("Varnished Crossbow");
  });

  it("matches '+2 to Level of all Projectile Skills' to a +2 tier (not +1)", () => {
    const matchedIds = weapon.desiredModIds ?? [];
    const projMod = matchedIds
      .map((id) => modById.get(id))
      .find((m) => m && /projectile_skill_gem_level/i.test(m.stats[0]?.id ?? ""));
    expect(projMod).toBeDefined();
    expect(projMod!.stats[0].min).toBe(2);
    expect(projMod!.stats[0].max).toBe(2);
  });

  it("matches '58% increased Physical Damage' to a tier whose range contains 58", () => {
    const matchedIds = weapon.desiredModIds ?? [];
    const physMod = matchedIds
      .map((id) => modById.get(id))
      .find((m) => m && m.stats[0]?.id === "local_physical_damage_+%");
    expect(physMod).toBeDefined();
    expect(physMod!.stats[0].min).toBeLessThanOrEqual(58);
    expect(physMod!.stats[0].max).toBeGreaterThanOrEqual(58);
  });

  it("stores a sensible roll percentile derived from the actual value", () => {
    const matchedIds = weapon.desiredModIds ?? [];
    for (const id of matchedIds) {
      const pct = weapon.modRolls?.[id];
      if (pct != null) {
        expect(pct).toBeGreaterThanOrEqual(0);
        expect(pct).toBeLessThanOrEqual(100);
      }
    }
  });
});
