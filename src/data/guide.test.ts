import { describe, it, expect } from "vitest";
import { transformGuideData, extractTargetAreaId } from "./guide";

describe("extractTargetAreaId", () => {
  it("extracts area ID from a step with areaid prefix", () => {
    const result = extractTargetAreaId([
      "kill the_bloated_miller",
      "enter areaidg1_town ;; clearfell encampment",
    ]);
    expect(result).toEqual({ id: "g1_town", name: "clearfell encampment" });
  });

  it("extracts the last area ID when multiple exist", () => {
    const result = extractTargetAreaId([
      "(img:quest_2) renly: (img:skill) || enter areaidg1_2 ;; clearfell",
      "go to areaidg1_3 ;; mud burrow",
    ]);
    expect(result).toEqual({ id: "g1_3", name: "mud burrow" });
  });

  it("returns empty strings when no area ID found", () => {
    const result = extractTargetAreaId(["kill some_boss", "pick up loot"]);
    expect(result).toEqual({ id: "", name: "" });
  });
});

describe("transformGuideData", () => {
  it("transforms a simple act with two pages", () => {
    const raw = [
      [
        ["step one", "enter areaidg1_town ;; town"],
        ["step two", "go to areaidg1_2 ;; clearfell"],
      ],
    ];
    const pages = transformGuideData(raw);
    expect(pages).toHaveLength(2);
    expect(pages[0].act).toBe(1);
    expect(pages[0].pageIndex).toBe(0);
    expect(pages[0].globalIndex).toBe(0);
    expect(pages[0].targetAreaId).toBe("g1_town");
    expect(pages[0].targetZoneName).toBe("town");
    expect(pages[0].steps).toHaveLength(2);
    expect(pages[1].act).toBe(1);
    expect(pages[1].pageIndex).toBe(1);
    expect(pages[1].globalIndex).toBe(1);
    expect(pages[1].targetAreaId).toBe("g1_2");
  });

  it("handles conditional pages", () => {
    const raw = [
      [
        ["step one", "enter areaidg1_town ;; town"],
        {
          condition: ["league-start", "yes"] as [string, string],
          lines: ["league start step", "enter areaidg1_2 ;; zone"],
        },
        {
          condition: ["league-start", "no"] as [string, string],
          lines: ["non-league step", "enter areaidg1_2 ;; zone"],
        },
      ],
    ];
    const pages = transformGuideData(raw);
    expect(pages).toHaveLength(3);
    expect(pages[1].condition).toEqual({ key: "league-start", value: "yes" });
    expect(pages[2].condition).toEqual({ key: "league-start", value: "no" });
  });

  it("assigns correct act numbers across multiple acts", () => {
    const raw = [
      [["enter areaidg1_town ;; town1"]],
      [["enter areaidg2_town ;; town2"]],
    ];
    const pages = transformGuideData(raw);
    expect(pages[0].act).toBe(1);
    expect(pages[1].act).toBe(2);
    expect(pages[1].globalIndex).toBe(1);
  });
});
