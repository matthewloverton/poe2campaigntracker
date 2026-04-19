import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DpsBreakdown } from "./DpsBreakdown";

describe("DpsBreakdown", () => {
  it("renders all stages and the total", () => {
    const { getByText } = render(
      <DpsBreakdown
        breakdown={{
          stages: [
            { kind: "base", label: "Base per hit", value: "100 – 200" },
            { kind: "rate", label: "Rate 1.60/s", value: 1.6 },
            { kind: "total", label: "Total DPS", value: 12345 },
          ],
          sources: [
            { type: "gear", count: 3 },
            { type: "skill", count: 1 },
          ],
        }}
      />,
    );
    expect(getByText("Base per hit")).toBeTruthy();
    expect(getByText("Total DPS")).toBeTruthy();
    expect(getByText("12,345")).toBeTruthy();
    expect(getByText(/Sources:.*3 gear.*1 skill/)).toBeTruthy();
  });

  it("hides the sources footer when sources are empty", () => {
    const { queryByText } = render(
      <DpsBreakdown breakdown={{ stages: [], sources: [] }} />,
    );
    expect(queryByText(/Sources:/)).toBeNull();
  });
});
