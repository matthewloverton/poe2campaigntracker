import { create } from "zustand";
import type { StoredAct, StoredGuide, StoredEntry } from "../types";
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
