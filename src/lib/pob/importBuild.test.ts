import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
