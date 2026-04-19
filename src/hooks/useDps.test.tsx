import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDps } from "./useDps";
import { bareCrossbowGalvanic } from "../lib/dps/__fixtures__/bareCrossbowGalvanic";
import { snapshotFromPhase } from "../lib/dps";

describe("useDps", () => {
  it("returns SkillDps results for a snapshot", () => {
    const snap = snapshotFromPhase(bareCrossbowGalvanic, "", "actual");
    const { result } = renderHook(() => useDps(snap));
    expect(result.current.length).toBeGreaterThan(0);
    expect(result.current[0].skillName).toBe("Galvanic Shards");
  });

  it("memoises on snapshot identity — same snapshot returns same array reference", () => {
    const snap = snapshotFromPhase(bareCrossbowGalvanic, "", "actual");
    const { result, rerender } = renderHook(
      ({ s }) => useDps(s),
      { initialProps: { s: snap } },
    );
    const first = result.current;
    rerender({ s: snap });
    expect(result.current).toBe(first);
  });
});
