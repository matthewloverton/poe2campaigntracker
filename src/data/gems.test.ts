import { describe, it, expect } from "vitest";
import {
  allGems,
  searchGems,
  getRecommendedSupports,
  getGemsByWeaponType,
  getGemsByTier,
  gemById,
} from "./gems";

describe("gems data module", () => {
  it("loads all gems", () => {
    expect(allGems.length).toBeGreaterThan(600);
  });

  it("finds Explosive Grenade", () => {
    const grenade = allGems.find((g) => g.name === "Explosive Grenade");
    expect(grenade).toBeDefined();
    expect(grenade!.gemType).toBe("active");
    expect(grenade!.craftingTypes).toContain("Crossbow");
    expect(grenade!.iconPath).toMatch(/\.webp$/);
  });

  it("searches by name", () => {
    const results = searchGems("explosive");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((g) => g.name === "Explosive Grenade")).toBe(true);
  });

  it("filters by gemType", () => {
    const supports = searchGems("", { gemType: "support" });
    expect(supports.length).toBeGreaterThan(0);
    expect(supports.every((g) => g.gemType === "support")).toBe(true);
  });

  it("filters by craftingType", () => {
    const crossbow = searchGems("", { craftingType: "Crossbow" });
    expect(crossbow.length).toBeGreaterThan(0);
    expect(crossbow.every((g) => g.craftingTypes.includes("Crossbow"))).toBe(true);
  });

  it("filters by color", () => {
    const red = searchGems("", { color: "r" });
    expect(red.length).toBeGreaterThan(0);
    expect(red.every((g) => g.color === "r")).toBe(true);
  });

  it("gets recommended supports for a skill", () => {
    const grenade = allGems.find((g) => g.name === "Explosive Grenade");
    if (!grenade || grenade.recommendedSupports.length === 0) return;
    const supports = getRecommendedSupports(grenade.id);
    expect(supports.length).toBeGreaterThan(0);
    expect(supports.every((s) => s.gemType === "support")).toBe(true);
  });

  it("gets gems by weapon type", () => {
    const crossbow = getGemsByWeaponType("Crossbow");
    expect(crossbow.length).toBeGreaterThan(0);
    expect(crossbow.every((g) => g.craftingTypes.includes("Crossbow"))).toBe(true);
  });

  it("groups gems by tier", () => {
    const tiers = getGemsByTier();
    expect(tiers.size).toBeGreaterThan(0);
    const tier1 = tiers.get(1) ?? [];
    expect(tier1.length).toBeGreaterThan(0);
    expect(tier1.every((g) => g.craftingLevel <= 3)).toBe(true);
  });

  it("indexes gems by id", () => {
    const grenade = allGems.find((g) => g.name === "Explosive Grenade");
    if (!grenade) return;
    expect(gemById.get(grenade.id)).toBe(grenade);
  });
});
