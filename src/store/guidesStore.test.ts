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

describe("guidesStore — page mutations", () => {
  let gid: string;
  beforeEach(() => {
    useGuidesStore.setState({ guides: [], activeGuideId: "default", hydrated: true });
    gid = useGuidesStore.getState().createGuideFromDefault("Test");
  });

  it("addPage appends an empty page to the given act", () => {
    const before = useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries.length;
    useGuidesStore.getState().addPage(gid, 1);
    const after = useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries.length;
    expect(after).toBe(before + 1);
    const entry = useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries[after - 1];
    expect(entry).toEqual({ type: "page", lines: [] });
  });

  it("deletePage removes the target entry", () => {
    const before = useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries.length;
    useGuidesStore.getState().deletePage(gid, 1, 0);
    const after = useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries.length;
    expect(after).toBe(before - 1);
  });

  it("reorderPages reorders within the act", () => {
    const act = useGuidesStore.getState().guides.find((g) => g.id === gid)!.acts[0];
    const firstLines =
      act.entries[0].type === "page" ? [...act.entries[0].lines] : null;
    useGuidesStore.getState().reorderPages(gid, 1, [1, 0, ...act.entries.slice(2).keys()].slice(0, act.entries.length));
    const newFirst = useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries[0];
    expect(newFirst).not.toEqual(act.entries[0]);
    // sanity: first-original entry now at index 1
    expect(useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries[1].type === "page"
      ? (useGuidesStore.getState().guides.find((g) => g.id === gid)!
          .acts[0].entries[1] as { type: "page"; lines: string[] }).lines
      : null).toEqual(firstLines);
  });

  it("setPageCondition converts page -> conditional and back", () => {
    useGuidesStore.getState().setPageCondition(gid, 1, 0, ["league-start", "no"]);
    const entry = useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries[0];
    expect(entry.type).toBe("conditional");
    if (entry.type === "conditional") {
      expect(entry.condition).toEqual(["league-start", "no"]);
    }
    useGuidesStore.getState().setPageCondition(gid, 1, 0, null);
    const entry2 = useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries[0];
    expect(entry2.type).toBe("page");
  });
});

describe("guidesStore — step mutations", () => {
  let gid: string;
  beforeEach(() => {
    useGuidesStore.setState({ guides: [], activeGuideId: "default", hydrated: true });
    gid = useGuidesStore.getState().createGuideFromDefault("Test");
  });

  it("addStep appends an empty line", () => {
    const before = (useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries[0] as { type: "page"; lines: string[] }).lines.length;
    useGuidesStore.getState().addStep(gid, 1, 0);
    const after = (useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries[0] as { type: "page"; lines: string[] }).lines.length;
    expect(after).toBe(before + 1);
  });

  it("setStepLine updates the raw text at an index", () => {
    useGuidesStore.getState().setStepLine(gid, 1, 0, 0, "new line");
    const lines = (useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries[0] as { type: "page"; lines: string[] }).lines;
    expect(lines[0]).toBe("new line");
  });

  it("deleteStep removes the line at an index", () => {
    const before = (useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries[0] as { type: "page"; lines: string[] }).lines.length;
    useGuidesStore.getState().deleteStep(gid, 1, 0, 0);
    const after = (useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries[0] as { type: "page"; lines: string[] }).lines.length;
    expect(after).toBe(before - 1);
  });

  it("reorderSteps reorders lines within a page", () => {
    useGuidesStore.getState().setStepLine(gid, 1, 0, 0, "A");
    useGuidesStore.getState().addStep(gid, 1, 0);
    const page = useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries[0] as { type: "page"; lines: string[] };
    const last = page.lines.length - 1;
    useGuidesStore.getState().setStepLine(gid, 1, 0, last, "B");
    useGuidesStore.getState().reorderSteps(gid, 1, 0, [last, ...Array.from({ length: last }, (_, i) => i)]);
    const newFirst = (useGuidesStore.getState().guides.find((g) => g.id === gid)!
      .acts[0].entries[0] as { type: "page"; lines: string[] }).lines[0];
    expect(newFirst).toBe("B");
  });
});
