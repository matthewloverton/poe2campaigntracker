# Build Plan Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace separate gem tracker, gear advisor panels with a unified Build Plan system — custom-named campaign phases with gem setups, gear targets, and vendor regexes, plus inline step reminders tied to specific guide pages.

**Architecture:** Updates the customizations store to use BuildPhase/StepReminder types instead of separate gemPlan/gearSlots. New BuildPlan component replaces GemTracker + GearAdvisor in the left sidebar. StepReminder component adds typed annotations to guide steps. VendorRegex panel reads from the active phase.

**Tech Stack:** React, TypeScript, Zustand, @dnd-kit (existing), Tauri file I/O (existing)

**Design Spec:** `docs/superpowers/specs/2026-04-13-build-plan-feature-design.md`

---

## File Map

### New files
- `src/types/buildPlan.ts` — BuildPhase, BuildGemEntry, BuildGearEntry, StepReminder types
- `src/components/BuildPlan/BuildPlan.tsx` — main build plan sidebar panel
- `src/components/BuildPlan/BuildPlan.module.css`
- `src/components/BuildPlan/PhaseEditor.tsx` — edit mode for a phase (gems, gear, regexes)
- `src/components/BuildPlan/GemSetup.tsx` — display/edit gem list with supports
- `src/components/BuildPlan/GearTargets.tsx` — display/edit gear slot targets
- `src/components/StepReminder/StepReminder.tsx` — inline reminder on guide steps
- `src/components/StepReminder/StepReminder.module.css`

### Modified files
- `src/types/customizations.ts` — replace gemPlan/gearSlots with buildPhases/stepReminders
- `src/types.ts` — update re-exports
- `src/store/customizationsStore.ts` — replace gem/gear actions with phase/reminder actions
- `src/components/VendorRegex/VendorRegex.tsx` — read regexes from active phase
- `src/components/GuidePanel/GuidePanel.tsx` — render StepReminders alongside InlineNotes
- `src/App.tsx` — replace GemTracker/GearAdvisor with BuildPlan in sidebar

### Removed files
- `src/components/GemTracker/GemTracker.tsx`
- `src/components/GemTracker/GemTracker.module.css`
- `src/components/GemTracker/GemSearch.tsx`
- `src/components/GearAdvisor/GearAdvisor.tsx`
- `src/components/GearAdvisor/GearAdvisor.module.css`
- `src/components/GearAdvisor/SlotEditor.tsx`

---

## Task 1: Update Types

**Files:**
- Create: `src/types/buildPlan.ts`
- Modify: `src/types/customizations.ts`, `src/types.ts`

- [ ] **Step 1: Create build plan types**

Create `src/types/buildPlan.ts`:

```typescript
export interface BuildPhase {
  id: string;
  name: string;
  order: number;
  gems: BuildGemEntry[];
  gear: BuildGearEntry[];
  regexes: string[];
}

export interface BuildGemEntry {
  id: string;
  name: string;
  category: "skill" | "support" | "spirit";
  priority: number;
  supports: string[];
}

export interface BuildGearEntry {
  id: string;
  slot: string;
  base: string;
  desiredMods: string[];
  notes: string;
}

export interface StepReminder {
  id: string;
  pageIndex: number;
  stepIndex: number;
  type: "gem" | "gear" | "craft" | "note";
  text: string;
}

export const DEFAULT_BUILD_PHASE: BuildPhase = {
  id: "",
  name: "",
  order: 0,
  gems: [],
  gear: [],
  regexes: [],
};
```

- [ ] **Step 2: Update customizations types**

Replace `gemPlan` and `gearSlots` in `src/types/customizations.ts`:

Remove `GemPlanEntry`, `GearSlotConfig`, `CraftingMilestone` interfaces and their defaults.

Update the `Customizations` interface:

```typescript
import type { BuildPhase, StepReminder } from "./buildPlan";

export interface Customizations {
  buildPhases: BuildPhase[];
  stepReminders: StepReminder[];
  vendorRegexes: VendorRegexEntry[];
  inlineNotes: InlineNote[];
  activePhaseId: string | null;
}

export const DEFAULT_CUSTOMIZATIONS: Customizations = {
  buildPhases: [],
  stepReminders: [],
  vendorRegexes: [],
  inlineNotes: [],
  activePhaseId: null,
};
```

Keep `VendorRegexEntry`, `InlineNote`, `GemData` as-is.

- [ ] **Step 3: Update type re-exports in src/types.ts**

Replace the old re-exports with:

```typescript
export type {
  BuildPhase,
  BuildGemEntry,
  BuildGearEntry,
  StepReminder,
} from "./types/buildPlan";

export { DEFAULT_BUILD_PHASE } from "./types/buildPlan";

export type {
  VendorRegexEntry,
  InlineNote,
  Customizations,
  GemData,
} from "./types/customizations";

export { DEFAULT_CUSTOMIZATIONS } from "./types/customizations";
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit 2>&1
```

Expected: Type errors in customizationsStore.ts (references old gemPlan/gearSlots) — that's fine, fixed in Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/types/
git commit -m "feat: build plan types replacing separate gem/gear models

BuildPhase with gems (skill+supports), gear targets, and per-phase
vendor regexes. StepReminder for inline build annotations on guide
steps. Replaces GemPlanEntry and GearSlotConfig."
```

---

## Task 2: Update Customizations Store

**Files:**
- Modify: `src/store/customizationsStore.ts`

- [ ] **Step 1: Replace store with build plan actions**

Read the current store. Replace the gem/gear actions with:

**State:** `buildPhases`, `stepReminders`, `vendorRegexes`, `inlineNotes`, `activePhaseId`, `loaded`

**Phase actions:**
- `addPhase(name: string)` — creates a new phase with `crypto.randomUUID()`, appends to list
- `removePhase(id: string)` — removes phase, clears activePhaseId if it was active
- `updatePhase(id: string, updates: Partial<BuildPhase>)` — partial update
- `reorderPhases(ids: string[])` — reorder and update `order` fields
- `setActivePhase(id: string)` — set which phase is currently displayed

**Gem actions within a phase:**
- `addGemToPhase(phaseId: string, gem: BuildGemEntry)` — add gem to a phase
- `removeGemFromPhase(phaseId: string, gemId: string)` — remove gem from a phase
- `updateGemInPhase(phaseId: string, gemId: string, updates: Partial<BuildGemEntry>)` — update gem
- `reorderGemsInPhase(phaseId: string, ids: string[])` — reorder gems within a phase

**Gear actions within a phase:**
- `addGearToPhase(phaseId: string, gear: BuildGearEntry)` — add gear target to a phase
- `removeGearFromPhase(phaseId: string, gearId: string)` — remove gear target
- `updateGearInPhase(phaseId: string, gearId: string, updates: Partial<BuildGearEntry>)` — update gear

**Step reminder actions:**
- `addReminder(reminder: StepReminder)` — add a step reminder
- `removeReminder(id: string)` — remove a step reminder
- `getRemindersForStep(pageIndex: number, stepIndex: number) → StepReminder[]` — get reminders for a specific step

Keep existing: `vendorRegexes` CRUD, `inlineNotes` CRUD, `load`, `save`.

All mutating actions call `debouncedSave()`.

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: Errors in components that reference old gemPlan/gearSlots — fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/store/customizationsStore.ts
git commit -m "feat: customizations store with build phase and reminder actions

Replaces separate gem/gear CRUD with phase-based actions. Gems and
gear targets are nested within phases. Step reminders for inline
build annotations."
```

---

## Task 3: Build Plan Panel — Display Mode

**Files:**
- Create: `src/components/BuildPlan/BuildPlan.tsx`, `src/components/BuildPlan/BuildPlan.module.css`, `src/components/BuildPlan/GemSetup.tsx`, `src/components/BuildPlan/GearTargets.tsx`

- [ ] **Step 1: Create GemSetup display component**

Create `src/components/BuildPlan/GemSetup.tsx` — displays gems with supports in hint style:

```tsx
import type { BuildGemEntry } from "../../types";
import styles from "./BuildPlan.module.css";

interface GemSetupProps {
  gems: BuildGemEntry[];
}

export function GemSetup({ gems }: GemSetupProps) {
  if (gems.length === 0) return <div className={styles.empty}>No gems configured</div>;

  return (
    <div className={styles.gemList}>
      {gems.map((gem, i) => (
        <div key={gem.id} className={styles.gemEntry}>
          <div className={styles.gemMain}>
            <span className={styles.gemPriority}>{i + 1}.</span>
            <span className={styles.gemName}>{gem.name}</span>
            <span className={styles.gemCat}>{gem.category[0].toUpperCase()}</span>
          </div>
          {gem.supports.length > 0 && (
            <div className={styles.supports}>
              {gem.supports.map((sup, j) => (
                <div key={j} className={styles.supportGem}>{sup}</div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create GearTargets display component**

Create `src/components/BuildPlan/GearTargets.tsx`:

```tsx
import type { BuildGearEntry } from "../../types";
import styles from "./BuildPlan.module.css";

interface GearTargetsProps {
  gear: BuildGearEntry[];
}

export function GearTargets({ gear }: GearTargetsProps) {
  if (gear.length === 0) return <div className={styles.empty}>No gear targets configured</div>;

  return (
    <div className={styles.gearList}>
      {gear.map((entry) => (
        <div key={entry.id} className={styles.gearEntry}>
          <div className={styles.gearHeader}>
            <span className={styles.gearSlot}>{entry.slot}:</span>
            <span className={styles.gearBase}>{entry.base || "any"}</span>
          </div>
          {entry.desiredMods.length > 0 && (
            <div className={styles.gearMods}>
              {entry.desiredMods.join(", ")}
            </div>
          )}
          {entry.notes && <div className={styles.gearNotes}>{entry.notes}</div>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create BuildPlan main panel**

Create `src/components/BuildPlan/BuildPlan.tsx`:

```tsx
import { useState } from "react";
import { useCustomizationsStore } from "../../store/customizationsStore";
import { GemSetup } from "./GemSetup";
import { GearTargets } from "./GearTargets";
import styles from "./BuildPlan.module.css";

export function BuildPlan() {
  const buildPhases = useCustomizationsStore((s) => s.buildPhases);
  const activePhaseId = useCustomizationsStore((s) => s.activePhaseId);
  const setActivePhase = useCustomizationsStore((s) => s.setActivePhase);
  const addPhase = useCustomizationsStore((s) => s.addPhase);
  const [editing, setEditing] = useState(false);

  const activePhase = buildPhases.find((p) => p.id === activePhaseId) ?? buildPhases[0] ?? null;

  return (
    <div className={styles.panel}>
      {/* Phase tabs */}
      <div className={styles.phaseTabs}>
        {buildPhases.map((phase) => (
          <button
            key={phase.id}
            className={`${styles.phaseTab} ${phase.id === activePhase?.id ? styles.activeTab : ""}`}
            onClick={() => setActivePhase(phase.id)}
          >
            {phase.name}
          </button>
        ))}
        <button className={styles.addPhaseBtn} onClick={() => {
          const name = prompt("Phase name (e.g. 'Start → Rust King'):");
          if (name) addPhase(name);
        }}>+</button>
      </div>

      {activePhase ? (
        <div className={styles.phaseContent}>
          {/* Gem setup section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Gems</span>
              <button className={styles.editBtn} onClick={() => setEditing(!editing)}>
                {editing ? "Done" : "Edit"}
              </button>
            </div>
            {/* PhaseEditor imported and used in editing mode — Task 4 */}
            <GemSetup gems={activePhase.gems} />
          </div>

          {/* Gear targets section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Gear</span>
            </div>
            <GearTargets gear={activePhase.gear} />
          </div>

          {/* Phase regexes */}
          {activePhase.regexes.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>Vendor Regex</span>
              </div>
              {activePhase.regexes.map((regex, i) => (
                <div key={i} className={styles.regexRow}
                  onClick={() => { navigator.clipboard.writeText(regex); }}
                  title="Click to copy"
                >
                  <code className={styles.regexCode}>{regex}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>No build phases configured.</p>
          <button className={styles.addPhaseBtn} onClick={() => {
            const name = prompt("Phase name:");
            if (name) addPhase(name);
          }}>
            + Create First Phase
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create CSS**

Create `src/components/BuildPlan/BuildPlan.module.css` — follow existing patterns for compact panels, tabs, sections. Key styles:

- Phase tabs: horizontal scroll, active tab with gold underline
- Gem entries: priority number + name, supports indented underneath with lower opacity (like hints)
- Gear entries: slot name bold + base name, mods in secondary color below
- Section headers with title + edit button
- Compact sizing (13px base font)

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit
git add src/components/BuildPlan/
git commit -m "feat: build plan panel with phase tabs, gem setup, and gear targets

Display mode showing custom-named phases with gem priority lists
(skills + supports indented), gear slot targets with desired mods,
and per-phase vendor regexes."
```

---

## Task 4: Build Plan — Edit Mode

**Files:**
- Create: `src/components/BuildPlan/PhaseEditor.tsx`
- Modify: `src/components/BuildPlan/BuildPlan.tsx`

- [ ] **Step 1: Create PhaseEditor**

Create `src/components/BuildPlan/PhaseEditor.tsx` — edit mode for a phase. Includes:

- **Gem editing:** Add gem (opens GemSearch modal from existing component), remove gems, add/remove supports per gem, drag-to-reorder gems
- **Gear editing:** Add gear slot (dropdown of slot names), set base type, add/remove desired mods, notes textarea
- **Regex editing:** Add/remove vendor regex strings
- **Phase management:** Rename phase, delete phase

Use `useCustomizationsStore` actions: `addGemToPhase`, `removeGemFromPhase`, `updateGemInPhase`, `reorderGemsInPhase`, `addGearToPhase`, `removeGearFromPhase`, `updateGearInPhase`, `updatePhase`, `removePhase`.

Use `DragList` for gem reordering within the phase.

Use `GemSearch` from the existing gem tracker (keep this file, don't delete it).

- [ ] **Step 2: Wire PhaseEditor into BuildPlan**

In `BuildPlan.tsx`, when `editing` is true, render `<PhaseEditor phase={activePhase} />` instead of the read-only `GemSetup` + `GearTargets`.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: build plan edit mode with gem/gear/regex management

Add/remove/reorder gems with support linking. Add gear slots with
base type and desired mods. Add per-phase vendor regexes. Delete
and rename phases."
```

---

## Task 5: Step Reminders

**Files:**
- Create: `src/components/StepReminder/StepReminder.tsx`, `src/components/StepReminder/StepReminder.module.css`
- Modify: `src/components/GuidePanel/GuidePanel.tsx`

- [ ] **Step 1: Create StepReminder component**

Create `src/components/StepReminder/StepReminder.tsx`:

Displays reminders for a specific guide step. Each reminder shows a type-specific icon and styled text:
- gem (💎): teal text
- gear (⚔): gold text
- craft (🔨): purple text
- note (📝): gold italic (same as inline notes)

Also includes an "add reminder" button (appears on hover of parent step wrapper) with a type picker (gem/gear/craft/note) and text input.

- [ ] **Step 2: Create CSS**

Follow InlineNote styling patterns — compact, indented, type-specific colors.

- [ ] **Step 3: Wire into GuidePanel**

Read current `src/components/GuidePanel/GuidePanel.tsx`. In the step rendering, after the `InlineNote` component, add `StepReminder` component:

```tsx
import { StepReminder } from "../StepReminder/StepReminder";

// In step wrapper, after InlineNote:
<StepReminder pageIndex={currentPage.globalIndex} stepIndex={i} />
```

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: inline step reminders for build-specific annotations

Gem, gear, craft, and note reminders attached to specific guide steps.
Type-specific icons and colors. Add via hover button on any step."
```

---

## Task 6: Update VendorRegex + Remove Old Panels + Wire App

**Files:**
- Modify: `src/components/VendorRegex/VendorRegex.tsx`, `src/App.tsx`
- Remove: `src/components/GemTracker/`, `src/components/GearAdvisor/`

- [ ] **Step 1: Update VendorRegex to read from active phase**

Read current VendorRegex. Update to also show regexes from the active build phase:

```typescript
const activePhaseId = useCustomizationsStore((s) => s.activePhaseId);
const buildPhases = useCustomizationsStore((s) => s.buildPhases);
const activePhase = buildPhases.find((p) => p.id === activePhaseId);
const phaseRegexes = activePhase?.regexes ?? [];
```

Show phase regexes above custom regexes, with a "Phase: [name]" label.

- [ ] **Step 2: Remove old panels**

```bash
rm -rf src/components/GemTracker/GemTracker.tsx src/components/GemTracker/GemTracker.module.css
rm -rf src/components/GearAdvisor/GearAdvisor.tsx src/components/GearAdvisor/GearAdvisor.module.css src/components/GearAdvisor/SlotEditor.tsx
```

Keep `src/components/GemTracker/GemSearch.tsx` — it's reused by PhaseEditor.

Move it to a shared location:
```bash
mv src/components/GemTracker/GemSearch.tsx src/components/BuildPlan/GemSearch.tsx
```

Update imports in PhaseEditor.

- [ ] **Step 3: Update App.tsx**

Replace GemTracker + GearAdvisor in leftSidebar with BuildPlan:

```tsx
import { BuildPlan } from "./components/BuildPlan/BuildPlan";

// In CompanionLayout:
leftSidebar={
  <CollapsiblePanel title="Build Plan" defaultOpen={true}>
    <BuildPlan />
  </CollapsiblePanel>
}
```

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit
npx vitest run
git add -A
git commit -m "feat: wire build plan into layout, remove old gem/gear panels

BuildPlan replaces GemTracker + GearAdvisor in left sidebar.
VendorRegex reads from active phase. Old panel components removed."
```

---

## Summary

**6 tasks delivering:**
- Build plan types + store updates
- Build plan panel with phase tabs (display mode)
- Phase editor (edit mode — gems with supports, gear targets, regexes)
- Step reminders inline in the guide
- VendorRegex integration with active phase
- Old panels removed, new panel wired in

**End result:** Users configure custom-named campaign phases with gem setups (skills + supports), gear targets (base + mods), and vendor regexes. Step reminders attach build-specific actions to specific guide pages. Everything surfaces at the right time during gameplay.
