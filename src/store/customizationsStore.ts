import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  Customizations,
  BuildPhase,
  BuildGemEntry,
  BuildGearEntry,
  StepReminder,
  VendorRegexEntry,
  GearLayout,
  GearSlotKey,
  SkillGroup,
  PhaseTrigger,
} from "../types";
import { DEFAULT_CUSTOMIZATIONS, EMPTY_GEAR_LAYOUT } from "../types";

interface CustomizationsState extends Customizations {
  loaded: boolean;
  load: () => Promise<void>;
  save: () => Promise<void>;

  // Phase actions
  addPhase: (name: string) => void;
  removePhase: (id: string) => void;
  updatePhase: (id: string, updates: Partial<BuildPhase>) => void;
  reorderPhases: (ids: string[]) => void;
  setActivePhase: (id: string) => void;

  // Gem actions within a phase
  addGemToPhase: (phaseId: string, gem: BuildGemEntry) => void;
  removeGemFromPhase: (phaseId: string, gemId: string) => void;
  updateGemInPhase: (phaseId: string, gemId: string, updates: Partial<BuildGemEntry>) => void;
  reorderGemsInPhase: (phaseId: string, ids: string[]) => void;

  // Gear actions within a phase (legacy - no-ops)
  addGearToPhase: (phaseId: string, gear: BuildGearEntry) => void;
  removeGearFromPhase: (phaseId: string, gearId: string) => void;
  updateGearInPhase: (phaseId: string, gearId: string, updates: Partial<BuildGearEntry>) => void;

  // Gear layout actions (new)
  setGearSlot: (phaseId: string, slot: GearSlotKey, entry: BuildGearEntry | null) => void;

  // Skill group actions (new)
  addSkillGroup: (phaseId: string, skill: BuildGemEntry) => void;
  removeSkillGroup: (phaseId: string, groupId: string) => void;
  setSupportInGroup: (phaseId: string, groupId: string, index: number, gem: BuildGemEntry | null) => void;
  reorderSkillGroups: (phaseId: string, ids: string[]) => void;
  reorderSupportsInGroup: (phaseId: string, groupId: string, fromIndex: number, toIndex: number) => void;

  // Phase trigger
  updatePhaseTrigger: (phaseId: string, trigger: PhaseTrigger) => void;

  // Step reminder actions
  addReminder: (reminder: StepReminder) => void;
  removeReminder: (id: string) => void;
  getRemindersForStep: (pageIndex: number, stepIndex: number) => StepReminder[];

  // Vendor regex actions
  addRegex: (entry: VendorRegexEntry) => void;
  removeRegex: (id: string) => void;
  updateRegex: (id: string, updates: Partial<VendorRegexEntry>) => void;

  // Inline note actions
  setNote: (pageIndex: number, stepIndex: number, text: string) => void;
  removeNote: (pageIndex: number, stepIndex: number) => void;
  getNote: (pageIndex: number, stepIndex: number) => string | undefined;
}

/**
 * Migrate a phase from the old flat-array format to the new GearLayout/SkillGroup format.
 * Detection: if phase.gear is an array, it's old format.
 */
function migratePhase(phase: Record<string, unknown>): BuildPhase {
  // Already new format
  if (!Array.isArray(phase.gear)) {
    return phase as unknown as BuildPhase;
  }

  // Migrate gear[] → GearLayout
  const oldGear = phase.gear as BuildGearEntry[];
  const layout: GearLayout = { ...EMPTY_GEAR_LAYOUT };
  let ringCount = 0;

  for (const entry of oldGear) {
    const slotLower = (entry.slot ?? "").toLowerCase();
    if (slotLower === "weapon") layout.weapon = entry;
    else if (slotLower === "offhand" || slotLower === "off-hand" || slotLower === "off hand") layout.offhand = entry;
    else if (slotLower === "helmet" || slotLower === "helm") layout.helmet = entry;
    else if (slotLower === "body armour" || slotLower === "body armor" || slotLower === "chest") layout.bodyArmour = entry;
    else if (slotLower === "gloves") layout.gloves = entry;
    else if (slotLower === "boots") layout.boots = entry;
    else if (slotLower === "belt") layout.belt = entry;
    else if (slotLower === "amulet") layout.amulet = entry;
    else if (slotLower === "ring" || slotLower === "rings") {
      if (ringCount === 0) { layout.ring1 = entry; ringCount++; }
      else { layout.ring2 = entry; }
    }
  }

  // Migrate gems[] → SkillGroup[]
  const oldGems = (phase.gems ?? []) as BuildGemEntry[];
  const skillGroups: SkillGroup[] = [];

  for (const gem of oldGems) {
    if (gem.category === "skill" || gem.category === "spirit") {
      const supportEntries: (BuildGemEntry | null)[] = (gem.supports ?? []).map(
        (name: string, i: number): BuildGemEntry => ({
          id: crypto.randomUUID(),
          name,
          category: "support",
          priority: i,
          supports: [],
        })
      );
      // Pad to 5 support slots
      while (supportEntries.length < 5) {
        supportEntries.push(null);
      }
      skillGroups.push({
        id: crypto.randomUUID(),
        skill: gem,
        supports: supportEntries.slice(0, 5),
        priority: skillGroups.length,
      });
    }
  }

  return {
    id: phase.id as string,
    name: phase.name as string,
    order: phase.order as number,
    trigger: (phase.trigger as PhaseTrigger) ?? { type: "manual" },
    gear: layout,
    gems: skillGroups,
    regexes: (phase.regexes ?? []) as string[],
  };
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(save: () => Promise<void>) {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    save().catch((e) => console.error("Failed to debounce-save customizations:", e));
  }, 500);
}

export const useCustomizationsStore = create<CustomizationsState>((set, get) => ({
  ...DEFAULT_CUSTOMIZATIONS,
  loaded: false,

  load: async () => {
    try {
      const raw = await invoke<string>("read_user_data", { filename: "customizations.json" });
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Customizations>;
        const rawPhases = (saved.buildPhases ?? DEFAULT_CUSTOMIZATIONS.buildPhases) as unknown as Record<string, unknown>[];
        const migratedPhases = rawPhases.map(migratePhase);
        set({
          buildPhases: migratedPhases,
          stepReminders: saved.stepReminders ?? DEFAULT_CUSTOMIZATIONS.stepReminders,
          vendorRegexes: saved.vendorRegexes ?? DEFAULT_CUSTOMIZATIONS.vendorRegexes,
          inlineNotes: saved.inlineNotes ?? DEFAULT_CUSTOMIZATIONS.inlineNotes,
          activePhaseId: saved.activePhaseId ?? DEFAULT_CUSTOMIZATIONS.activePhaseId,
          loaded: true,
        });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  save: async () => {
    const { buildPhases, stepReminders, vendorRegexes, inlineNotes, activePhaseId } = get();
    try {
      await invoke("write_user_data", {
        filename: "customizations.json",
        data: JSON.stringify(
          { buildPhases, stepReminders, vendorRegexes, inlineNotes, activePhaseId },
          null,
          2
        ),
      });
    } catch (e) {
      console.error("Failed to save customizations:", e);
    }
  },

  // Phase actions
  addPhase: (name: string) => {
    const { buildPhases } = get();
    const newPhase: BuildPhase = {
      id: crypto.randomUUID(),
      name,
      order: buildPhases.length,
      trigger: { type: "manual" },
      gear: { ...EMPTY_GEAR_LAYOUT },
      gems: [],
      regexes: [],
    };
    set((state) => ({
      buildPhases: [...state.buildPhases, newPhase],
      activePhaseId: newPhase.id,
    }));
    debouncedSave(get().save);
  },

  removePhase: (id: string) => {
    set((state) => ({
      buildPhases: state.buildPhases.filter((p) => p.id !== id),
      activePhaseId: state.activePhaseId === id ? null : state.activePhaseId,
    }));
    debouncedSave(get().save);
  },

  updatePhase: (id: string, updates: Partial<BuildPhase>) => {
    set((state) => ({
      buildPhases: state.buildPhases.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
    debouncedSave(get().save);
  },

  reorderPhases: (ids: string[]) => {
    const { buildPhases } = get();
    const map = new Map(buildPhases.map((p) => [p.id, p]));
    const reordered = ids
      .map((id, index) => {
        const phase = map.get(id);
        return phase ? { ...phase, order: index } : null;
      })
      .filter((p): p is BuildPhase => p !== null);
    set({ buildPhases: reordered });
    debouncedSave(get().save);
  },

  setActivePhase: (id: string) => {
    set({ activePhaseId: id });
    debouncedSave(get().save);
  },

  // Gem actions within a phase (legacy no-ops — will be removed in Task 8)
  addGemToPhase: (_phaseId: string, _gem: BuildGemEntry) => { /* no-op */ },
  removeGemFromPhase: (_phaseId: string, _gemId: string) => { /* no-op */ },
  updateGemInPhase: (_phaseId: string, _gemId: string, _updates: Partial<BuildGemEntry>) => { /* no-op */ },
  reorderGemsInPhase: (_phaseId: string, _ids: string[]) => { /* no-op */ },

  // Gear actions within a phase (legacy no-ops — will be removed in Task 8)
  addGearToPhase: (_phaseId: string, _gear: BuildGearEntry) => { /* no-op */ },
  removeGearFromPhase: (_phaseId: string, _gearId: string) => { /* no-op */ },
  updateGearInPhase: (_phaseId: string, _gearId: string, _updates: Partial<BuildGearEntry>) => { /* no-op */ },

  // Gear layout actions (new)
  setGearSlot: (phaseId: string, slot: GearSlotKey, entry: BuildGearEntry | null) => {
    set((state) => ({
      buildPhases: state.buildPhases.map((p) =>
        p.id === phaseId ? { ...p, gear: { ...p.gear, [slot]: entry } } : p
      ),
    }));
    debouncedSave(get().save);
  },

  // Skill group actions (new)
  addSkillGroup: (phaseId: string, skill: BuildGemEntry) => {
    const group: SkillGroup = {
      id: crypto.randomUUID(),
      skill,
      supports: [null, null, null, null, null],
      priority: 0,
    };
    set((state) => ({
      buildPhases: state.buildPhases.map((p) => {
        if (p.id !== phaseId) return p;
        const newGroup = { ...group, priority: p.gems.length };
        return { ...p, gems: [...p.gems, newGroup] };
      }),
    }));
    debouncedSave(get().save);
  },

  removeSkillGroup: (phaseId: string, groupId: string) => {
    set((state) => ({
      buildPhases: state.buildPhases.map((p) =>
        p.id === phaseId
          ? { ...p, gems: p.gems.filter((g) => g.id !== groupId) }
          : p
      ),
    }));
    debouncedSave(get().save);
  },

  setSupportInGroup: (phaseId: string, groupId: string, index: number, gem: BuildGemEntry | null) => {
    set((state) => ({
      buildPhases: state.buildPhases.map((p) => {
        if (p.id !== phaseId) return p;
        return {
          ...p,
          gems: p.gems.map((g) => {
            if (g.id !== groupId) return g;
            const newSupports = [...g.supports];
            if (gem === null) {
              // Remove and shift left, pad with nulls
              newSupports.splice(index, 1);
              while (newSupports.length < 5) newSupports.push(null);
            } else {
              newSupports[index] = gem;
            }
            return { ...g, supports: newSupports };
          }),
        };
      }),
    }));
    debouncedSave(get().save);
  },

  reorderSkillGroups: (phaseId: string, ids: string[]) => {
    set((state) => ({
      buildPhases: state.buildPhases.map((p) => {
        if (p.id !== phaseId) return p;
        const map = new Map(p.gems.map((g) => [g.id, g]));
        const reordered = ids
          .map((id, index) => {
            const group = map.get(id);
            return group ? { ...group, priority: index } : null;
          })
          .filter((g): g is SkillGroup => g !== null);
        return { ...p, gems: reordered };
      }),
    }));
    debouncedSave(get().save);
  },

  reorderSupportsInGroup: (phaseId: string, groupId: string, fromIndex: number, toIndex: number) => {
    set((state) => ({
      buildPhases: state.buildPhases.map((p) => {
        if (p.id !== phaseId) return p;
        return {
          ...p,
          gems: p.gems.map((g) => {
            if (g.id !== groupId) return g;
            const supports = [...g.supports];
            const [moved] = supports.splice(fromIndex, 1);
            supports.splice(toIndex, 0, moved);
            return { ...g, supports };
          }),
        };
      }),
    }));
    debouncedSave(get().save);
  },

  // Phase trigger
  updatePhaseTrigger: (phaseId: string, trigger: PhaseTrigger) => {
    set((state) => ({
      buildPhases: state.buildPhases.map((p) =>
        p.id === phaseId ? { ...p, trigger } : p
      ),
    }));
    debouncedSave(get().save);
  },

  // Step reminder actions
  addReminder: (reminder: StepReminder) => {
    set((state) => ({ stepReminders: [...state.stepReminders, reminder] }));
    debouncedSave(get().save);
  },

  removeReminder: (id: string) => {
    set((state) => ({ stepReminders: state.stepReminders.filter((r) => r.id !== id) }));
    debouncedSave(get().save);
  },

  getRemindersForStep: (pageIndex: number, stepIndex: number): StepReminder[] => {
    const { stepReminders } = get();
    return stepReminders.filter(
      (r) => r.pageIndex === pageIndex && r.stepIndex === stepIndex
    );
  },

  // Vendor regex actions
  addRegex: (entry: VendorRegexEntry) => {
    set((state) => ({ vendorRegexes: [...state.vendorRegexes, entry] }));
    debouncedSave(get().save);
  },

  removeRegex: (id: string) => {
    set((state) => ({ vendorRegexes: state.vendorRegexes.filter((r) => r.id !== id) }));
    debouncedSave(get().save);
  },

  updateRegex: (id: string, updates: Partial<VendorRegexEntry>) => {
    set((state) => ({
      vendorRegexes: state.vendorRegexes.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }));
    debouncedSave(get().save);
  },

  // Inline note actions
  setNote: (pageIndex: number, stepIndex: number, text: string) => {
    set((state) => {
      const filtered = state.inlineNotes.filter(
        (n) => !(n.pageIndex === pageIndex && n.stepIndex === stepIndex)
      );
      return { inlineNotes: [...filtered, { pageIndex, stepIndex, text }] };
    });
    debouncedSave(get().save);
  },

  removeNote: (pageIndex: number, stepIndex: number) => {
    set((state) => ({
      inlineNotes: state.inlineNotes.filter(
        (n) => !(n.pageIndex === pageIndex && n.stepIndex === stepIndex)
      ),
    }));
    debouncedSave(get().save);
  },

  getNote: (pageIndex: number, stepIndex: number): string | undefined => {
    const { inlineNotes } = get();
    return inlineNotes.find((n) => n.pageIndex === pageIndex && n.stepIndex === stepIndex)?.text;
  },
}));
