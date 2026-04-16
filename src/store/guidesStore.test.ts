import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGuidesStore } from "./guidesStore";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(""),
}));

describe("guidesStore — guide-level mutations", () => {
  beforeEach(() => {
    useGuidesStore.setState({
      guides: [],
      activeGuideId: "default",
      hydrated: true,
    });
  });

  it("createGuideFromDefault adds a guide with deep-copied acts", () => {
    const id = useGuidesStore.getState().createGuideFromDefault("My Guide");
    const g = useGuidesStore.getState().guides.find((x) => x.id === id)!;
    expect(g.name).toBe("My Guide");
    expect(g.acts.length).toBeGreaterThan(0);
    // deep copy: mutating a line should not affect any other guide
    g.acts[0].entries[0] = { type: "page", lines: ["mutated"] };
    const id2 = useGuidesStore.getState().createGuideFromDefault("Another");
    const g2 = useGuidesStore.getState().guides.find((x) => x.id === id2)!;
    expect(g2.acts[0].entries[0]).not.toEqual({ type: "page", lines: ["mutated"] });
  });

  it("duplicateGuide produces a distinct copy with a new id and ' (copy)' suffix", () => {
    const srcId = useGuidesStore.getState().createGuideFromDefault("Source");
    const dupId = useGuidesStore.getState().duplicateGuide(srcId);
    expect(dupId).not.toBe(srcId);
    const dup = useGuidesStore.getState().guides.find((x) => x.id === dupId)!;
    expect(dup.name).toBe("Source (copy)");
    expect(dup.acts.length).toEqual(
      useGuidesStore.getState().guides.find((x) => x.id === srcId)!.acts.length,
    );
  });

  it("renameGuide updates the name and updatedAt", () => {
    const id = useGuidesStore.getState().createGuideFromDefault("Old");
    const before = useGuidesStore.getState().guides.find((x) => x.id === id)!.updatedAt;
    // ensure a tick passes so updatedAt differs
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.parse(before) + 1000));
    useGuidesStore.getState().renameGuide(id, "New");
    vi.useRealTimers();
    const g = useGuidesStore.getState().guides.find((x) => x.id === id)!;
    expect(g.name).toBe("New");
    expect(g.updatedAt).not.toBe(before);
  });

  it("deleteGuide removes the guide; if active, active falls back to default", () => {
    const id = useGuidesStore.getState().createGuideFromDefault("To delete");
    useGuidesStore.getState().setActiveGuide(id);
    useGuidesStore.getState().deleteGuide(id);
    expect(useGuidesStore.getState().guides).toHaveLength(0);
    expect(useGuidesStore.getState().activeGuideId).toBe("default");
  });

  it("setActiveConditions merges into the guide's activeConditions", () => {
    const id = useGuidesStore.getState().createGuideFromDefault("G");
    useGuidesStore.getState().setActiveConditions(id, { "league-start": "no" });
    const g = useGuidesStore.getState().guides.find((x) => x.id === id)!;
    expect(g.activeConditions["league-start"]).toBe("no");
  });
});
