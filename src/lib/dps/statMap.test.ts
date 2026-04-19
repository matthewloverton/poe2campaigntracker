import { describe, it, expect } from "vitest";
import {
  emptyStatMap,
  addContribution,
  mergeStatMaps,
  sumInc,
  productMore,
  sumFlat,
  listMatching,
} from "./statMap";
import type { ModifierSource } from "./types";

const src = (id: string, label: string): ModifierSource => ({ type: "gear", id, label });

describe("statMap", () => {
  it("adds contributions under a stat id", () => {
    const m = emptyStatMap();
    addContribution(m, "physical_damage_+%", { value: 20, kind: "increased", tags: ["attack"], source: src("ring1", "Ring 1") });
    addContribution(m, "physical_damage_+%", { value: 15, kind: "increased", tags: ["attack"], source: src("gloves", "Gloves") });
    expect(m.get("physical_damage_+%")?.length).toBe(2);
  });

  it("returns 0 / 1 for unknown stat ids", () => {
    const m = emptyStatMap();
    expect(sumInc(m, "missing", [])).toBe(0);
    expect(sumFlat(m, "missing")).toBe(0);
    expect(productMore(m, "missing", [])).toBe(1);
  });

  it("sumInc adds increased contributions matching the required tag", () => {
    const m = emptyStatMap();
    addContribution(m, "damage_+%", { value: 20, kind: "increased", tags: ["attack"], source: src("a", "A") });
    addContribution(m, "damage_+%", { value: 30, kind: "increased", tags: ["spell"], source: src("b", "B") });
    expect(sumInc(m, "damage_+%", ["attack"])).toBe(20);
    expect(sumInc(m, "damage_+%", ["spell"])).toBe(30);
  });

  it("sumInc ignores flat and more contributions", () => {
    const m = emptyStatMap();
    addContribution(m, "x", { value: 50, kind: "flat", tags: [], source: src("a", "A") });
    addContribution(m, "x", { value: 40, kind: "more", tags: [], source: src("b", "B") });
    expect(sumInc(m, "x", [])).toBe(0);
  });

  it("productMore multiplies more contributions matching tags", () => {
    const m = emptyStatMap();
    addContribution(m, "damage_+%_final", { value: 40, kind: "more", tags: ["projectile"], source: src("a", "A") });
    addContribution(m, "damage_+%_final", { value: 25, kind: "more", tags: ["projectile"], source: src("b", "B") });
    // (1 + 0.40) * (1 + 0.25) = 1.75
    expect(productMore(m, "damage_+%_final", ["projectile"])).toBeCloseTo(1.75, 6);
  });

  it("productMore ignores non-more kinds", () => {
    const m = emptyStatMap();
    addContribution(m, "x", { value: 40, kind: "increased", tags: [], source: src("a", "A") });
    expect(productMore(m, "x", [])).toBe(1);
  });

  it("sumFlat sums flat contributions", () => {
    const m = emptyStatMap();
    addContribution(m, "base_fire_damage_min", { value: 5, kind: "flat", tags: [], source: src("a", "A") });
    addContribution(m, "base_fire_damage_min", { value: 3, kind: "flat", tags: [], source: src("b", "B") });
    expect(sumFlat(m, "base_fire_damage_min")).toBe(8);
  });

  it("global-tag contributions (empty tags) match any query", () => {
    const m = emptyStatMap();
    addContribution(m, "damage_+%", { value: 25, kind: "increased", tags: [], source: src("a", "A") });
    expect(sumInc(m, "damage_+%", ["attack"])).toBe(25);
    expect(sumInc(m, "damage_+%", ["spell", "fire"])).toBe(25);
  });

  it("contributions with tags are ignored when required tag is absent", () => {
    const m = emptyStatMap();
    addContribution(m, "damage_+%", { value: 50, kind: "increased", tags: ["spell"], source: src("a", "A") });
    expect(sumInc(m, "damage_+%", ["attack"])).toBe(0);
  });

  it("requires ALL query tags to be present on the contribution", () => {
    const m = emptyStatMap();
    addContribution(m, "damage_+%", { value: 33, kind: "increased", tags: ["attack"], source: src("a", "A") });
    // only "attack" on contribution; query needs both "attack" and "projectile"
    expect(sumInc(m, "damage_+%", ["attack", "projectile"])).toBe(0);
  });

  it("matches when contribution has a superset of query tags", () => {
    const m = emptyStatMap();
    addContribution(m, "damage_+%", { value: 33, kind: "increased", tags: ["attack", "projectile", "fire"], source: src("a", "A") });
    expect(sumInc(m, "damage_+%", ["attack", "projectile"])).toBe(33);
  });

  it("mergeStatMaps combines contributions across maps", () => {
    const a = emptyStatMap();
    const b = emptyStatMap();
    addContribution(a, "x", { value: 1, kind: "flat", tags: [], source: src("a", "A") });
    addContribution(b, "x", { value: 2, kind: "flat", tags: [], source: src("b", "B") });
    const merged = mergeStatMaps(a, b);
    expect(merged.get("x")?.length).toBe(2);
    expect(sumFlat(merged, "x")).toBe(3);
  });

  it("mergeStatMaps is non-mutating", () => {
    const a = emptyStatMap();
    const b = emptyStatMap();
    addContribution(a, "x", { value: 1, kind: "flat", tags: [], source: src("a", "A") });
    addContribution(b, "x", { value: 2, kind: "flat", tags: [], source: src("b", "B") });
    const before = a.get("x")?.length;
    mergeStatMaps(a, b);
    expect(a.get("x")?.length).toBe(before);
  });

  it("listMatching returns only matching contributions", () => {
    const m = emptyStatMap();
    addContribution(m, "damage_+%", { value: 10, kind: "increased", tags: ["attack"], source: src("a", "A") });
    addContribution(m, "damage_+%", { value: 20, kind: "increased", tags: ["spell"], source: src("b", "B") });
    const matched = listMatching(m, "damage_+%", ["attack"]);
    expect(matched.length).toBe(1);
    expect(matched[0].value).toBe(10);
  });
});
