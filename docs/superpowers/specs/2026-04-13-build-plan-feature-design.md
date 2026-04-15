# Build Plan Feature — Design Spec

## Overview

Replaces the separate gem tracker, gear advisor, and vendor regex sidebar panels with a unified **Build Plan** system. Users define custom-named campaign phases, each with a gem setup, gear targets, and vendor regexes. Build-specific reminders attach directly to guide steps and surface inline during gameplay.

## Data Model

### Build Phase

A named milestone in the campaign with the target gem/gear setup for that stage.

```typescript
interface BuildPhase {
  id: string;
  name: string;              // user-defined, e.g. "Start → Rust King", "Act 2 Level 16"
  order: number;             // sort order
  gems: BuildGemEntry[];     // skill gems with their supports
  gear: BuildGearEntry[];    // gear slot targets
  regexes: string[];         // vendor regexes for this phase
}

interface BuildGemEntry {
  id: string;
  name: string;              // e.g. "Explosive Grenade"
  category: "skill" | "support" | "spirit";
  priority: number;          // display order
  supports: string[];        // support gem names linked to this skill
}

interface BuildGearEntry {
  id: string;
  slot: string;              // e.g. "weapon", "boots"
  base: string;              // e.g. "Varnished Crossbow"
  desiredMods: string[];     // ordered by priority
  notes: string;             // crafting strategy
}
```

### Step Reminder

An annotation attached to a specific guide step that surfaces during gameplay.

```typescript
interface StepReminder {
  id: string;
  pageIndex: number;         // guide page (global index)
  stepIndex: number;         // step within the page
  type: "gem" | "gear" | "craft" | "note";
  text: string;              // the reminder content
  icon?: string;             // optional icon name
}
```

### Persistence

All build plan data saves to `customizations.json` alongside inline notes:

```json
{
  "buildPhases": [...],
  "stepReminders": [...],
  "inlineNotes": [...],
  "activePhaseId": "phase-1"
}
```

## UI Components

### Left Sidebar: Build Plan Panel

Replaces the separate Gem Tracker and Gear Advisor panels.

**Phase tabs/list** at the top — user's custom-named phases in order. Click to view a phase. Current phase highlighted (determined by where you are in the guide, or manually selected).

**Phase content** shows:

**Gem Setup:**
```
1. Explosive Grenade
     Multishot I
     Elemental Armament I
2. Flash Grenade
     Multishot I  
3. Attrition (spirit)
4. Frost Bomb
5. Pounce
```

Skills in priority order with supports indented underneath in hint style. Each has an add/remove button. Drag to reorder.

**Gear Targets:**
```
Weapon: Varnished Crossbow
  flat damage, %IPD, projectile levels
Boots: any
  movement speed, life, resistances
```

Slot name + base type + desired mods list.

**Vendor Regex:**
Regexes specific to this phase, click-to-copy.

**Edit mode:** Button to toggle editing — add/remove gems, edit supports, change gear targets, manage regexes. When not editing, the panel is read-only and compact for glancing during gameplay.

### Bottom Panel: Vendor Regex (unchanged)

Still shows vendor regexes, but now pulls from the **active phase's** regex list. Town detection still works.

### Inline Step Reminders

Attached to specific guide steps. Appear below the step text, similar to inline notes but with a type-specific icon and styling:

- **Gem reminder** (💎): "Pick up Explosive Grenade from Renly"
- **Gear reminder** (⚔): "Check weapon vendor — need crossbow with damage mods"
- **Craft reminder** (🔨): "Craft Varnished Crossbow with 3 damage prefixes"
- **Note reminder** (📝): freeform text (same as current inline notes)

Adding a reminder: click "+ add reminder" on any guide step (same hover interaction as current inline notes), choose type, enter text.

### Phase Auto-Detection

The active phase can be:
- **Manual** — user clicks a phase tab to select it
- **Auto** — phases are linked to guide page ranges; when the guide advances past a threshold, the active phase updates

For simplicity, start with manual phase selection. Auto-detection can be added later by letting users set a "starts at page" for each phase.

## Migration

The current `gemPlan`, `gearSlots`, and `vendorRegexes` in customizations.json get replaced by `buildPhases` and `stepReminders`. Since Phase 2a just shipped and users haven't built extensive configs yet, a clean replacement is fine — no migration needed.

## What Changes

**Removed:**
- `src/components/GemTracker/` — replaced by build plan gem setup
- `src/components/GearAdvisor/` — replaced by build plan gear targets
- Separate `gemPlan`, `gearSlots` from customizations store

**Added:**
- `src/components/BuildPlan/` — unified build plan panel
- `src/components/StepReminder/` — inline step reminders
- Build phases + step reminders in customizations store

**Kept:**
- `src/components/VendorRegex/` — still exists but reads from active phase
- `src/components/InlineNote/` — still exists alongside step reminders
- `src/components/CollapsiblePanel/` — reused
- `src/components/DragList/` — reused for gem reordering
- `src/components/Settings/` — kept as-is

## Out of Scope

- Importing builds from Mobalytics or other external sources (future)
- Auto-detecting which phase you're in (start with manual selection)
- Gem icon images from the game (use text + category indicator for now)
