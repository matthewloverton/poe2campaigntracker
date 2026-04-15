import { describe, it, expect } from "vitest";
import { allItems, itemsByClass, searchItems, getItemsByClass } from "./items";

describe("items data module", () => {
  it("loads all base items", () => {
    expect(allItems.length).toBeGreaterThan(900);
  });

  it("indexes items by class", () => {
    const crossbows = itemsByClass.get("Crossbow");
    expect(crossbows).toBeDefined();
    expect(crossbows!.length).toBeGreaterThan(20);
  });

  it("searches items by name", () => {
    const results = searchItems("varnished");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("Varnished Crossbow");
  });

  it("searches case-insensitively", () => {
    const results = searchItems("VARNISHED");
    expect(results.length).toBeGreaterThan(0);
  });

  it("filters search by item class", () => {
    const results = searchItems("", "Crossbow");
    expect(results.every((r) => r.itemClass === "Crossbow")).toBe(true);
    expect(results.length).toBeGreaterThan(20);
  });

  it("returns items sorted by drop level within a class", () => {
    const crossbows = getItemsByClass("Crossbow");
    for (let i = 1; i < crossbows.length; i++) {
      expect(crossbows[i].dropLevel).toBeGreaterThanOrEqual(crossbows[i - 1].dropLevel);
    }
  });

  it("returns empty for unknown class", () => {
    expect(getItemsByClass("FakeClass")).toEqual([]);
  });
});
