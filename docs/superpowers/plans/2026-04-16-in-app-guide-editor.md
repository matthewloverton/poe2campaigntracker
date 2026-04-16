# In-App Guide Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an in-app editor that lets the user manage multiple named custom guides (forked from the default or duplicated from an existing one), reorder acts/pages/steps, and edit steps via a toolbar that splices raw syntax into a text input with live preview.

**Architecture:** A new Zustand store (`guidesStore`) holds an array of `StoredGuide` objects in user data (`guides.json`, written via existing Tauri `read_user_data` / `write_user_data` commands, same as `timerStore`). The running-guide `guideStore` is refactored to look up its pages from either the bundled default (unchanged) or `guidesStore` by id, applying the selected guide's `activeConditions` as the page filter. A full-screen modal component tree renders the editor UI and mutates `guidesStore`; steps stay as raw-syntax strings throughout, re-tokenized for preview via the existing `tokenize()` / `StepRenderer` pipeline.

**Tech Stack:** React 19 + TypeScript, Zustand, Vite, Vitest (+ jsdom), Tauri 2, `@dnd-kit/*` for drag-reorder (existing pattern in `src/components/DragList/DragList.tsx`).

**Spec:** `docs/superpowers/specs/2026-04-16-in-app-guide-editor-design.md`

---

## File Structure

**New files:**
- `src/store/guidesStore.ts` — the new store (state + mutations + persistence).
- `src/store/guidesStore.test.ts` — unit tests.
- `src/components/GuideEditor/GuideEditor.tsx` — modal shell + selection state.
- `src/components/GuideEditor/GuideEditor.module.css`
- `src/components/GuideEditor/GuideTree.tsx` — left pane.
- `src/components/GuideEditor/GuidePane.tsx` — right pane: guide selected.
- `src/components/GuideEditor/ActPane.tsx` — right pane: act selected.
- `src/components/GuideEditor/PageEditor.tsx` — right pane: page selected.
- `src/components/GuideEditor/StepRow.tsx` — one step row (toolbar + input + preview).
- `src/components/GuideEditor/pickers/IconPicker.tsx`
- `src/components/GuideEditor/pickers/ZonePicker.tsx`
- `src/components/GuideEditor/pickers/ColorPicker.tsx`
- `src/components/GuideEditor/pickers/SimplePicker.tsx` — shared quest/arena/class.

**Modified files:**
- `src/types.ts` — new stored-guide types.
- `src/store/guideStore.ts` — id-based `setGuide`; read from `guidesStore` for non-default.
- `src/store/settingsStore.ts` — `settings.guide` becomes a string id; migration from `"default" | "custom"`.
- `src/data/guide.ts` — export a `transformStoredGuide(StoredGuide): GuidePage[]` helper (or reuse `transformGuideData` via a converter).
- `src/App.tsx` — add "Guides" button to the build-plan header; mount `<GuideEditor>` modal.
- `src/components/Settings/Settings.tsx` — replace default/custom radio pair with a guides dropdown.

---

### Task 1: Add stored-guide types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add types**

Append to `src/types.ts` (after `CompletedRun`):

```typescript
/** Page entry as persisted: either a plain page or a conditional page. */
export type StoredEntry =
  | { type: "page"; lines: string[] }
  | { type: "conditional"; condition: [string, string]; lines: string[] };

/** One act in a stored guide. `entries` preserves page order. */
export interface StoredAct {
  entries: StoredEntry[];
}

/** A user-editable guide persisted in guides.json. */
export interface StoredGuide {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  acts: StoredAct[];
  activeConditions: Record<string, string>;
}

/** On-disk shape of guides.json */
export interface GuidesFile {
  version: 1;
  activeGuideId: string;   // "default" or a StoredGuide.id
  guides: StoredGuide[];   // user-created only; default is bundled
}
```

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/types.ts
git commit -m "types: add StoredGuide / GuidesFile for in-app guide editor"
```

---

### Task 2: Guide-level mutations on `guidesStore`

**Files:**
- Create: `src/store/guidesStore.ts`
- Create: `src/store/guidesStore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/store/guidesStore.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/store/guidesStore.test.ts
```

Expected: all 5 tests fail (module missing).

- [ ] **Step 3: Implement `guidesStore.ts`**

Create `src/store/guidesStore.ts`:

```typescript
import { create } from "zustand";
import type { GuidesFile, StoredAct, StoredGuide, StoredEntry } from "../types";
import rawGuideData from "../data/raw/guide.json";

type RawStep = string;
type RawPage = RawStep[];
type RawConditionalPage = { condition: [string, string]; lines: string[] };
type RawEntry = RawPage | RawConditionalPage;
type RawAct = RawEntry[];

interface GuidesStoreState {
  guides: StoredGuide[];
  activeGuideId: string; // "default" or a guide id
  hydrated: boolean;
  createGuideFromDefault: (name: string) => string;
  duplicateGuide: (sourceId: string) => string;
  renameGuide: (id: string, name: string) => void;
  deleteGuide: (id: string) => void;
  setActiveGuide: (id: string) => void;
  setActiveConditions: (id: string, conditions: Record<string, string>) => void;
  load: () => Promise<void>;
  save: () => Promise<void>;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Convert the raw bundled default guide JSON into StoredAct[]. */
function rawToActs(raw: unknown): StoredAct[] {
  const acts = raw as RawAct[];
  return acts.map((act) => ({
    entries: act.map<StoredEntry>((entry) => {
      if (Array.isArray(entry)) {
        return { type: "page", lines: [...entry] };
      }
      return {
        type: "conditional",
        condition: [entry.condition[0], entry.condition[1]],
        lines: [...entry.lines],
      };
    }),
  }));
}

function deepCloneActs(acts: StoredAct[]): StoredAct[] {
  return acts.map((a) => ({
    entries: a.entries.map<StoredEntry>((e) =>
      e.type === "page"
        ? { type: "page", lines: [...e.lines] }
        : {
            type: "conditional",
            condition: [e.condition[0], e.condition[1]],
            lines: [...e.lines],
          },
    ),
  }));
}

function findGuide(
  guides: StoredGuide[],
  id: string,
): StoredGuide | undefined {
  return guides.find((g) => g.id === id);
}

function updateGuide(
  guides: StoredGuide[],
  id: string,
  fn: (g: StoredGuide) => StoredGuide,
): StoredGuide[] {
  return guides.map((g) => (g.id === id ? { ...fn(g), updatedAt: nowIso() } : g));
}

export const useGuidesStore = create<GuidesStoreState>((set, get) => ({
  guides: [],
  activeGuideId: "default",
  hydrated: false,

  createGuideFromDefault: (name) => {
    const id = crypto.randomUUID();
    const guide: StoredGuide = {
      id,
      name,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      acts: rawToActs(rawGuideData),
      activeConditions: { "league-start": "yes" },
    };
    set((s) => ({ guides: [...s.guides, guide] }));
    get().save();
    return id;
  },

  duplicateGuide: (sourceId) => {
    const src = findGuide(get().guides, sourceId);
    if (!src) return sourceId;
    const id = crypto.randomUUID();
    const copy: StoredGuide = {
      id,
      name: `${src.name} (copy)`,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      acts: deepCloneActs(src.acts),
      activeConditions: { ...src.activeConditions },
    };
    set((s) => ({ guides: [...s.guides, copy] }));
    get().save();
    return id;
  },

  renameGuide: (id, name) => {
    set((s) => ({ guides: updateGuide(s.guides, id, (g) => ({ ...g, name })) }));
    get().save();
  },

  deleteGuide: (id) => {
    set((s) => ({
      guides: s.guides.filter((g) => g.id !== id),
      activeGuideId: s.activeGuideId === id ? "default" : s.activeGuideId,
    }));
    get().save();
  },

  setActiveGuide: (id) => {
    set({ activeGuideId: id });
    get().save();
  },

  setActiveConditions: (id, conditions) => {
    set((s) => ({
      guides: updateGuide(s.guides, id, (g) => ({
        ...g,
        activeConditions: { ...g.activeConditions, ...conditions },
      })),
    }));
    get().save();
  },

  // Persistence filled in Task 4.
  load: async () => {
    set({ hydrated: true });
  },
  save: async () => {
    /* no-op until Task 4 */
  },
}));
```

- [ ] **Step 4: Run tests to verify pass**

```
npx vitest run src/store/guidesStore.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```
git add src/store/guidesStore.ts src/store/guidesStore.test.ts
git commit -m "feat: guidesStore guide-level mutations + tests"
```

---

### Task 3: Page + step mutations on `guidesStore`

**Files:**
- Modify: `src/store/guidesStore.ts`
- Modify: `src/store/guidesStore.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/store/guidesStore.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/store/guidesStore.test.ts
```

Expected: new tests fail (missing methods).

- [ ] **Step 3: Add page/step mutations to `guidesStore.ts`**

Inside `GuidesStoreState`, add method signatures:

```typescript
  addPage: (guideId: string, act: number) => void;
  deletePage: (guideId: string, act: number, entryIdx: number) => void;
  reorderPages: (guideId: string, act: number, order: number[]) => void;
  setPageCondition: (
    guideId: string,
    act: number,
    entryIdx: number,
    condition: [string, string] | null,
  ) => void;
  addStep: (guideId: string, act: number, entryIdx: number) => void;
  deleteStep: (guideId: string, act: number, entryIdx: number, stepIdx: number) => void;
  reorderSteps: (guideId: string, act: number, entryIdx: number, order: number[]) => void;
  setStepLine: (
    guideId: string,
    act: number,
    entryIdx: number,
    stepIdx: number,
    raw: string,
  ) => void;
  toggleStepHint: (guideId: string, act: number, entryIdx: number, stepIdx: number) => void;
  toggleStepOptional: (guideId: string, act: number, entryIdx: number, stepIdx: number) => void;
```

Helpers (add before the `create<...>` block):

```typescript
function mutateActs(
  guides: StoredGuide[],
  guideId: string,
  fn: (acts: StoredAct[]) => StoredAct[],
): StoredGuide[] {
  return guides.map((g) =>
    g.id === guideId ? { ...g, acts: fn(g.acts), updatedAt: nowIso() } : g,
  );
}

function mutateAct(
  acts: StoredAct[],
  actNum: number,
  fn: (act: StoredAct) => StoredAct,
): StoredAct[] {
  const idx = actNum - 1;
  return acts.map((a, i) => (i === idx ? fn(a) : a));
}

function mutateEntry(
  act: StoredAct,
  entryIdx: number,
  fn: (entry: StoredEntry) => StoredEntry,
): StoredAct {
  return {
    entries: act.entries.map((e, i) => (i === entryIdx ? fn(e) : e)),
  };
}

function mutateLines(
  entry: StoredEntry,
  fn: (lines: string[]) => string[],
): StoredEntry {
  if (entry.type === "page") return { type: "page", lines: fn(entry.lines) };
  return { ...entry, lines: fn(entry.lines) };
}
```

Implementations (inside `create<...>((set, get) => ({ ... }))`):

```typescript
  addPage: (guideId, act) => {
    set((s) => ({
      guides: mutateActs(s.guides, guideId, (acts) =>
        mutateAct(acts, act, (a) => ({
          entries: [...a.entries, { type: "page", lines: [] }],
        })),
      ),
    }));
    get().save();
  },

  deletePage: (guideId, act, entryIdx) => {
    set((s) => ({
      guides: mutateActs(s.guides, guideId, (acts) =>
        mutateAct(acts, act, (a) => ({
          entries: a.entries.filter((_, i) => i !== entryIdx),
        })),
      ),
    }));
    get().save();
  },

  reorderPages: (guideId, act, order) => {
    set((s) => ({
      guides: mutateActs(s.guides, guideId, (acts) =>
        mutateAct(acts, act, (a) => ({
          entries: order.map((i) => a.entries[i]).filter(Boolean),
        })),
      ),
    }));
    get().save();
  },

  setPageCondition: (guideId, act, entryIdx, condition) => {
    set((s) => ({
      guides: mutateActs(s.guides, guideId, (acts) =>
        mutateAct(acts, act, (a) =>
          mutateEntry(a, entryIdx, (e) => {
            if (condition == null) {
              return { type: "page", lines: [...e.lines] };
            }
            return { type: "conditional", condition, lines: [...e.lines] };
          }),
        ),
      ),
    }));
    get().save();
  },

  addStep: (guideId, act, entryIdx) => {
    set((s) => ({
      guides: mutateActs(s.guides, guideId, (acts) =>
        mutateAct(acts, act, (a) =>
          mutateEntry(a, entryIdx, (e) => mutateLines(e, (l) => [...l, ""])),
        ),
      ),
    }));
    get().save();
  },

  deleteStep: (guideId, act, entryIdx, stepIdx) => {
    set((s) => ({
      guides: mutateActs(s.guides, guideId, (acts) =>
        mutateAct(acts, act, (a) =>
          mutateEntry(a, entryIdx, (e) =>
            mutateLines(e, (l) => l.filter((_, i) => i !== stepIdx)),
          ),
        ),
      ),
    }));
    get().save();
  },

  reorderSteps: (guideId, act, entryIdx, order) => {
    set((s) => ({
      guides: mutateActs(s.guides, guideId, (acts) =>
        mutateAct(acts, act, (a) =>
          mutateEntry(a, entryIdx, (e) =>
            mutateLines(e, (l) => order.map((i) => l[i]).filter((x) => x != null)),
          ),
        ),
      ),
    }));
    get().save();
  },

  setStepLine: (guideId, act, entryIdx, stepIdx, raw) => {
    set((s) => ({
      guides: mutateActs(s.guides, guideId, (acts) =>
        mutateAct(acts, act, (a) =>
          mutateEntry(a, entryIdx, (e) =>
            mutateLines(e, (l) => l.map((line, i) => (i === stepIdx ? raw : line))),
          ),
        ),
      ),
    }));
    get().save();
  },

  toggleStepHint: (guideId, act, entryIdx, stepIdx) => {
    set((s) => ({
      guides: mutateActs(s.guides, guideId, (acts) =>
        mutateAct(acts, act, (a) =>
          mutateEntry(a, entryIdx, (e) =>
            mutateLines(e, (l) =>
              l.map((line, i) => {
                if (i !== stepIdx) return line;
                return line.startsWith("(hint)")
                  ? line.replace(/^\(hint\)_*\s*/, "")
                  : `(hint)_ ${line}`;
              }),
            ),
          ),
        ),
      ),
    }));
    get().save();
  },

  toggleStepOptional: (guideId, act, entryIdx, stepIdx) => {
    set((s) => ({
      guides: mutateActs(s.guides, guideId, (acts) =>
        mutateAct(acts, act, (a) =>
          mutateEntry(a, entryIdx, (e) =>
            mutateLines(e, (l) =>
              l.map((line, i) => {
                if (i !== stepIdx) return line;
                return line.startsWith("optional:")
                  ? line.replace(/^optional:\s*/, "")
                  : `optional: ${line}`;
              }),
            ),
          ),
        ),
      ),
    }));
    get().save();
  },
```

- [ ] **Step 4: Run tests to verify pass**

```
npx vitest run src/store/guidesStore.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```
git add src/store/guidesStore.ts src/store/guidesStore.test.ts
git commit -m "feat: guidesStore page/step mutations"
```

---

### Task 4: Persistence + migration from bundled `guide-custom.json`

**Files:**
- Modify: `src/store/guidesStore.ts`
- Modify: `src/store/guidesStore.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `guidesStore.test.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";

const mockedInvoke = vi.mocked(invoke);

describe("guidesStore — persistence & migration", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    useGuidesStore.setState({ guides: [], activeGuideId: "default", hydrated: false });
  });

  it("load() populates guides from guides.json if present", async () => {
    const file = {
      version: 1 as const,
      activeGuideId: "g1",
      guides: [
        {
          id: "g1",
          name: "Saved",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          acts: [{ entries: [] }],
          activeConditions: { "league-start": "no" },
        },
      ],
    };
    mockedInvoke.mockImplementation(async (cmd, args) => {
      if (cmd === "read_user_data" && (args as { filename: string }).filename === "guides.json") {
        return JSON.stringify(file);
      }
      return "";
    });

    await useGuidesStore.getState().load();

    expect(useGuidesStore.getState().hydrated).toBe(true);
    expect(useGuidesStore.getState().guides).toHaveLength(1);
    expect(useGuidesStore.getState().activeGuideId).toBe("g1");
  });

  it("load() migrates bundled guide-custom.json on first run", async () => {
    mockedInvoke.mockImplementation(async (cmd) => {
      if (cmd === "read_user_data") return "";
      return "";
    });

    await useGuidesStore.getState().load();

    const guides = useGuidesStore.getState().guides;
    expect(guides).toHaveLength(1);
    expect(guides[0].name).toBe("Custom");
    expect(guides[0].acts.length).toBeGreaterThan(0);

    // save was called with a write_user_data invocation
    const writeCall = mockedInvoke.mock.calls.find(
      ([cmd]) => cmd === "write_user_data",
    );
    expect(writeCall).toBeDefined();
  });

  it("save() writes the current state to guides.json", async () => {
    mockedInvoke.mockResolvedValue("");
    useGuidesStore.setState({
      hydrated: true,
      guides: [
        {
          id: "g1",
          name: "X",
          createdAt: "x",
          updatedAt: "x",
          acts: [],
          activeConditions: {},
        },
      ],
      activeGuideId: "g1",
    });
    await useGuidesStore.getState().save();
    const writeCall = mockedInvoke.mock.calls.find(
      ([cmd]) => cmd === "write_user_data",
    );
    expect(writeCall).toBeDefined();
    const payload = JSON.parse((writeCall![1] as { data: string }).data);
    expect(payload.version).toBe(1);
    expect(payload.activeGuideId).toBe("g1");
    expect(payload.guides).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/store/guidesStore.test.ts
```

Expected: the three new tests fail.

- [ ] **Step 3: Implement `load()` and `save()`**

Replace the no-op `load` and `save` in `guidesStore.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";
import rawCustomGuide from "../data/raw/guide-custom.json";

// ... rest unchanged ...

  load: async () => {
    try {
      const raw = await invoke<string>("read_user_data", { filename: "guides.json" });
      if (raw) {
        const parsed = JSON.parse(raw) as GuidesFile;
        if (parsed?.version === 1 && Array.isArray(parsed.guides)) {
          set({
            guides: parsed.guides,
            activeGuideId: parsed.activeGuideId ?? "default",
            hydrated: true,
          });
          return;
        }
      }
    } catch (e) {
      console.error("Failed to load guides.json:", e);
    }

    // Migrate bundled guide-custom.json on first run
    const migrated: StoredGuide = {
      id: crypto.randomUUID(),
      name: "Custom",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      acts: rawToActs(rawCustomGuide),
      activeConditions: { "league-start": "yes" },
    };
    set({ guides: [migrated], activeGuideId: "default", hydrated: true });
    await get().save();
  },

  save: async () => {
    const { guides, activeGuideId, hydrated } = get();
    if (!hydrated) return; // don't overwrite on pre-hydration writes
    const payload: GuidesFile = { version: 1, activeGuideId, guides };
    try {
      await invoke("write_user_data", {
        filename: "guides.json",
        data: JSON.stringify(payload, null, 2),
      });
    } catch (e) {
      console.error("Failed to save guides.json:", e);
    }
  },
```

Also: the existing mutation helpers called `get().save()` before `hydrated` was set. Those calls are fine because `save()` short-circuits if `hydrated === false`. Verify by rereading the save body.

- [ ] **Step 4: Run tests to verify pass**

```
npx vitest run src/store/guidesStore.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```
git add src/store/guidesStore.ts src/store/guidesStore.test.ts
git commit -m "feat: guidesStore persistence + migration from bundled guide-custom.json"
```

---

### Task 5: Wire `guideStore` to `guidesStore`; migrate settings schema

**Files:**
- Modify: `src/data/guide.ts`
- Modify: `src/store/guideStore.ts`
- Modify: `src/store/settingsStore.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Expose a converter from StoredGuide to GuidePage[]**

Add to `src/data/guide.ts`, after the existing `transformGuideData`:

```typescript
import type { StoredGuide } from "../types";

export function storedGuideToPages(guide: StoredGuide): GuidePage[] {
  // Flatten StoredAct[] into the RawGuide shape the transformer expects
  const raw: RawGuide = guide.acts.map((a) =>
    a.entries.map<RawEntry>((e) =>
      e.type === "page"
        ? e.lines
        : { condition: e.condition, lines: e.lines },
    ),
  );
  return transformGuideData(raw);
}
```

(You may need to export `RawGuide` and `RawEntry` from this file, or inline equivalent types. Since they're already private to the module, the cleanest change is to remove the `type` keyword where they're declared so they become module-exported, or just leave them private and define `storedGuideToPages` in the same file.)

- [ ] **Step 2: Refactor `guideStore.setGuide` to take an id**

Modify `src/store/guideStore.ts`:

- Change `activeGuide` type from `"default" | "custom"` to `string` (the guide id, or `"default"`).
- `setGuide(id: string)` reads from `guidesStore`:

```typescript
import { useGuidesStore } from "./guidesStore";
import { guidePages, storedGuideToPages } from "../data/guide";

// Inside the store factory:
setGuide: (id) => set((s) => {
  let newPages: GuidePage[];
  let newConditions = s.conditions;
  if (id === "default") {
    newPages = guidePages;
  } else {
    const g = useGuidesStore.getState().guides.find((x) => x.id === id);
    if (!g) {
      newPages = guidePages;
      id = "default";
    } else {
      newPages = storedGuideToPages(g);
      newConditions = { ...s.conditions, ...g.activeConditions };
    }
  }
  const filtered = filterPages(newPages, newConditions);
  return { allPages: newPages, pages: filtered, currentPageIndex: 0, activeGuide: id, conditions: newConditions };
}),
```

- [ ] **Step 3: Migrate `settingsStore`'s `settings.guide` to a string**

In `src/store/settingsStore.ts`, change the type of `settings.guide` from `"default" | "custom"` to `string`. On load, if the legacy value is `"custom"`, replace it with the first available user-guide id from `useGuidesStore` (which must be loaded first — see Step 4). If `"default"`, keep. Otherwise (already an id), keep.

- [ ] **Step 4: Load guides before applying the setting**

In `src/App.tsx`, in the boot `useEffect`:

```typescript
const loadGuides = useGuidesStore((s) => s.load);

useEffect(() => {
  // Important: guides must hydrate before settings applies its `guide` value
  loadGuides().then(() => {
    loadSettings();
    loadTimer();
    loadHistory();
    loadCustomizations();
  });
}, [loadSettings, loadTimer, loadHistory, loadCustomizations, loadGuides]);
```

In the effect that reacts to `guideSetting` (`App.tsx:66-70`), keep calling `setGuide(guideSetting)` but note the value is now a guide id.

- [ ] **Step 5: Typecheck + run full test suite**

```
npx tsc --noEmit
npx vitest run
```

Expected: clean; all tests pass.

- [ ] **Step 6: Commit**

```
git add src/data/guide.ts src/store/guideStore.ts src/store/settingsStore.ts src/App.tsx
git commit -m "feat: guideStore reads custom guides from guidesStore by id"
```

---

### Task 6: Settings UI — guides dropdown

**Files:**
- Modify: `src/components/Settings/Settings.tsx`

- [ ] **Step 1: Replace the default/custom radio with a dropdown**

In `Settings.tsx`, replace the "Campaign Guide" section (~lines 175-204) with:

```tsx
{/* Campaign guide */}
<section className={styles.section}>
  <h3 className={styles.sectionTitle}>Campaign Guide</h3>
  <select
    className={styles.pathInput}
    value={activeGuide}
    onChange={(e) => {
      setGuide(e.target.value);
      updateSettings({ guide: e.target.value });
    }}
  >
    <option value="default">Default</option>
    {useGuidesStore((s) => s.guides).map((g) => (
      <option key={g.id} value={g.id}>{g.name}</option>
    ))}
  </select>
  <p className={styles.dangerNote} style={{ margin: "6px 0 0", opacity: 0.5 }}>
    Manage guides via the "Guides" button in the build plan header.
  </p>
</section>
```

Add the `useGuidesStore` import at the top.

- [ ] **Step 2: Typecheck**

```
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```
git add src/components/Settings/Settings.tsx
git commit -m "feat: Settings uses dropdown over all guides"
```

---

### Task 7: `GuideEditor` modal shell + "Guides" button in App header

**Files:**
- Create: `src/components/GuideEditor/GuideEditor.tsx`
- Create: `src/components/GuideEditor/GuideEditor.module.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create empty modal shell**

Create `src/components/GuideEditor/GuideEditor.tsx`:

```tsx
import { useState } from "react";
import styles from "./GuideEditor.module.css";

export interface GuideEditorSelection {
  guideId: string | null;
  act: number | null;     // 1-based; null when not selected
  entryIdx: number | null; // page index within the act; null when act or guide selected
}

interface GuideEditorProps {
  onClose: () => void;
}

export function GuideEditor({ onClose }: GuideEditorProps) {
  const [selection, setSelection] = useState<GuideEditorSelection>({
    guideId: null,
    act: null,
    entryIdx: null,
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Guides</span>
        <button className={styles.closeBtn} onClick={onClose}>
          &times;
        </button>
      </div>
      <div className={styles.body}>
        <div className={styles.leftPane}>
          {/* GuideTree in Task 8 */}
          <div style={{ padding: 12, color: "var(--text-secondary)" }}>
            Guide tree (coming)
          </div>
        </div>
        <div className={styles.rightPane}>
          {/* Selection-driven panes in Tasks 9-11 */}
          <div style={{ padding: 12, color: "var(--text-secondary)" }}>
            Select a guide, act, or page.
          </div>
        </div>
      </div>
    </div>
  );
}
```

Create `src/components/GuideEditor/GuideEditor.module.css` — model after `ItemBrowser.module.css`:

```css
.container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.title {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--accent-gold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 8px 14px;
  border-right: 1px solid var(--border-color);
  flex-shrink: 0;
  width: 150px;
  box-sizing: border-box;
}

.closeBtn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  padding: 8px 12px;
  border-radius: 3px;
  flex-shrink: 0;
  margin-left: auto;
}

.closeBtn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.leftPane {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
}

.rightPane {
  flex: 1;
  overflow-y: auto;
}
```

- [ ] **Step 2: Add "Guides" button and mount the modal in `App.tsx`**

In `src/App.tsx`:

```tsx
import { GuideEditor } from "./components/GuideEditor/GuideEditor";

// ... inside App() state:
const [showGuideEditor, setShowGuideEditor] = useState(false);

// ... inside the build-plan header, after the History button:
<button style={dbBtnStyle} onClick={() => setShowGuideEditor(true)}>
  Guides
</button>

// ... alongside the RunHistory modal block:
{showGuideEditor && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget) setShowGuideEditor(false); }}>
    <div style={{ width: "95vw", maxWidth: "1400px", height: "85vh", borderRadius: "6px", overflow: "hidden" }}>
      <GuideEditor onClose={() => setShowGuideEditor(false)} />
    </div>
  </div>
)}
```

- [ ] **Step 3: Typecheck + smoke-check in dev**

```
npx tsc --noEmit
```

Start dev (`npm run dev`), click "Guides", confirm the modal opens with two empty panes and close button works.

- [ ] **Step 4: Commit**

```
git add src/components/GuideEditor/ src/App.tsx
git commit -m "feat: GuideEditor modal shell + entry button"
```

---

### Task 8: `GuideTree` — left pane

**Files:**
- Create: `src/components/GuideEditor/GuideTree.tsx`
- Modify: `src/components/GuideEditor/GuideEditor.tsx`
- Modify: `src/components/GuideEditor/GuideEditor.module.css`

- [ ] **Step 1: Implement `GuideTree`**

`src/components/GuideEditor/GuideTree.tsx`:

```tsx
import { useState } from "react";
import { useGuidesStore } from "../../store/guidesStore";
import { useGuideStore } from "../../store/guideStore";
import { guidePages } from "../../data/guide";
import { storedGuideToPages } from "../../data/guide";
import type { GuideEditorSelection } from "./GuideEditor";
import styles from "./GuideTree.module.css";

interface Props {
  selection: GuideEditorSelection;
  onSelect: (s: GuideEditorSelection) => void;
}

export function GuideTree({ selection, onSelect }: Props) {
  const guides = useGuidesStore((s) => s.guides);
  const createFromDefault = useGuidesStore((s) => s.createGuideFromDefault);
  const activeGuideId = useGuideStore((s) => s.activeGuide);
  const [expandedGuides, setExpandedGuides] = useState<Set<string>>(new Set());
  const [expandedActs, setExpandedActs] = useState<Set<string>>(new Set()); // key "guideId:act"

  function toggleGuide(id: string) {
    setExpandedGuides((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAct(guideId: string, act: number) {
    const key = `${guideId}:${act}`;
    setExpandedActs((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // Nodes: default guide, then user guides
  const defaultActs = Array.from({ length: 7 }, (_, i) => i + 1).filter((act) =>
    guidePages.some((p) => p.act === act),
  );

  const renderGuideNode = (
    id: string,
    name: string,
    acts: { act: number; pages: { entryIdx: number; label: string }[] }[],
    readOnly: boolean,
  ) => {
    const expanded = expandedGuides.has(id);
    const isActive = activeGuideId === id;
    return (
      <div key={id} className={styles.guideNode}>
        <div
          className={`${styles.guideHeader} ${selection.guideId === id && selection.act == null ? styles.selected : ""}`}
          onClick={() => onSelect({ guideId: id, act: null, entryIdx: null })}
        >
          <button
            className={styles.expandBtn}
            onClick={(e) => { e.stopPropagation(); toggleGuide(id); }}
          >
            {expanded ? "▾" : "▸"}
          </button>
          <span className={styles.guideName}>{name}</span>
          {readOnly && <span className={styles.lockIcon}>🔒</span>}
          {isActive && <span className={styles.activeBadge}>● playing</span>}
        </div>
        {expanded && acts.map(({ act, pages }) => {
          const actKey = `${id}:${act}`;
          const actExpanded = expandedActs.has(actKey);
          const label = act <= 4 ? `Act ${act}` : `Postgame ${act - 4}`;
          return (
            <div key={act} className={styles.actNode}>
              <div
                className={`${styles.actHeader} ${selection.guideId === id && selection.act === act && selection.entryIdx == null ? styles.selected : ""}`}
                onClick={() => onSelect({ guideId: id, act, entryIdx: null })}
              >
                <button
                  className={styles.expandBtn}
                  onClick={(e) => { e.stopPropagation(); toggleAct(id, act); }}
                >
                  {actExpanded ? "▾" : "▸"}
                </button>
                <span className={styles.actName}>{label}</span>
              </div>
              {actExpanded && pages.map((p) => (
                <div
                  key={p.entryIdx}
                  className={`${styles.pageNode} ${selection.guideId === id && selection.act === act && selection.entryIdx === p.entryIdx ? styles.selected : ""}`}
                  onClick={() => onSelect({ guideId: id, act, entryIdx: p.entryIdx })}
                >
                  <span className={styles.pageLabel}>{p.label || "(empty)"}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={styles.tree}>
      {/* Default guide */}
      {renderGuideNode(
        "default",
        "Default",
        defaultActs.map((act) => ({
          act,
          pages: guidePages
            .filter((p) => p.act === act)
            .map((p, i) => ({
              entryIdx: i,
              label: p.targetZoneName ?? "",
            })),
        })),
        true,
      )}

      {/* User guides */}
      {guides.map((g) => {
        const derived = storedGuideToPages(g);
        const actNumbers = Array.from(new Set(derived.map((p) => p.act))).sort();
        return renderGuideNode(
          g.id,
          g.name,
          actNumbers.map((act) => ({
            act,
            pages: g.acts[act - 1]?.entries.map((e, i) => {
              const derivedPage = derived.find((p) => p.act === act && p.pageIndex === i);
              return {
                entryIdx: i,
                label: derivedPage?.targetZoneName ?? "",
              };
            }) ?? [],
          })),
          false,
        );
      })}

      <button
        className={styles.newGuideBtn}
        onClick={() => {
          const id = createFromDefault("New Guide");
          onSelect({ guideId: id, act: null, entryIdx: null });
          setExpandedGuides((s) => new Set(s).add(id));
        }}
      >
        + New Guide (from Default)
      </button>
    </div>
  );
}
```

Create `src/components/GuideEditor/GuideTree.module.css`:

```css
.tree {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.guideNode { display: flex; flex-direction: column; }
.actNode { display: flex; flex-direction: column; padding-left: 14px; }

.guideHeader, .actHeader, .pageNode {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 0.72rem;
  border-left: 2px solid transparent;
}

.pageNode { padding-left: 30px; color: var(--text-secondary); }

.guideHeader:hover, .actHeader:hover, .pageNode:hover {
  background: var(--bg-hover);
}

.selected {
  background: rgba(201, 168, 76, 0.1);
  border-left-color: var(--accent-gold);
  color: var(--accent-gold);
}

.expandBtn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.7rem;
  padding: 0 2px;
  width: 14px;
}

.guideName { font-weight: 600; }
.lockIcon { font-size: 0.6rem; opacity: 0.5; }
.activeBadge {
  font-size: 0.55rem;
  color: var(--color-green, #50c878);
  margin-left: auto;
}

.actName { font-size: 0.68rem; }

.pageLabel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.newGuideBtn {
  margin: 8px 10px;
  padding: 6px 10px;
  background: none;
  border: 1px dashed var(--border-gold);
  border-radius: 4px;
  color: var(--accent-gold);
  font-size: 0.68rem;
  cursor: pointer;
}

.newGuideBtn:hover {
  background: rgba(201, 168, 76, 0.08);
}
```

- [ ] **Step 2: Mount in `GuideEditor.tsx`**

Replace the placeholder inside `.leftPane`:

```tsx
<GuideTree selection={selection} onSelect={setSelection} />
```

- [ ] **Step 3: Typecheck + smoke-check**

```
npx tsc --noEmit
```

Open the modal, confirm: default shows with lock; clicking expand chevrons works; clicking a page highlights it.

- [ ] **Step 4: Commit**

```
git add src/components/GuideEditor/
git commit -m "feat: GuideTree left pane with expand/select"
```

---

### Task 9: `GuidePane` + `ActPane`

**Files:**
- Create: `src/components/GuideEditor/GuidePane.tsx`
- Create: `src/components/GuideEditor/ActPane.tsx`
- Modify: `src/components/GuideEditor/GuideEditor.tsx`

- [ ] **Step 1: Implement `GuidePane`**

`src/components/GuideEditor/GuidePane.tsx`:

```tsx
import { useGuidesStore } from "../../store/guidesStore";
import styles from "./GuideEditor.module.css";

interface Props {
  guideId: string;
  onSelectGuide: (id: string) => void;
}

const KNOWN_CONDITIONS: { key: string; label: string; values: string[] }[] = [
  { key: "league-start", label: "League start", values: ["yes", "no"] },
];

export function GuidePane({ guideId, onSelectGuide }: Props) {
  const isDefault = guideId === "default";
  const guide = useGuidesStore((s) => s.guides.find((g) => g.id === guideId));
  const rename = useGuidesStore((s) => s.renameGuide);
  const duplicate = useGuidesStore((s) => s.duplicateGuide);
  const del = useGuidesStore((s) => s.deleteGuide);
  const setConditions = useGuidesStore((s) => s.setActiveConditions);

  function handleExport() {
    if (isDefault || !guide) return;
    const data = JSON.stringify(guide, null, 2);
    navigator.clipboard.writeText(data).catch(() => prompt("Copy guide JSON:", data));
  }

  function handleDuplicate() {
    if (!guide && !isDefault) return;
    if (isDefault) {
      // Duplicate default by creating a new guide
      const id = useGuidesStore.getState().createGuideFromDefault("Default (copy)");
      onSelectGuide(id);
    } else {
      const newId = duplicate(guideId);
      onSelectGuide(newId);
    }
  }

  function handleDelete() {
    if (isDefault || !guide) return;
    if (confirm(`Delete "${guide.name}"? This cannot be undone.`)) {
      del(guideId);
    }
  }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: "0.62rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Name
        </label>
        <input
          type="text"
          defaultValue={isDefault ? "Default" : (guide?.name ?? "")}
          disabled={isDefault}
          onBlur={(e) => !isDefault && guide && rename(guideId, e.currentTarget.value)}
          style={{
            display: "block", marginTop: 4, padding: "6px 10px",
            background: "var(--bg-secondary)", border: "1px solid var(--border-color)",
            borderRadius: 4, color: "var(--text-primary)", fontSize: "0.8rem", width: 320,
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className={styles.actionBtn} onClick={handleDuplicate}>
          {isDefault ? "Duplicate to New Guide" : "Duplicate"}
        </button>
        {!isDefault && (
          <>
            <button className={styles.actionBtn} onClick={handleExport}>Export JSON</button>
            <button className={styles.dangerBtn} onClick={handleDelete}>Delete</button>
          </>
        )}
      </div>

      {!isDefault && guide && (
        <div>
          <h4 style={{ fontSize: "0.7rem", margin: "16px 0 8px", color: "var(--accent-gold)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Active Conditions
          </h4>
          <p style={{ fontSize: "0.65rem", color: "var(--text-secondary)", opacity: 0.7, marginBottom: 8 }}>
            Playback filter applied when this guide is running. Does not affect editing.
          </p>
          {KNOWN_CONDITIONS.map((cond) => (
            <label key={cond.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: "0.72rem" }}>
              <span style={{ minWidth: 120 }}>{cond.label}</span>
              <select
                value={guide.activeConditions[cond.key] ?? cond.values[0]}
                onChange={(e) => setConditions(guideId, { [cond.key]: e.currentTarget.value })}
                style={{ padding: "3px 6px", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 3, color: "var(--text-primary)", fontSize: "0.7rem" }}
              >
                {cond.values.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

Add `.actionBtn` and `.dangerBtn` to `GuideEditor.module.css`:

```css
.actionBtn {
  padding: 4px 12px;
  background: none;
  border: 1px solid var(--border-gold);
  border-radius: 4px;
  color: var(--accent-gold);
  font-size: 0.7rem;
  cursor: pointer;
}
.actionBtn:hover { background: rgba(201, 168, 76, 0.1); }

.dangerBtn {
  padding: 4px 12px;
  background: none;
  border: 1px solid var(--color-red, #d9534f);
  border-radius: 4px;
  color: var(--color-red, #d9534f);
  font-size: 0.7rem;
  cursor: pointer;
}
.dangerBtn:hover { background: rgba(217, 83, 79, 0.1); }
```

- [ ] **Step 2: Implement `ActPane`**

`src/components/GuideEditor/ActPane.tsx`:

```tsx
import { useGuidesStore } from "../../store/guidesStore";
import { DragList } from "../DragList/DragList";
import { storedGuideToPages } from "../../data/guide";

interface Props {
  guideId: string;
  act: number;
  onSelectPage: (entryIdx: number) => void;
}

export function ActPane({ guideId, act, onSelectPage }: Props) {
  const isDefault = guideId === "default";
  const guide = useGuidesStore((s) => s.guides.find((g) => g.id === guideId));
  const addPage = useGuidesStore((s) => s.addPage);
  const deletePage = useGuidesStore((s) => s.deletePage);
  const reorderPages = useGuidesStore((s) => s.reorderPages);

  if (isDefault || !guide) {
    return (
      <div style={{ padding: 16, color: "var(--text-secondary)", fontSize: "0.75rem" }}>
        Default guide is read-only. Duplicate it to edit.
      </div>
    );
  }

  const entries = guide.acts[act - 1]?.entries ?? [];
  const derived = storedGuideToPages(guide).filter((p) => p.act === act);

  const items = entries.map((e, i) => {
    const page = derived.find((p) => p.pageIndex === i);
    const label = page?.targetZoneName || (e.type === "conditional" ? "(conditional)" : "(empty)");
    return { id: String(i), label, type: e.type };
  });

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <h4 style={{ fontSize: "0.75rem", color: "var(--accent-gold)", textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>
        {act <= 4 ? `Act ${act}` : `Postgame ${act - 4}`} — Pages
      </h4>

      <DragList
        items={items}
        onReorder={(ids) => reorderPages(guideId, act, ids.map(Number))}
        renderItem={(item) => {
          const i = Number(item.id);
          const m = items.find((x) => x.id === item.id)!;
          return (
            <div
              key={item.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", border: "1px solid var(--border-color)",
                borderRadius: 4, background: "var(--bg-secondary)",
              }}
            >
              <span style={{ color: "var(--text-secondary)", fontSize: "0.6rem", width: 24 }}>
                {i + 1}.
              </span>
              <span
                onClick={() => onSelectPage(i)}
                style={{ flex: 1, cursor: "pointer", fontSize: "0.75rem" }}
              >
                {m.label}
              </span>
              {m.type === "conditional" && (
                <span style={{ fontSize: "0.55rem", color: "var(--accent-teal)" }}>cond</span>
              )}
              <button
                onClick={() => {
                  if (confirm("Delete this page?")) deletePage(guideId, act, i);
                }}
                style={{ background: "none", border: "none", color: "var(--color-red, #d9534f)", cursor: "pointer" }}
              >
                ×
              </button>
            </div>
          );
        }}
      />

      <button
        onClick={() => addPage(guideId, act)}
        style={{
          padding: "6px 10px", border: "1px dashed var(--border-color)",
          borderRadius: 4, color: "var(--text-secondary)", background: "none",
          cursor: "pointer", fontSize: "0.7rem", alignSelf: "flex-start",
        }}
      >
        + Add page
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Route selection to panes in `GuideEditor.tsx`**

Replace the right-pane placeholder:

```tsx
import { GuidePane } from "./GuidePane";
import { ActPane } from "./ActPane";

// Inside the right-pane div:
{selection.guideId && selection.act == null && (
  <GuidePane
    guideId={selection.guideId}
    onSelectGuide={(id) => setSelection({ guideId: id, act: null, entryIdx: null })}
  />
)}
{selection.guideId && selection.act != null && selection.entryIdx == null && (
  <ActPane
    guideId={selection.guideId}
    act={selection.act}
    onSelectPage={(entryIdx) =>
      setSelection({ ...selection, entryIdx })
    }
  />
)}
{selection.guideId == null && (
  <div style={{ padding: 16, color: "var(--text-secondary)" }}>
    Select a guide, act, or page.
  </div>
)}
```

- [ ] **Step 4: Typecheck + smoke**

```
npx tsc --noEmit
```

In dev: pick a custom guide, confirm rename / duplicate / delete / conditions work; click an act, reorder pages, add/delete pages.

- [ ] **Step 5: Commit**

```
git add src/components/GuideEditor/
git commit -m "feat: GuidePane + ActPane (rename, duplicate, delete, conditions, page list)"
```

---

### Task 10: `PageEditor` + `StepRow` (without pickers)

**Files:**
- Create: `src/components/GuideEditor/PageEditor.tsx`
- Create: `src/components/GuideEditor/StepRow.tsx`
- Create: `src/components/GuideEditor/StepRow.module.css`
- Modify: `src/components/GuideEditor/GuideEditor.tsx`

- [ ] **Step 1: Implement `StepRow` (raw input + preview + hint/optional toggles, no pickers)**

`src/components/GuideEditor/StepRow.tsx`:

```tsx
import { useMemo } from "react";
import { tokenize } from "../../lib/tokenizer";
import { StepRenderer } from "../StepRenderer";
import { useGuidesStore } from "../../store/guidesStore";
import styles from "./StepRow.module.css";

interface Props {
  guideId: string;
  act: number;
  entryIdx: number;
  stepIdx: number;
  raw: string;
}

export function StepRow({ guideId, act, entryIdx, stepIdx, raw }: Props) {
  const setStepLine = useGuidesStore((s) => s.setStepLine);
  const toggleHint = useGuidesStore((s) => s.toggleStepHint);
  const toggleOptional = useGuidesStore((s) => s.toggleStepOptional);
  const deleteStep = useGuidesStore((s) => s.deleteStep);

  const tokens = useMemo(() => tokenize(raw), [raw]);
  const isHint = raw.startsWith("(hint)");
  const isOptional = raw.startsWith("optional:");

  return (
    <div className={styles.row}>
      <div className={styles.toolbar}>
        <button
          className={`${styles.toggle} ${isHint ? styles.toggleActive : ""}`}
          onClick={() => toggleHint(guideId, act, entryIdx, stepIdx)}
        >
          Hint
        </button>
        <button
          className={`${styles.toggle} ${isOptional ? styles.toggleActive : ""}`}
          onClick={() => toggleOptional(guideId, act, entryIdx, stepIdx)}
        >
          Optional
        </button>
        {/* Picker buttons land in Task 11 */}
        <button
          className={styles.deleteBtn}
          onClick={() => { if (confirm("Delete step?")) deleteStep(guideId, act, entryIdx, stepIdx); }}
        >
          ×
        </button>
      </div>
      <input
        className={styles.rawInput}
        type="text"
        value={raw}
        onChange={(e) => setStepLine(guideId, act, entryIdx, stepIdx, e.currentTarget.value)}
        placeholder="Type step syntax…"
      />
      <div className={styles.preview}>
        <StepRenderer tokens={tokens} isHint={isHint} isOptional={isOptional} isOptionalHint={false} isLast={false} />
      </div>
    </div>
  );
}
```

`src/components/GuideEditor/StepRow.module.css`:

```css
.row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
}

.toolbar { display: flex; gap: 4px; align-items: center; }

.toggle {
  padding: 2px 8px;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  color: var(--text-secondary);
  font-size: 0.6rem;
  cursor: pointer;
}
.toggleActive {
  color: var(--accent-teal);
  border-color: var(--accent-teal);
}

.rawInput {
  width: 100%;
  padding: 6px 8px;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  color: var(--text-primary);
  font-family: "Consolas", "Courier New", monospace;
  font-size: 0.72rem;
  box-sizing: border-box;
}

.preview {
  padding: 4px 8px;
  background: var(--bg-panel);
  border: 1px dashed var(--border-color);
  border-radius: 3px;
  font-size: 0.72rem;
  min-height: 18px;
}

.deleteBtn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--color-red, #d9534f);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0 6px;
}
```

- [ ] **Step 2: Implement `PageEditor`**

`src/components/GuideEditor/PageEditor.tsx`:

```tsx
import { useGuidesStore } from "../../store/guidesStore";
import { DragList } from "../DragList/DragList";
import { StepRow } from "./StepRow";
import { storedGuideToPages } from "../../data/guide";

interface Props {
  guideId: string;
  act: number;
  entryIdx: number;
}

export function PageEditor({ guideId, act, entryIdx }: Props) {
  const isDefault = guideId === "default";
  const guide = useGuidesStore((s) => s.guides.find((g) => g.id === guideId));
  const addStep = useGuidesStore((s) => s.addStep);
  const reorderSteps = useGuidesStore((s) => s.reorderSteps);
  const setCondition = useGuidesStore((s) => s.setPageCondition);

  if (isDefault || !guide) {
    return (
      <div style={{ padding: 16, color: "var(--text-secondary)", fontSize: "0.75rem" }}>
        Default guide is read-only. Duplicate it to edit.
      </div>
    );
  }

  const entry = guide.acts[act - 1]?.entries[entryIdx];
  if (!entry) {
    return (
      <div style={{ padding: 16, color: "var(--text-secondary)" }}>
        Page not found.
      </div>
    );
  }

  const lines = entry.lines;
  const derived = storedGuideToPages(guide).find((p) => p.act === act && p.pageIndex === entryIdx);
  const isConditional = entry.type === "conditional";

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Target zone (derived)
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--accent-gold)", marginTop: 2 }}>
          {derived?.targetZoneName || "(none — add an areaid... line)"}
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem" }}>
        <input
          type="checkbox"
          checked={isConditional}
          onChange={(e) => {
            setCondition(
              guideId,
              act,
              entryIdx,
              e.currentTarget.checked ? ["league-start", "yes"] : null,
            );
          }}
        />
        Conditional page
      </label>

      {isConditional && entry.type === "conditional" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.72rem" }}>
          <select
            value={entry.condition[0]}
            onChange={(e) => setCondition(guideId, act, entryIdx, [e.currentTarget.value, entry.condition[1]])}
          >
            <option value="league-start">league-start</option>
          </select>
          <select
            value={entry.condition[1]}
            onChange={(e) => setCondition(guideId, act, entryIdx, [entry.condition[0], e.currentTarget.value])}
          >
            <option value="yes">yes</option>
            <option value="no">no</option>
          </select>
        </div>
      )}

      <div>
        <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
          Steps
        </div>
        <DragList
          items={lines.map((_, i) => ({ id: String(i) }))}
          onReorder={(ids) => reorderSteps(guideId, act, entryIdx, ids.map(Number))}
          renderItem={(item) => {
            const i = Number(item.id);
            return (
              <StepRow
                guideId={guideId}
                act={act}
                entryIdx={entryIdx}
                stepIdx={i}
                raw={lines[i]}
              />
            );
          }}
        />
        <button
          onClick={() => addStep(guideId, act, entryIdx)}
          style={{
            marginTop: 6, padding: "6px 10px", border: "1px dashed var(--border-color)",
            borderRadius: 4, color: "var(--text-secondary)", background: "none",
            cursor: "pointer", fontSize: "0.7rem",
          }}
        >
          + Add step
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Route selection to PageEditor in `GuideEditor.tsx`**

Add to the right-pane render logic:

```tsx
import { PageEditor } from "./PageEditor";

{selection.guideId && selection.act != null && selection.entryIdx != null && (
  <PageEditor
    guideId={selection.guideId}
    act={selection.act}
    entryIdx={selection.entryIdx}
  />
)}
```

And adjust the `ActPane` block so `entryIdx == null` is its condition (already correct).

- [ ] **Step 4: Typecheck + smoke-check**

```
npx tsc --noEmit
```

Open the modal; open a user guide; select Act 1 → a page; edit a step; toggle hint/optional; reorder; delete; add step; check live preview renders. The running guide panel should reflect edits live if the guide is the active one.

- [ ] **Step 5: Commit**

```
git add src/components/GuideEditor/
git commit -m "feat: PageEditor with step rows, drag-reorder, hint/optional toggles"
```

---

### Task 11: Toolbar pickers

**Files:**
- Create: `src/components/GuideEditor/pickers/IconPicker.tsx`
- Create: `src/components/GuideEditor/pickers/ZonePicker.tsx`
- Create: `src/components/GuideEditor/pickers/ColorPicker.tsx`
- Create: `src/components/GuideEditor/pickers/SimplePicker.tsx`
- Create: `src/components/GuideEditor/pickers/Pickers.module.css`
- Modify: `src/components/GuideEditor/StepRow.tsx`

- [ ] **Step 1: Collect the set of known icons used in the default guide**

Run (in bash or PowerShell) to inventory icons:

```
npx vitest run --reporter=dot  # baseline; ensure clean
node -e "const g=require('./src/data/raw/guide.json'); const s=new Set(); JSON.stringify(g).replace(/\(img:([a-z0-9_-]+)\)/g,(_,n)=>{s.add(n);return _}); console.log([...s].sort().join(','))"
```

Copy the printed list; use it to build the icon grid in the picker. At minimum include: `waypoint, checkpoint, quest_2, portal, skill, support, in-out2, lab, regal, ring`. Add any others the command surfaces.

- [ ] **Step 2: Build `IconPicker`**

`src/components/GuideEditor/pickers/IconPicker.tsx`:

```tsx
import { useState } from "react";
import styles from "./Pickers.module.css";

const ICONS = [
  "waypoint", "checkpoint", "quest_2", "portal", "skill", "support",
  "in-out2", "lab", "regal", "ring",
  // extend with any additional icons discovered in Step 1
];

interface Props {
  onInsert: (raw: string) => void;
}

export function IconPicker({ onInsert }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.wrap}>
      <button className={styles.btn} onClick={() => setOpen(!open)}>Icon ▾</button>
      {open && (
        <div className={styles.popover}>
          <div className={styles.grid}>
            {ICONS.map((name) => (
              <button
                key={name}
                className={styles.gridItem}
                onClick={() => { onInsert(`(img:${name})`); setOpen(false); }}
                title={name}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

`Pickers.module.css`:

```css
.wrap { position: relative; }
.btn {
  padding: 2px 8px;
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  color: var(--text-secondary);
  font-size: 0.6rem;
  cursor: pointer;
}
.btn:hover { color: var(--text-primary); border-color: var(--text-secondary); }

.popover {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  z-index: 10;
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 6px;
  min-width: 200px;
  max-height: 300px;
  overflow-y: auto;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.gridItem {
  padding: 6px 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  color: var(--text-primary);
  font-size: 0.62rem;
  cursor: pointer;
  text-align: center;
}
.gridItem:hover { border-color: var(--accent-gold); color: var(--accent-gold); }

.search {
  width: 100%;
  padding: 4px 6px;
  margin-bottom: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  color: var(--text-primary);
  font-size: 0.7rem;
  box-sizing: border-box;
}

.row {
  padding: 5px 6px;
  cursor: pointer;
  font-size: 0.7rem;
  border-radius: 3px;
}
.row:hover { background: var(--bg-hover); }
```

- [ ] **Step 3: Build `ZonePicker`**

`src/components/GuideEditor/pickers/ZonePicker.tsx`:

```tsx
import { useState, useMemo } from "react";
import { areaById } from "../../../data/areas";
import styles from "./Pickers.module.css";

interface Props {
  onInsert: (raw: string) => void;
}

export function ZonePicker({ onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const entries = useMemo(() => Array.from(areaById.entries()), []);
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return entries.slice(0, 80);
    return entries
      .filter(([id, a]) => id.includes(needle) || a.name.toLowerCase().includes(needle))
      .slice(0, 80);
  }, [q, entries]);

  return (
    <div className={styles.wrap}>
      <button className={styles.btn} onClick={() => setOpen(!open)}>Zone ▾</button>
      {open && (
        <div className={styles.popover}>
          <input
            className={styles.search}
            placeholder="Search zones…"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            autoFocus
          />
          {matches.map(([id, area]) => (
            <div
              key={id}
              className={styles.row}
              onClick={() => {
                onInsert(`areaid${id} ;; ${area.name.toLowerCase()}`);
                setOpen(false);
              }}
            >
              {area.name}
              <span style={{ opacity: 0.4, marginLeft: 6, fontSize: "0.6rem" }}>{id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Build `ColorPicker`**

`src/components/GuideEditor/pickers/ColorPicker.tsx`:

```tsx
import { useState } from "react";
import styles from "./Pickers.module.css";

const SWATCHES = [
  { label: "red", value: "red" },
  { label: "yellow", value: "yellow" },
  { label: "purple", value: "cc99ff" },
  { label: "magenta", value: "ff00ff" },
  { label: "green", value: "50c878" },
  { label: "teal", value: "4ecdc4" },
];

interface Props {
  onInsert: (raw: string) => void;
}

export function ColorPicker({ onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState("");

  return (
    <div className={styles.wrap}>
      <button className={styles.btn} onClick={() => setOpen(!open)}>Color ▾</button>
      {open && (
        <div className={styles.popover} style={{ minWidth: 180 }}>
          <div className={styles.grid}>
            {SWATCHES.map((s) => (
              <button
                key={s.value}
                className={styles.gridItem}
                onClick={() => { onInsert(`(color:${s.value})`); setOpen(false); }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <input
            className={styles.search}
            style={{ marginTop: 6 }}
            placeholder="custom hex (no #)"
            value={hex}
            onChange={(e) => setHex(e.currentTarget.value)}
          />
          <button
            className={styles.gridItem}
            style={{ width: "100%", marginTop: 4 }}
            onClick={() => { if (hex) { onInsert(`(color:${hex})`); setOpen(false); } }}
          >
            Insert custom
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Build `SimplePicker` (quest / arena / class free-text)**

`src/components/GuideEditor/pickers/SimplePicker.tsx`:

```tsx
import { useState } from "react";
import styles from "./Pickers.module.css";

interface Props {
  label: string;
  format: (value: string) => string;
  onInsert: (raw: string) => void;
  suggestions?: string[];
}

export function SimplePicker({ label, format, onInsert, suggestions = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  return (
    <div className={styles.wrap}>
      <button className={styles.btn} onClick={() => setOpen(!open)}>{label} ▾</button>
      {open && (
        <div className={styles.popover} style={{ minWidth: 180 }}>
          <input
            className={styles.search}
            placeholder={`${label} value`}
            value={v}
            onChange={(e) => setV(e.currentTarget.value)}
            autoFocus
          />
          {suggestions.filter((s) => !v || s.includes(v.toLowerCase())).slice(0, 20).map((s) => (
            <div
              key={s}
              className={styles.row}
              onClick={() => { onInsert(format(s)); setOpen(false); setV(""); }}
            >
              {s}
            </div>
          ))}
          <button
            className={styles.gridItem}
            style={{ width: "100%", marginTop: 4 }}
            onClick={() => { if (v) { onInsert(format(v)); setOpen(false); setV(""); } }}
          >
            Insert
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Wire pickers into `StepRow`**

Modify `StepRow.tsx` — add an `inputRef` and an `insertAtCursor()` helper, then render picker buttons in the toolbar:

```tsx
import { useRef } from "react";
import { IconPicker } from "./pickers/IconPicker";
import { ZonePicker } from "./pickers/ZonePicker";
import { ColorPicker } from "./pickers/ColorPicker";
import { SimplePicker } from "./pickers/SimplePicker";

// inside component:
const inputRef = useRef<HTMLInputElement | null>(null);

function insertAtCursor(snippet: string) {
  const el = inputRef.current;
  if (!el) return setStepLine(guideId, act, entryIdx, stepIdx, raw + snippet);
  const start = el.selectionStart ?? raw.length;
  const end = el.selectionEnd ?? raw.length;
  const next = raw.slice(0, start) + snippet + raw.slice(end);
  setStepLine(guideId, act, entryIdx, stepIdx, next);
  // restore focus
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + snippet.length;
    el.setSelectionRange(pos, pos);
  });
}

// in the toolbar JSX, after the Optional toggle, before the delete button:
<IconPicker onInsert={insertAtCursor} />
<ZonePicker onInsert={insertAtCursor} />
<ColorPicker onInsert={insertAtCursor} />
<SimplePicker label="Quest" format={(v) => `(quest:${v})`} onInsert={insertAtCursor} />
<SimplePicker label="Arena" format={(v) => `arena:${v}`} onInsert={insertAtCursor} />
<SimplePicker
  label="Class"
  format={(v) => `<${v}>`}
  onInsert={insertAtCursor}
  suggestions={["witch", "warrior", "ranger", "monk", "mercenary", "sorceress", "druid"]}
/>

// attach inputRef to the rawInput:
<input
  ref={inputRef}
  className={styles.rawInput}
  type="text"
  value={raw}
  onChange={(e) => setStepLine(guideId, act, entryIdx, stepIdx, e.currentTarget.value)}
  placeholder="Type step syntax…"
/>
```

- [ ] **Step 7: Typecheck + smoke**

```
npx tsc --noEmit
```

In dev: open a page, click each picker, confirm it inserts at the cursor (or end if nothing focused) and the preview updates.

- [ ] **Step 8: Commit**

```
git add src/components/GuideEditor/
git commit -m "feat: step-editor pickers (icon, zone, color, quest/arena/class)"
```

---

### Task 12: Import JSON

**Files:**
- Modify: `src/components/GuideEditor/GuideTree.tsx` (or add a button to `GuideEditor.tsx`)
- Modify: `src/store/guidesStore.ts`
- Modify: `src/store/guidesStore.test.ts`

- [ ] **Step 1: Add a failing test for `importGuide`**

Append to `guidesStore.test.ts`:

```typescript
describe("guidesStore — import", () => {
  beforeEach(() => {
    useGuidesStore.setState({ guides: [], activeGuideId: "default", hydrated: true });
  });

  it("importGuide validates and adds a guide with a fresh id", () => {
    const src = {
      id: "will-be-replaced",
      name: "Imported",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      acts: [{ entries: [{ type: "page", lines: ["hello"] }] }],
      activeConditions: {},
    };
    const newId = useGuidesStore.getState().importGuide(JSON.stringify(src));
    expect(newId).toBeTruthy();
    expect(newId).not.toBe("will-be-replaced");
    const g = useGuidesStore.getState().guides.find((x) => x.id === newId)!;
    expect(g.name).toBe("Imported");
  });

  it("importGuide returns null for invalid JSON", () => {
    const result = useGuidesStore.getState().importGuide("not json");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/store/guidesStore.test.ts
```

- [ ] **Step 3: Add `importGuide` to `guidesStore`**

Add to `GuidesStoreState`:

```typescript
  importGuide: (raw: string) => string | null;
```

Implementation:

```typescript
  importGuide: (raw) => {
    try {
      const parsed = JSON.parse(raw) as Partial<StoredGuide>;
      if (!parsed.name || !Array.isArray(parsed.acts)) return null;
      const id = crypto.randomUUID();
      const guide: StoredGuide = {
        id,
        name: parsed.name,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        acts: parsed.acts,
        activeConditions: parsed.activeConditions ?? {},
      };
      set((s) => ({ guides: [...s.guides, guide] }));
      get().save();
      return id;
    } catch {
      return null;
    }
  },
```

- [ ] **Step 4: Add Import UI**

In `GuideTree.tsx`, next to the `+ New Guide` button:

```tsx
<button
  className={styles.newGuideBtn}
  onClick={() => {
    const raw = prompt("Paste guide JSON:");
    if (!raw) return;
    const id = useGuidesStore.getState().importGuide(raw);
    if (id) { onSelect({ guideId: id, act: null, entryIdx: null }); }
    else { alert("Invalid guide JSON."); }
  }}
>
  Import Guide
</button>
```

- [ ] **Step 5: Run tests + typecheck**

```
npx vitest run
npx tsc --noEmit
```

Expected: all pass.

- [ ] **Step 6: Commit**

```
git add src/components/GuideEditor/ src/store/
git commit -m "feat: import guide JSON"
```

---

## Manual QA checklist

After all tasks land:

- [ ] Start the app with no `guides.json` in user data → "Custom" appears in the Guides list (migrated from bundled seed).
- [ ] Fork default → new guide appears; name editable; appears in Settings dropdown.
- [ ] Duplicate an existing guide → copy appears; edits to original don't affect copy.
- [ ] Reorder a page within an act via drag → order persists after closing and re-opening modal.
- [ ] Edit a step using each picker (icon, zone, color, quest, arena, class) → raw syntax inserts at cursor; preview updates live.
- [ ] Toggle hint / optional → raw prefix added/removed; preview reflects.
- [ ] Mark a page conditional → condition persists; page shows "(conditional)" in the Act list.
- [ ] Set active guide to a custom one in Settings → running guide panel switches; editing the active guide updates the panel live.
- [ ] Delete the active guide → falls back to default gracefully; running guide resets to default.
- [ ] Export JSON → copied to clipboard; paste into Import on another guide slot → round-trip works.
- [ ] Playback filter: set `league-start: no` on a forked guide → conditional league-start-yes pages filter out during play.
