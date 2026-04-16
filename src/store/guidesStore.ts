import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { GuidesFile, StoredAct, StoredGuide, StoredEntry } from "../types";
import rawGuideData from "../data/raw/guide.json";
import rawCustomGuide from "../data/raw/guide-custom.json";

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
}));
