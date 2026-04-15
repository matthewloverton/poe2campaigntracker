# Build Plan Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the build plan from a narrow text sidebar into a visual 60% primary panel with inventory-style gear grid, gem socket layout, phase system with triggers, and integrated vendor regex.

**Architecture:** Update the CompanionLayout to swap the build plan from left sidebar to a 60% center slot, guide to 40% right. New types (GearLayout, SkillGroup, phase triggers) replace the flat gem/gear arrays. New visual components (GearGrid, GearSlot, SkillRow) render equipment and gems with real icons and hover tooltips. Store migration converts old customizations.json on load. Vendor regex moves inside the build plan.

**Tech Stack:** React 19, TypeScript, Zustand, CSS Modules, Vite

**Design Spec:** `docs/superpowers/specs/2026-04-14-build-plan-visual-redesign.md`

---

## File Map

### New files

- `src/types/buildPlan.ts` — rewritten with GearLayout, SkillGroup, phase trigger types
- `src/components/BuildPlan/PhaseBar.tsx` + `.module.css` — phase tabs with trigger display
- `src/components/BuildPlan/GearGrid.tsx` + `.module.css` — inventory-style equipment grid
- `src/components/BuildPlan/GearSlot.tsx` + `.module.css` — individual gear slot with tooltip
- `src/components/BuildPlan/SkillRow.tsx` + `.module.css` — skill gem + 5 support sockets
- `src/components/BuildPlan/GemTooltip.tsx` + `.module.css` — hover tooltip for gems

### Modified files

- `src/types/customizations.ts` — update Customizations interface for new BuildPhase
- `src/store/customizationsStore.ts` — new actions for gear layout, skill groups, phase triggers + migration
- `src/layouts/CompanionLayout.tsx` + `.module.css` — 60/40 layout with named slots
- `src/App.tsx` — build plan to center, guide to right, remove bottom panel
- `src/components/BuildPlan/BuildPlan.tsx` + `.module.css` — complete rewrite as visual planner
- `src/components/VendorRegex/VendorRegex.tsx` — minor styling for inline use

### Removed files

- `src/components/BuildPlan/PhaseEditor.tsx` — replaced by visual editor
- `src/components/BuildPlan/GemSetup.tsx` — replaced by SkillRow
- `src/components/BuildPlan/GearTargets.tsx` — replaced by GearGrid

---

## Task 1: Updated Types

**Files:**
- Modify: `src/types/buildPlan.ts`

- [ ] **Step 1: Rewrite buildPlan.ts with new types**

```typescript
// src/types/buildPlan.ts

export interface PhaseTrigger {
  type: "level" | "zone" | "manual";
  level?: number;
  zoneId?: string;
  zoneName?: string;
}

export interface BuildGemEntry {
  id: string;
  gemId?: string;
  name: string;
  category: "skill" | "support" | "spirit";
  priority: number;
  supports: string[];
  iconPath?: string;
  color?: string;
  craftingLevel?: number;
}

export interface BuildGearEntry {
  id: string;
  slot: string;
  baseItemId?: string;
  base: string;
  desiredModIds?: string[];
  desiredMods: string[];
  notes: string;
  iconPath?: string;
  priority?: number;
}

export interface GearLayout {
  weapon: BuildGearEntry | null;
  weaponSwap: BuildGearEntry | null;
  offhand: BuildGearEntry | null;
  offhandSwap: BuildGearEntry | null;
  helmet: BuildGearEntry | null;
  bodyArmour: BuildGearEntry | null;
  gloves: BuildGearEntry | null;
  boots: BuildGearEntry | null;
  belt: BuildGearEntry | null;
  amulet: BuildGearEntry | null;
  ring1: BuildGearEntry | null;
  ring2: BuildGearEntry | null;
}

export interface SkillGroup {
  id: string;
  skill: BuildGemEntry;
  supports: (BuildGemEntry | null)[];  // 5 slots
  priority: number;
}

export interface BuildPhase {
  id: string;
  name: string;
  order: number;
  trigger: PhaseTrigger;
  gear: GearLayout;
  gems: SkillGroup[];
  regexes: string[];
}

export interface StepReminder {
  id: string;
  pageIndex: number;
  stepIndex: number;
  type: "gem" | "gear" | "craft" | "note";
  text: string;
}

export const EMPTY_GEAR_LAYOUT: GearLayout = {
  weapon: null, weaponSwap: null,
  offhand: null, offhandSwap: null,
  helmet: null, bodyArmour: null,
  gloves: null, boots: null,
  belt: null, amulet: null,
  ring1: null, ring2: null,
};

export const DEFAULT_BUILD_PHASE: BuildPhase = {
  id: "",
  name: "",
  order: 0,
  trigger: { type: "manual" },
  gear: { ...EMPTY_GEAR_LAYOUT },
  gems: [],
  regexes: [],
};

export type GearSlotKey = keyof GearLayout;

export const GEAR_SLOT_LABELS: Record<GearSlotKey, string> = {
  weapon: "Weapon",
  weaponSwap: "Weapon (Set 2)",
  offhand: "Off-hand",
  offhandSwap: "Off-hand (Set 2)",
  helmet: "Helmet",
  bodyArmour: "Body Armour",
  gloves: "Gloves",
  boots: "Boots",
  belt: "Belt",
  amulet: "Amulet",
  ring1: "Ring",
  ring2: "Ring",
};

export const SLOT_ITEM_CLASSES: Record<string, string[]> = {
  weapon: ["Claw", "Dagger", "Wand", "One Hand Sword", "Two Hand Sword",
           "One Hand Axe", "Two Hand Axe", "One Hand Mace", "Two Hand Mace",
           "Sceptre", "Staff", "Warstaff", "Spear", "Flail", "Bow",
           "Crossbow", "Focus", "TrapTool"],
  offhand: ["Shield", "Buckler", "Quiver", "Focus"],
  helmet: ["Helmet"],
  bodyArmour: ["Body Armour"],
  gloves: ["Gloves"],
  boots: ["Boots"],
  belt: ["Belt"],
  amulet: ["Amulet"],
  ring1: ["Ring"],
  ring2: ["Ring"],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/types/buildPlan.ts
git commit -m "feat: new build plan types with GearLayout, SkillGroup, and phase triggers"
```

---

## Task 2: Store Migration + New Actions

**Files:**
- Modify: `src/store/customizationsStore.ts`

- [ ] **Step 1: Add migration function and update store**

The store needs to:
1. Detect old format (BuildPhase with flat `gems: BuildGemEntry[]` and `gear: BuildGearEntry[]`) on load
2. Migrate to new format (BuildPhase with `gear: GearLayout` and `gems: SkillGroup[]` and `trigger: PhaseTrigger`)
3. Add new actions for gear layout slots and skill groups

Add a migration function at the top of the file:

```typescript
import type { BuildPhase, GearLayout, SkillGroup, BuildGemEntry, BuildGearEntry, GearSlotKey } from "../types";
import { EMPTY_GEAR_LAYOUT } from "../types";

/** Migrate old flat phases to new visual format */
function migratePhase(phase: any): BuildPhase {
  // Already migrated — has gear as object with slot keys
  if (phase.gear && typeof phase.gear === "object" && !Array.isArray(phase.gear)) {
    // Ensure trigger exists
    if (!phase.trigger) phase.trigger = { type: "manual" };
    return phase as BuildPhase;
  }

  // Old format: gear is an array, gems is an array
  const oldGear: BuildGearEntry[] = Array.isArray(phase.gear) ? phase.gear : [];
  const oldGems: BuildGemEntry[] = Array.isArray(phase.gems) ? phase.gems : [];

  // Map gear array into layout slots
  const gear: GearLayout = { ...EMPTY_GEAR_LAYOUT };
  for (const g of oldGear) {
    const slotMap: Record<string, GearSlotKey> = {
      weapon: "weapon", offhand: "offhand", helmet: "helmet",
      "body armour": "bodyArmour", gloves: "gloves", boots: "boots",
      belt: "belt", amulet: "amulet", rings: "ring1", ring: "ring1",
    };
    const key = slotMap[g.slot.toLowerCase()];
    if (key && gear[key] === null) {
      gear[key] = g;
    } else if (g.slot.toLowerCase() === "rings" && gear.ring1 !== null) {
      gear.ring2 = g;
    }
  }

  // Convert gem array into skill groups
  const skills = oldGems.filter((g) => g.category === "skill" || g.category === "spirit");
  const gems: SkillGroup[] = skills.map((skill, i) => {
    const supportNames = skill.supports || [];
    const supports: (BuildGemEntry | null)[] = supportNames.map((name) => {
      // Try to find matching gem entry in the old gems array
      const found = oldGems.find((g) => g.name === name && g.category === "support");
      if (found) return { ...found };
      return {
        id: crypto.randomUUID(),
        name,
        category: "support" as const,
        priority: 0,
        supports: [],
      };
    });
    // Pad to 5 slots
    while (supports.length < 5) supports.push(null);

    return {
      id: skill.id,
      skill,
      supports: supports.slice(0, 5),
      priority: i,
    };
  });

  return {
    id: phase.id,
    name: phase.name,
    order: phase.order ?? 0,
    trigger: { type: "manual" },
    gear,
    gems,
    regexes: phase.regexes ?? [],
  };
}
```

Update the `load()` function to call `migratePhase` on each loaded phase.

Update the store interface to add new actions:

```typescript
// Gear layout actions
setGearSlot: (phaseId: string, slot: GearSlotKey, entry: BuildGearEntry | null) => void;

// Skill group actions
addSkillGroup: (phaseId: string, skill: BuildGemEntry) => void;
removeSkillGroup: (phaseId: string, groupId: string) => void;
setSupportInGroup: (phaseId: string, groupId: string, index: number, gem: BuildGemEntry | null) => void;
reorderSkillGroups: (phaseId: string, ids: string[]) => void;

// Phase trigger
updatePhaseTrigger: (phaseId: string, trigger: PhaseTrigger) => void;
```

Implement each action following the existing pattern (find phase, update, set state, debounced save).

Keep existing `addGemToPhase`, `removeGemFromPhase`, `addGearToPhase`, `removeGearFromPhase` actions for backward compat but they can be no-ops or adapters.

- [ ] **Step 2: Verify migration works**

Run `npm run dev`, check that existing customizations.json loads without errors. If data exists, verify the migration produces valid GearLayout and SkillGroup structures via console logging.

- [ ] **Step 3: Commit**

```bash
git add src/store/customizationsStore.ts
git commit -m "feat: store migration from flat arrays to GearLayout/SkillGroup + new actions"
```

---

## Task 3: Layout Restructure

**Files:**
- Modify: `src/layouts/CompanionLayout.tsx` + `.module.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update CompanionLayout for 60/40 split**

```typescript
// src/layouts/CompanionLayout.tsx
import type { ReactNode } from "react";
import styles from "./CompanionLayout.module.css";

interface CompanionLayoutProps {
  topBar: ReactNode;
  primary: ReactNode;     // 60% — build plan
  secondary: ReactNode;   // 40% — guide
}

export function CompanionLayout({ topBar, primary, secondary }: CompanionLayoutProps) {
  return (
    <div className={styles.layout}>
      <div className={styles.topBar}>{topBar}</div>
      <div className={styles.main}>
        <div className={styles.primary}>{primary}</div>
        <div className={styles.secondary}>{secondary}</div>
      </div>
    </div>
  );
}
```

```css
/* src/layouts/CompanionLayout.module.css */
.layout { display: flex; flex-direction: column; height: 100vh; background: var(--bg-primary); }
.topBar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: var(--bg-panel); border-bottom: 1px solid var(--border-color); min-height: 48px; gap: 16px; flex-shrink: 0; }
.main { display: flex; flex: 1; overflow: hidden; }
.primary { flex: 3; overflow-y: auto; border-right: 1px solid var(--border-color); }
.secondary { flex: 2; overflow: hidden; }
```

- [ ] **Step 2: Update App.tsx for new layout**

Remove `CollapsiblePanel` wrapping of `BuildPlan`. Remove `VendorRegex` from bottom panel. Pass `BuildPlan` as `primary` and guide/browser as `secondary`:

```typescript
// In App.tsx, update renderCenter to renderSecondary since guide goes to secondary slot:
function renderSecondary() {
  switch (activeView) {
    case "itemBrowser":
      return <ItemBrowser onClose={() => setActiveView("guide")} />;
    case "gemBrowser":
      return <GemBrowser onClose={() => setActiveView("guide")} />;
    default:
      return <GuidePanel />;
  }
}

// In the return:
<CompanionLayout
  topBar={<TopBar ... />}
  primary={<BuildPlan />}
  secondary={renderSecondary()}
/>
```

Remove the `VendorRegex` import and bottom panel usage from App.tsx. Remove the `CollapsiblePanel` import.

- [ ] **Step 3: Verify the layout renders**

```bash
npm run dev
```

Verify build plan fills 60% left, guide fills 40% right.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/CompanionLayout.tsx src/layouts/CompanionLayout.module.css src/App.tsx
git commit -m "feat: 60/40 layout with build plan primary, guide secondary"
```

---

## Task 4: Phase Bar Component

**Files:**
- Create: `src/components/BuildPlan/PhaseBar.tsx` + `.module.css`

- [ ] **Step 1: Create PhaseBar component**

```typescript
// src/components/BuildPlan/PhaseBar.tsx
import { useState } from "react";
import type { BuildPhase, PhaseTrigger } from "../../types";
import styles from "./PhaseBar.module.css";

interface PhaseBarProps {
  phases: BuildPhase[];
  activePhaseId: string | null;
  onSelectPhase: (id: string) => void;
  onAddPhase: (name: string, trigger: PhaseTrigger) => void;
}

function triggerLabel(trigger: PhaseTrigger): string {
  switch (trigger.type) {
    case "level": return `Lvl ${trigger.level}+`;
    case "zone": return trigger.zoneName ?? trigger.zoneId ?? "Zone";
    case "manual": return "Manual";
  }
}

export function PhaseBar({ phases, activePhaseId, onSelectPhase, onAddPhase }: PhaseBarProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTriggerType, setNewTriggerType] = useState<PhaseTrigger["type"]>("level");
  const [newTriggerLevel, setNewTriggerLevel] = useState(1);

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    const trigger: PhaseTrigger = newTriggerType === "level"
      ? { type: "level", level: newTriggerLevel }
      : { type: "manual" };
    onAddPhase(name, trigger);
    setNewName("");
    setAdding(false);
  }

  const sorted = [...phases].sort((a, b) => a.order - b.order);

  return (
    <div className={styles.bar}>
      {sorted.map((phase) => (
        <button
          key={phase.id}
          className={`${styles.phaseTab} ${phase.id === activePhaseId ? styles.active : ""}`}
          onClick={() => onSelectPhase(phase.id)}
        >
          <span className={styles.phaseName}>{phase.name}</span>
          <span className={styles.phaseTrigger}>{triggerLabel(phase.trigger)}</span>
        </button>
      ))}
      {adding ? (
        <div className={styles.addForm}>
          <input
            className={styles.addInput}
            placeholder="Phase name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            autoFocus
          />
          <select
            className={styles.addSelect}
            value={newTriggerType}
            onChange={(e) => setNewTriggerType(e.target.value as PhaseTrigger["type"])}
          >
            <option value="level">At Level</option>
            <option value="zone">At Zone</option>
            <option value="manual">Manual</option>
          </select>
          {newTriggerType === "level" && (
            <input
              className={styles.addLevelInput}
              type="number"
              min={1}
              max={100}
              value={newTriggerLevel}
              onChange={(e) => setNewTriggerLevel(Number(e.target.value))}
            />
          )}
          <button className={styles.addConfirm} onClick={handleAdd}>Add</button>
          <button className={styles.addCancel} onClick={() => setAdding(false)}>×</button>
        </div>
      ) : (
        <button className={styles.addBtn} onClick={() => setAdding(true)}>+</button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create PhaseBar styles**

```css
/* src/components/BuildPlan/PhaseBar.module.css */
.bar { display: flex; align-items: center; gap: 2px; padding: 6px 10px; border-bottom: 1px solid var(--border-color); background: var(--bg-panel); flex-shrink: 0; flex-wrap: wrap; }
.phaseTab { display: flex; flex-direction: column; padding: 5px 12px; background: none; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; text-align: left; transition: all 0.15s; }
.phaseTab:hover { border-color: var(--accent-gold); }
.active { border-color: var(--accent-gold); background: rgba(201, 168, 76, 0.08); }
.phaseName { font-size: 0.72rem; font-weight: 600; color: var(--text-primary); }
.phaseTrigger { font-size: 0.58rem; color: var(--text-secondary); }
.addBtn { padding: 5px 12px; background: none; border: 1px dashed var(--border-color); border-radius: 4px; color: var(--text-secondary); font-size: 0.85rem; cursor: pointer; }
.addBtn:hover { border-color: var(--accent-teal); color: var(--accent-teal); }
.addForm { display: flex; align-items: center; gap: 4px; }
.addInput { padding: 4px 8px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 3px; color: var(--text-primary); font-size: 0.7rem; width: 120px; }
.addSelect { padding: 4px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 3px; color: var(--text-primary); font-size: 0.65rem; }
.addLevelInput { width: 48px; padding: 4px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 3px; color: var(--text-primary); font-size: 0.7rem; text-align: center; }
.addConfirm { padding: 4px 8px; background: var(--accent-teal); border: none; border-radius: 3px; color: var(--bg-primary); font-size: 0.65rem; font-weight: 600; cursor: pointer; }
.addCancel { background: none; border: none; color: var(--text-secondary); font-size: 0.85rem; cursor: pointer; }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BuildPlan/PhaseBar.tsx src/components/BuildPlan/PhaseBar.module.css
git commit -m "feat: phase bar with trigger display and add form"
```

---

## Task 5: Gear Slot + Tooltip Component

**Files:**
- Create: `src/components/BuildPlan/GearSlot.tsx` + `.module.css`

- [ ] **Step 1: Create GearSlot component**

A single gear slot that shows the item image when filled, placeholder when empty. Hover shows tooltip with stats and desired mods.

```typescript
// src/components/BuildPlan/GearSlot.tsx
import { useState } from "react";
import type { BuildGearEntry, GearSlotKey } from "../../types";
import { GEAR_SLOT_LABELS } from "../../types/buildPlan";
import { itemById } from "../../data/items";
import { cleanModText } from "../../data/mods";
import styles from "./GearSlot.module.css";

interface GearSlotProps {
  slotKey: GearSlotKey;
  entry: BuildGearEntry | null;
  onClick: () => void;
  onRemove: () => void;
}

export function GearSlot({ slotKey, entry, onClick, onRemove }: GearSlotProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const label = GEAR_SLOT_LABELS[slotKey];
  const baseItem = entry?.baseItemId ? itemById.get(entry.baseItemId) : undefined;

  return (
    <div
      className={`${styles.slot} ${entry ? styles.filled : styles.empty}`}
      onClick={onClick}
      onMouseEnter={() => entry && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {entry?.iconPath ? (
        <img className={styles.icon} src={`/assets/${entry.iconPath}`} alt={entry.base} />
      ) : (
        <span className={styles.placeholder}>{label}</span>
      )}
      {entry?.priority != null && (
        <span className={styles.priorityBadge}>{entry.priority}</span>
      )}

      {/* Tooltip */}
      {showTooltip && entry && (
        <div className={styles.tooltip}>
          <div className={styles.ttName}>{entry.base || label}</div>
          {baseItem && (
            <>
              <div className={styles.ttClass}>{baseItem.itemClass}</div>
              <div className={styles.ttStats}>
                {baseItem.properties.physicalDamageMin != null && (
                  <span>Physical Damage: <strong>{baseItem.properties.physicalDamageMin}-{baseItem.properties.physicalDamageMax}</strong></span>
                )}
                {baseItem.properties.attackTime != null && (
                  <span>Weapon Speed: <strong>{(1000 / baseItem.properties.attackTime).toFixed(2)}</strong></span>
                )}
                {baseItem.properties.criticalStrikeChance != null && (
                  <span>Critical Hit Chance: <strong>{(baseItem.properties.criticalStrikeChance / 100).toFixed(1)}</strong></span>
                )}
                {baseItem.properties.armour && (
                  <span>Armour: <strong>{baseItem.properties.armour.min}</strong></span>
                )}
                {baseItem.properties.evasion && (
                  <span>Evasion: <strong>{baseItem.properties.evasion.min}</strong></span>
                )}
                {baseItem.properties.energyShield && (
                  <span>Energy Shield: <strong>{baseItem.properties.energyShield.min}</strong></span>
                )}
              </div>
              <div className={styles.ttReqs}>
                Requires: {baseItem.requirements.level} Level
                {baseItem.requirements.strength > 0 && `, ${baseItem.requirements.strength} Strength`}
                {baseItem.requirements.dexterity > 0 && `, ${baseItem.requirements.dexterity} Dexterity`}
                {baseItem.requirements.intelligence > 0 && `, ${baseItem.requirements.intelligence} Intelligence`}
              </div>
            </>
          )}
          {entry.desiredMods.length > 0 && (
            <div className={styles.ttMods}>
              {entry.desiredMods.map((mod, i) => (
                <div key={i} className={styles.ttMod}>{cleanModText(mod)}</div>
              ))}
            </div>
          )}
          <div className={styles.ttActions}>
            <button className={styles.ttRemove} onClick={(e) => { e.stopPropagation(); onRemove(); setShowTooltip(false); }}>
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create GearSlot styles**

The CSS should handle slot sizing via CSS custom properties set by the parent grid, plus tooltip positioning:

```css
/* src/components/BuildPlan/GearSlot.module.css */
.slot { position: relative; display: flex; align-items: center; justify-content: center; border-radius: 4px; cursor: pointer; transition: border-color 0.15s; overflow: visible; }
.empty { background: var(--bg-secondary); border: 1px dashed var(--border-color); }
.empty:hover { border-color: var(--accent-teal); }
.filled { background: var(--bg-stone); border: 1px solid var(--border-gold); }
.filled:hover { border-color: var(--accent-gold); }
.icon { width: 100%; height: 100%; object-fit: contain; padding: 4px; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.5)); }
.placeholder { font-size: 0.6rem; color: var(--text-secondary); opacity: 0.4; text-align: center; padding: 4px; }
.priorityBadge { position: absolute; bottom: 2px; left: 2px; background: var(--accent-gold); color: var(--bg-primary); font-size: 0.55rem; font-weight: 700; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: 2px; }

/* Tooltip */
.tooltip { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); z-index: 100; background: var(--bg-panel); border: 1px solid var(--border-gold); border-radius: 6px; padding: 10px; min-width: 220px; max-width: 300px; pointer-events: auto; box-shadow: 0 4px 16px rgba(0,0,0,0.6); }
.ttName { font-size: 0.85rem; font-weight: 700; color: var(--color-gold); margin-bottom: 2px; }
.ttClass { font-size: 0.65rem; color: var(--text-secondary); margin-bottom: 6px; }
.ttStats { display: flex; flex-direction: column; gap: 2px; font-size: 0.68rem; color: var(--text-primary); margin-bottom: 6px; }
.ttStats strong { color: var(--text-primary); }
.ttReqs { font-size: 0.62rem; color: var(--text-secondary); margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color); }
.ttMods { margin-bottom: 6px; }
.ttMod { font-size: 0.65rem; color: var(--accent-teal); padding: 1px 0; }
.ttMod::before { content: "• "; color: var(--accent-teal); }
.ttActions { display: flex; gap: 6px; }
.ttRemove { padding: 2px 8px; background: none; border: 1px solid var(--border-color); border-radius: 3px; color: var(--text-secondary); font-size: 0.6rem; cursor: pointer; }
.ttRemove:hover { border-color: var(--color-red); color: var(--color-red); }
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BuildPlan/GearSlot.tsx src/components/BuildPlan/GearSlot.module.css
git commit -m "feat: gear slot component with item image and hover tooltip"
```

---

## Task 6: Gear Grid Component

**Files:**
- Create: `src/components/BuildPlan/GearGrid.tsx` + `.module.css`

- [ ] **Step 1: Create GearGrid component**

CSS Grid layout matching the inventory arrangement. Includes Set 1/Set 2 toggle for weapon swap.

```typescript
// src/components/BuildPlan/GearGrid.tsx
import { useState } from "react";
import type { GearLayout, GearSlotKey } from "../../types";
import { GearSlot } from "./GearSlot";
import styles from "./GearGrid.module.css";

interface GearGridProps {
  gear: GearLayout;
  onSlotClick: (slot: GearSlotKey) => void;
  onRemoveSlot: (slot: GearSlotKey) => void;
}

export function GearGrid({ gear, onSlotClick, onRemoveSlot }: GearGridProps) {
  const [weaponSet, setWeaponSet] = useState<1 | 2>(1);

  const weaponSlot: GearSlotKey = weaponSet === 1 ? "weapon" : "weaponSwap";
  const offhandSlot: GearSlotKey = weaponSet === 1 ? "offhand" : "offhandSwap";

  return (
    <div className={styles.gridWrapper}>
      {/* Weapon set toggle */}
      <div className={styles.setToggle}>
        <button
          className={`${styles.setBtn} ${weaponSet === 1 ? styles.setBtnActive : ""}`}
          onClick={() => setWeaponSet(1)}
        >Set 1</button>
        <button
          className={`${styles.setBtn} ${weaponSet === 2 ? styles.setBtnActive : ""}`}
          onClick={() => setWeaponSet(2)}
        >Set 2</button>
      </div>

      <div className={styles.grid}>
        {/* Row 1: Helmet */}
        <div className={styles.helmet}>
          <GearSlot slotKey="helmet" entry={gear.helmet} onClick={() => onSlotClick("helmet")} onRemove={() => onRemoveSlot("helmet")} />
        </div>

        {/* Row 2: Weapon, Amulet, Body, Offhand */}
        <div className={styles.weapon}>
          <GearSlot slotKey={weaponSlot} entry={gear[weaponSlot]} onClick={() => onSlotClick(weaponSlot)} onRemove={() => onRemoveSlot(weaponSlot)} />
        </div>
        <div className={styles.amulet}>
          <GearSlot slotKey="amulet" entry={gear.amulet} onClick={() => onSlotClick("amulet")} onRemove={() => onRemoveSlot("amulet")} />
        </div>
        <div className={styles.body}>
          <GearSlot slotKey="bodyArmour" entry={gear.bodyArmour} onClick={() => onSlotClick("bodyArmour")} onRemove={() => onRemoveSlot("bodyArmour")} />
        </div>
        <div className={styles.offhand}>
          <GearSlot slotKey={offhandSlot} entry={gear[offhandSlot]} onClick={() => onSlotClick(offhandSlot)} onRemove={() => onRemoveSlot(offhandSlot)} />
        </div>

        {/* Row 3: Ring1, Belt, Ring2 */}
        <div className={styles.ring1}>
          <GearSlot slotKey="ring1" entry={gear.ring1} onClick={() => onSlotClick("ring1")} onRemove={() => onRemoveSlot("ring1")} />
        </div>
        <div className={styles.belt}>
          <GearSlot slotKey="belt" entry={gear.belt} onClick={() => onSlotClick("belt")} onRemove={() => onRemoveSlot("belt")} />
        </div>
        <div className={styles.ring2}>
          <GearSlot slotKey="ring2" entry={gear.ring2} onClick={() => onSlotClick("ring2")} onRemove={() => onRemoveSlot("ring2")} />
        </div>

        {/* Row 4: Gloves, Boots */}
        <div className={styles.gloves}>
          <GearSlot slotKey="gloves" entry={gear.gloves} onClick={() => onSlotClick("gloves")} onRemove={() => onRemoveSlot("gloves")} />
        </div>
        <div className={styles.boots}>
          <GearSlot slotKey="boots" entry={gear.boots} onClick={() => onSlotClick("boots")} onRemove={() => onRemoveSlot("boots")} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create GearGrid styles**

```css
/* src/components/BuildPlan/GearGrid.module.css */
.gridWrapper { padding: 10px; }
.setToggle { display: flex; justify-content: center; gap: 2px; margin-bottom: 8px; }
.setBtn { padding: 3px 12px; background: none; border: 1px solid var(--border-color); color: var(--text-secondary); font-size: 0.65rem; cursor: pointer; }
.setBtn:first-child { border-radius: 4px 0 0 4px; }
.setBtn:last-child { border-radius: 0 4px 4px 0; }
.setBtnActive { background: rgba(201,168,76,0.1); border-color: var(--accent-gold); color: var(--accent-gold); }

.grid {
  display: grid;
  grid-template-columns: 120px 60px 100px 60px 120px;
  grid-template-rows: 100px 160px 60px 100px;
  gap: 4px;
  justify-content: center;
  align-content: start;
}

/* Named grid areas */
.helmet   { grid-column: 3; grid-row: 1; }
.weapon   { grid-column: 1; grid-row: 2; }
.amulet   { grid-column: 2; grid-row: 2; align-self: start; }
.body     { grid-column: 3; grid-row: 2; }
.offhand  { grid-column: 5; grid-row: 2; }
.ring1    { grid-column: 2; grid-row: 3; }
.belt     { grid-column: 3; grid-row: 3; }
.ring2    { grid-column: 4; grid-row: 3; }
.gloves   { grid-column: 1; grid-row: 4; justify-self: end; }
.boots    { grid-column: 5; grid-row: 4; justify-self: start; }

/* Each grid area child is a GearSlot — fill the area */
.helmet > *, .weapon > *, .amulet > *, .body > *,
.offhand > *, .ring1 > *, .belt > *, .ring2 > *,
.gloves > *, .boots > * {
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/BuildPlan/GearGrid.tsx src/components/BuildPlan/GearGrid.module.css
git commit -m "feat: inventory-style gear grid with weapon swap sets"
```

---

## Task 7: Skill Row + Gem Tooltip Components

**Files:**
- Create: `src/components/BuildPlan/SkillRow.tsx` + `.module.css`
- Create: `src/components/BuildPlan/GemTooltip.tsx` + `.module.css`

- [ ] **Step 1: Create GemTooltip component**

```typescript
// src/components/BuildPlan/GemTooltip.tsx
import type { BuildGemEntry } from "../../types";
import { gemById } from "../../data/gems";
import { cleanModText } from "../../data/mods";
import { GEM_TYPE_LABELS } from "../../types/itemDatabase";
import styles from "./GemTooltip.module.css";

interface GemTooltipProps {
  gem: BuildGemEntry;
}

export function GemTooltip({ gem }: GemTooltipProps) {
  const dbGem = gem.gemId ? gemById.get(gem.gemId) : undefined;

  return (
    <div className={styles.tooltip}>
      <div className={styles.name}>{gem.name}</div>
      <div className={styles.tags}>
        <span className={styles.tag}>{GEM_TYPE_LABELS[gem.category === "skill" ? "active" : gem.category]}</span>
        {dbGem?.tags.slice(0, 4).map((t) => (
          <span key={t} className={styles.tag}>{t}</span>
        ))}
      </div>
      {gem.craftingLevel != null && (
        <div className={styles.level}>Level: ({gem.craftingLevel})</div>
      )}
      {dbGem?.supportText && (
        <div className={styles.description}>{cleanModText(dbGem.supportText)}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create GemTooltip styles**

```css
/* src/components/BuildPlan/GemTooltip.module.css */
.tooltip { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); z-index: 100; background: var(--bg-panel); border: 1px solid var(--border-gold); border-radius: 6px; padding: 10px; min-width: 200px; max-width: 280px; pointer-events: none; box-shadow: 0 4px 16px rgba(0,0,0,0.6); }
.name { font-size: 0.85rem; font-weight: 700; color: var(--color-gold); margin-bottom: 4px; }
.tags { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 6px; }
.tag { font-size: 0.58rem; padding: 1px 6px; border: 1px solid var(--border-color); border-radius: 3px; color: var(--text-secondary); }
.level { font-size: 0.65rem; color: var(--text-secondary); margin-bottom: 6px; }
.description { font-size: 0.65rem; color: var(--text-primary); line-height: 1.4; margin-bottom: 4px; }
```

- [ ] **Step 3: Create SkillRow component**

```typescript
// src/components/BuildPlan/SkillRow.tsx
import { useState } from "react";
import type { SkillGroup, BuildGemEntry } from "../../types";
import { GEM_COLOR_CSS } from "../../types/itemDatabase";
import { GemTooltip } from "./GemTooltip";
import styles from "./SkillRow.module.css";

interface SkillRowProps {
  group: SkillGroup;
  onSupportClick: (index: number) => void;
  onRemoveSupport: (index: number) => void;
  onRemoveSkill: () => void;
}

export function SkillRow({ group, onSupportClick, onRemoveSupport, onRemoveSkill }: SkillRowProps) {
  const [hoveredGem, setHoveredGem] = useState<BuildGemEntry | null>(null);
  const skill = group.skill;

  return (
    <div className={styles.row}>
      {/* Main skill gem */}
      <div
        className={styles.skillGem}
        onMouseEnter={() => setHoveredGem(skill)}
        onMouseLeave={() => setHoveredGem(null)}
        onClick={onRemoveSkill}
        style={{ borderColor: GEM_COLOR_CSS[skill.color ?? "w"] }}
      >
        {skill.iconPath ? (
          <img className={styles.skillIcon} src={`/assets/${skill.iconPath}`} alt={skill.name} />
        ) : (
          <span className={styles.skillFallback}>{skill.name[0]}</span>
        )}
        <span className={styles.priorityBadge}>{group.priority + 1}</span>
        {hoveredGem === skill && <GemTooltip gem={skill} />}
      </div>

      {/* Skill name */}
      <span className={styles.skillName}>{skill.name}</span>

      {/* 5 support gem slots */}
      <div className={styles.supports}>
        {group.supports.map((sup, i) => (
          <div
            key={i}
            className={`${styles.supportSlot} ${sup ? styles.supportFilled : styles.supportEmpty}`}
            style={sup ? { borderColor: GEM_COLOR_CSS[sup.color ?? "w"] } : undefined}
            onClick={() => sup ? onRemoveSupport(i) : onSupportClick(i)}
            onMouseEnter={() => sup && setHoveredGem(sup)}
            onMouseLeave={() => setHoveredGem(null)}
          >
            {sup?.iconPath ? (
              <img className={styles.supportIcon} src={`/assets/${sup.iconPath}`} alt={sup.name} />
            ) : null}
            {sup?.priority != null && (
              <span className={styles.supportBadge}>{sup.priority}</span>
            )}
            {hoveredGem === sup && sup && <GemTooltip gem={sup} />}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create SkillRow styles**

```css
/* src/components/BuildPlan/SkillRow.module.css */
.row { display: flex; align-items: center; gap: 10px; padding: 6px 10px; background: var(--bg-secondary); border-radius: 4px; margin-bottom: 4px; }
.row:hover { background: var(--bg-hover); }

/* Main skill circle */
.skillGem { position: relative; width: 56px; height: 56px; border-radius: 8px; border: 2px solid; display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer; background: var(--bg-stone); overflow: visible; }
.skillIcon { width: 100%; height: 100%; object-fit: contain; border-radius: 6px; }
.skillFallback { font-size: 1.2rem; color: var(--text-secondary); }

.skillName { flex: 1; font-size: 0.78rem; font-weight: 600; color: var(--text-primary); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.priorityBadge { position: absolute; bottom: -2px; left: -2px; background: var(--accent-gold); color: var(--bg-primary); font-size: 0.5rem; font-weight: 700; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; border-radius: 2px; }

/* Support gem slots */
.supports { display: flex; gap: 4px; flex-shrink: 0; }
.supportSlot { position: relative; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: visible; }
.supportEmpty { border: 1px dashed var(--border-color); background: rgba(0,0,0,0.2); }
.supportEmpty:hover { border-color: var(--accent-teal); }
.supportFilled { border: 2px solid; background: var(--bg-stone); }
.supportIcon { width: 100%; height: 100%; object-fit: contain; border-radius: 50%; }

.supportBadge { position: absolute; bottom: -2px; left: -2px; background: var(--accent-gold); color: var(--bg-primary); font-size: 0.45rem; font-weight: 700; width: 12px; height: 12px; display: flex; align-items: center; justify-content: center; border-radius: 2px; }
```

- [ ] **Step 5: Commit**

```bash
git add src/components/BuildPlan/GemTooltip.tsx src/components/BuildPlan/GemTooltip.module.css src/components/BuildPlan/SkillRow.tsx src/components/BuildPlan/SkillRow.module.css
git commit -m "feat: skill row with support sockets and gem hover tooltips"
```

---

## Task 8: Build Plan Root Rewrite

**Files:**
- Modify: `src/components/BuildPlan/BuildPlan.tsx` + `.module.css`
- Delete: `src/components/BuildPlan/PhaseEditor.tsx`, `GemSetup.tsx`, `GearTargets.tsx`

- [ ] **Step 1: Rewrite BuildPlan.tsx**

The new BuildPlan wires together PhaseBar, GearGrid, SkillRows, and an inline VendorRegex section. When a gear slot is clicked, it sets state to open the item browser (communicated upward to App via a callback or context — for now, use a simple modal approach with the ItemBrowser component).

```typescript
// src/components/BuildPlan/BuildPlan.tsx
import { useState, useCallback } from "react";
import { useCustomizationsStore } from "../../store/customizationsStore";
import { PhaseBar } from "./PhaseBar";
import { GearGrid } from "./GearGrid";
import { SkillRow } from "./SkillRow";
import { GemSearch } from "./GemSearch";
import { ItemBrowser } from "../ItemBrowser/ItemBrowser";
import { VendorRegex } from "../VendorRegex/VendorRegex";
import type { BuildPhase, GearSlotKey, PhaseTrigger, BuildGearEntry, BuildGemEntry } from "../../types";
import type { GemEntry, BaseItem } from "../../types/itemDatabase";
import styles from "./BuildPlan.module.css";

export function BuildPlan() {
  const buildPhases = useCustomizationsStore((s) => s.buildPhases);
  const activePhaseId = useCustomizationsStore((s) => s.activePhaseId);
  const setActivePhase = useCustomizationsStore((s) => s.setActivePhase);
  const addPhase = useCustomizationsStore((s) => s.addPhase);
  const setGearSlot = useCustomizationsStore((s) => s.setGearSlot);
  const addSkillGroup = useCustomizationsStore((s) => s.addSkillGroup);
  const removeSkillGroup = useCustomizationsStore((s) => s.removeSkillGroup);
  const setSupportInGroup = useCustomizationsStore((s) => s.setSupportInGroup);

  const activePhase = buildPhases.find((p) => p.id === activePhaseId) ?? null;

  // Item browser state
  const [browserSlot, setBrowserSlot] = useState<GearSlotKey | null>(null);

  // Gem search state
  const [gemSearchOpen, setGemSearchOpen] = useState(false);
  const [supportTarget, setSupportTarget] = useState<{ groupId: string; index: number } | null>(null);

  // Vendor regex collapsed state
  const [regexExpanded, setRegexExpanded] = useState(false);

  function handleAddPhase(name: string, trigger: PhaseTrigger) {
    addPhase(name);
    // TODO: updatePhaseTrigger for the new phase
  }

  function handleGearSlotClick(slot: GearSlotKey) {
    setBrowserSlot(slot);
  }

  function handleItemSelected(item: BaseItem) {
    if (!activePhaseId || !browserSlot) return;
    const entry: BuildGearEntry = {
      id: crypto.randomUUID(),
      slot: browserSlot,
      baseItemId: item.id,
      base: item.name,
      desiredMods: [],
      notes: "",
      iconPath: item.iconPath,
    };
    setGearSlot(activePhaseId, browserSlot, entry);
    setBrowserSlot(null);
  }

  function handleRemoveGearSlot(slot: GearSlotKey) {
    if (!activePhaseId) return;
    setGearSlot(activePhaseId, slot, null);
  }

  function handleAddSkill(gem: GemEntry) {
    if (!activePhaseId) return;
    const entry: BuildGemEntry = {
      id: crypto.randomUUID(),
      gemId: gem.id,
      name: gem.name,
      category: gem.gemType === "active" ? "skill" : gem.gemType,
      priority: activePhase?.gems.length ?? 0,
      supports: [],
      iconPath: gem.iconPath,
      color: gem.color,
      craftingLevel: gem.craftingLevel,
    };
    addSkillGroup(activePhaseId, entry);
    setGemSearchOpen(false);
  }

  function handleSupportClick(groupId: string, index: number) {
    setSupportTarget({ groupId, index });
  }

  function handleSupportSelected(gem: GemEntry) {
    if (!activePhaseId || !supportTarget) return;
    const entry: BuildGemEntry = {
      id: crypto.randomUUID(),
      gemId: gem.id,
      name: gem.name,
      category: "support",
      priority: 0,
      supports: [],
      iconPath: gem.iconPath,
      color: gem.color,
      craftingLevel: gem.craftingLevel,
    };
    setSupportInGroup(activePhaseId, supportTarget.groupId, supportTarget.index, entry);
    setSupportTarget(null);
  }

  function handleRemoveSupport(groupId: string, index: number) {
    if (!activePhaseId) return;
    setSupportInGroup(activePhaseId, groupId, index, null);
  }

  // Empty state
  if (buildPhases.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No build phases yet.</p>
        <button className={styles.createBtn} onClick={() => addPhase("League Start")}>
          Create Build Plan
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Phase bar */}
      <PhaseBar
        phases={buildPhases}
        activePhaseId={activePhaseId}
        onSelectPhase={setActivePhase}
        onAddPhase={handleAddPhase}
      />

      {activePhase && (
        <div className={styles.content}>
          {/* Gear grid */}
          <div className={styles.gearSection}>
            <GearGrid
              gear={activePhase.gear}
              onSlotClick={handleGearSlotClick}
              onRemoveSlot={handleRemoveGearSlot}
            />
          </div>

          {/* Skill gems */}
          <div className={styles.gemsSection}>
            <div className={styles.sectionHeader}>Skill Gems</div>
            {activePhase.gems.map((group) => (
              <SkillRow
                key={group.id}
                group={group}
                onSupportClick={(i) => handleSupportClick(group.id, i)}
                onRemoveSupport={(i) => handleRemoveSupport(group.id, i)}
                onRemoveSkill={() => removeSkillGroup(activePhaseId!, group.id)}
              />
            ))}
            <button className={styles.addSkillBtn} onClick={() => setGemSearchOpen(true)}>
              + Add Skill
            </button>
          </div>

          {/* Vendor regex */}
          <div className={styles.regexSection}>
            <button
              className={styles.regexToggle}
              onClick={() => setRegexExpanded(!regexExpanded)}
            >
              <span className={styles.regexChevron}>{regexExpanded ? "▼" : "▶"}</span>
              Vendor Regex ({activePhase.regexes.length})
            </button>
            {regexExpanded && <VendorRegex />}
          </div>
        </div>
      )}

      {/* Item browser modal */}
      {browserSlot && (
        <ItemBrowser
          onClose={() => setBrowserSlot(null)}
          onSelectItem={handleItemSelected}
        />
      )}

      {/* Gem search for adding skills */}
      {gemSearchOpen && (
        <GemSearch
          onSelect={handleAddSkill}
          onClose={() => setGemSearchOpen(false)}
          defaultCategory="active"
        />
      )}

      {/* Gem search for adding supports */}
      {supportTarget && (
        <GemSearch
          onSelect={handleSupportSelected}
          onClose={() => setSupportTarget(null)}
          defaultCategory="support"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update BuildPlan.module.css**

Replace the existing CSS with styles for the new visual layout:

```css
/* src/components/BuildPlan/BuildPlan.module.css — visual build planner */
.container { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.content { flex: 1; overflow-y: auto; }
.emptyState { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 12px; color: var(--text-secondary); }
.createBtn { padding: 8px 20px; background: var(--accent-teal); border: none; border-radius: 4px; color: var(--bg-primary); font-weight: 600; cursor: pointer; }

/* Sections */
.gearSection { border-bottom: 1px solid var(--border-color); }
.gemsSection { padding: 10px; }
.sectionHeader { font-size: 0.72rem; font-weight: 700; color: var(--accent-gold); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 8px; }
.addSkillBtn { width: 100%; padding: 8px; background: none; border: 1px dashed var(--border-color); border-radius: 4px; color: var(--text-secondary); font-size: 0.72rem; cursor: pointer; margin-top: 4px; }
.addSkillBtn:hover { border-color: var(--accent-teal); color: var(--accent-teal); }

/* Vendor regex */
.regexSection { border-top: 1px solid var(--border-color); padding: 0 10px; }
.regexToggle { display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 0; background: none; border: none; color: var(--text-secondary); font-size: 0.72rem; cursor: pointer; }
.regexToggle:hover { color: var(--text-primary); }
.regexChevron { font-size: 0.55rem; width: 10px; }
```

- [ ] **Step 3: Delete old components**

```bash
rm src/components/BuildPlan/PhaseEditor.tsx
rm src/components/BuildPlan/GemSetup.tsx
rm src/components/BuildPlan/GearTargets.tsx
```

- [ ] **Step 4: Verify it compiles and renders**

```bash
npx tsc --noEmit
npm run dev
```

Verify: build plan shows in 60% left with phase bar, gear grid, skill rows. Guide shows in 40% right.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: visual build plan with gear grid, skill rows, and integrated vendor regex"
```

---

## Task 9: Save Craft from Item Browser

**Files:**
- Modify: `src/components/ItemBrowser/ItemDetail.tsx`

- [ ] **Step 1: Add "Save to Build" button to craft planner**

In the `ItemDetail` component's planner panel, add a "Save to Build Plan" button that appears when mods are selected. This button needs to communicate with the build plan — the simplest approach is accepting a callback prop:

Update `ItemBrowserProps` to include `onSaveCraft`:

```typescript
interface ItemDetailProps {
  item: BaseItem;
  onSaveCraft?: (item: BaseItem, selectedMods: ItemMod[]) => void;
}
```

In the planner panel, after the selected mods, add:

```tsx
{hasSelections && onSaveCraft && (
  <button
    className={styles.saveCraftBtn}
    onClick={() => onSaveCraft(item, [...selectedMods.values()])}
  >
    Save to Build Plan
  </button>
)}
```

Thread this prop through `ItemBrowser` → `ItemDetail`. When `BuildPlan` opens the `ItemBrowser` for a gear slot, pass `onSaveCraft` that calls `setGearSlot` with the item + mods.

- [ ] **Step 2: Update BuildPlan to pass onSaveCraft**

In `BuildPlan.tsx`, update the `ItemBrowser` usage:

```tsx
{browserSlot && (
  <ItemBrowser
    onClose={() => setBrowserSlot(null)}
    onSelectItem={handleItemSelected}
    onSaveCraft={(item, mods) => {
      if (!activePhaseId || !browserSlot) return;
      const entry: BuildGearEntry = {
        id: crypto.randomUUID(),
        slot: browserSlot,
        baseItemId: item.id,
        base: item.name,
        desiredModIds: mods.map((m) => m.id),
        desiredMods: mods.map((m) => cleanModText(m.text)),
        notes: "",
        iconPath: item.iconPath,
      };
      setGearSlot(activePhaseId, browserSlot, entry);
      setBrowserSlot(null);
    }}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ItemBrowser/ItemDetail.tsx src/components/ItemBrowser/ItemBrowser.tsx src/components/BuildPlan/BuildPlan.tsx
git commit -m "feat: save craft from item browser directly into build plan gear slots"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Updated types | `src/types/buildPlan.ts` |
| 2 | Store migration + new actions | `src/store/customizationsStore.ts` |
| 3 | Layout restructure (60/40) | `CompanionLayout`, `App.tsx` |
| 4 | Phase bar with triggers | `PhaseBar.tsx` |
| 5 | Gear slot + tooltip | `GearSlot.tsx` |
| 6 | Gear grid layout | `GearGrid.tsx` |
| 7 | Skill row + gem tooltip | `SkillRow.tsx`, `GemTooltip.tsx` |
| 8 | Build plan root rewrite | `BuildPlan.tsx`, delete old components |
| 9 | Save craft integration | `ItemDetail.tsx`, `ItemBrowser.tsx` |
