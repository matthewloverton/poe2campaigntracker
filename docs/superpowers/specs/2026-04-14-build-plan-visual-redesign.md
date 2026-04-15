# Build Plan Visual Redesign — Design Spec

## Overview

Redesign the build plan from a narrow text-heavy sidebar into the primary 60% panel with a visual equipment grid, gem socket layout, and integrated vendor regex. The campaign guide moves to a 40% right panel. All gear and gem entries reference real database items with images, replacing free-text fields.

## 1. Layout Restructure

### Current Layout
```
[TopBar                                    ]
[Build Plan (sidebar)] [Guide (center)     ]
[VendorRegex (bottom)                      ]
```

### New Layout
```
[TopBar                                    ]
[Build Plan (60%)         ] [Guide (40%)   ]
```

- `CompanionLayout` changes: the build plan becomes the `center` slot (flex: 3), the guide becomes the `rightSidebar` slot (flex: 2).
- Vendor regex moves inside the build plan as a collapsible section — bottom panel slot removed.
- Item/Gem browser buttons still swap the build plan area when clicked.
- The guide panel is always visible alongside, just narrower.

## 2. Phase System

Phases represent progression milestones. Each phase has its own complete gear layout + gem setup.

### Phase Model

```typescript
interface BuildPhase {
  id: string;
  name: string;             // e.g. "League Start", "First Upgrade"
  order: number;
  trigger: {
    type: "level" | "zone" | "manual";
    level?: number;          // e.g. 16
    zoneId?: string;         // e.g. "g2_1" (entering Act 2)
    zoneName?: string;       // display name for zone trigger
  };
  gear: GearLayout;
  gems: SkillGroup[];
  regexes: string[];
}
```

### Phase Bar

Horizontal tabs above the gear grid showing phase names with trigger subtitles:
- `[Phase 1: League Start (Lvl 1-15)] [Phase 2: First Upgrade (Lvl 16)] [+]`
- Active phase auto-advances based on current level or zone detection
- Click any phase tab to view/edit it
- "+" button to add a new phase with name + trigger config

## 3. Gear Panel — Visual Equipment Grid

### Slot Layout

An inventory-style fixed grid:

```
               [Helmet]
[Weapon]  [Amulet] [Body]   [Offhand]
          [Ring 1] [Belt]   [Ring 2]
[Gloves]           [Boots]
```

### Slot Sizing
- **Weapon / Offhand:** ~120x160px (tall, like 2H weapons)
- **Body Armour:** ~100x130px
- **Helmet, Gloves, Boots:** ~90x100px
- **Amulet, Rings:** ~60x60px
- **Belt:** ~80x40px

All sizes are approximate — the grid uses CSS grid with fixed areas.

### Slot States

**Empty slot:**
- Dark placeholder (--bg-secondary) with dashed border
- Slot name in muted text (e.g. "Weapon", "Helmet")
- Click → opens Item Browser filtered to that slot's item class(es)

**Filled slot:**
- Item image filling the slot area
- Priority number badge (bottom-left, small yellow square)
- Craft icon badge (bottom-left, next to priority) if desired mods are set
- Colored border: yellow for high priority, blue for standard
- Click → opens hover tooltip

### Hover Tooltip

Appears on hover/click of a filled gear slot:
- **Item name** (gold text)
- **Item class** (muted)
- **Stats:** damage range + APS + crit (weapons) or armour/evasion/ES (armour)
- **Requirements:** Level, Str, Dex, Int
- Divider line
- **Desired mods** listed below in teal (from craft planner selections)
- **Edit / Remove** buttons at bottom

### Weapon Swap (Set 1 / Set 2)

- Small "Set 1 | Set 2" toggle above or beside the weapon + offhand slots only
- Each set stores its own weapon + offhand selection
- All other gear slots are shared across sets
- Set 1 is default; Set 2 for planned weapon swaps

### Interaction: Filling a Slot

1. Click empty slot → Item Browser opens, filtered to valid item classes for that slot
2. Browse/search → select a base item
3. Item populates the slot with its image
4. Optionally open the item's detail view to plan mods via the craft planner
5. "Save to build" in the craft planner → desired mods stored on the gear entry

### Slot-to-ItemClass Mapping

```typescript
const SLOT_ITEM_CLASSES: Record<string, string[]> = {
  weapon: ["Claw", "Dagger", "Wand", "One Hand Sword", "Two Hand Sword",
           "One Hand Axe", "Two Hand Axe", "One Hand Mace", "Two Hand Mace",
           "Sceptre", "Staff", "Warstaff", "Spear", "Flail", "Bow",
           "Crossbow", "Focus", "TrapTool"],
  offhand: ["Shield", "Buckler", "Quiver", "Focus"],
  helmet: ["Helmet"],
  "body armour": ["Body Armour"],
  gloves: ["Gloves"],
  boots: ["Boots"],
  belt: ["Belt"],
  amulet: ["Amulet"],
  ring1: ["Ring"],
  ring2: ["Ring"],
};
```

## 4. Gem Panel — Skill Socket Layout

### Skill Group Layout

Each skill is a horizontal row:

```
⬤(56px)  Explosive Grenade    ○(40px) ○ ○ ○ ○
```

- **Main skill gem:** large circle (~56px), square-ish frame with rounded corners, colored border (r/g/b/w from gem color), real game icon
- **5 support gem slots** to the right: slightly smaller circles (~40px), circular frame, colored border when filled, dark dashed circle when empty
- **Priority badge:** small number on the main skill gem (bottom-left) indicating gem acquisition order
- **Support priority badges:** small numbers on each support indicating pickup order

### Empty Support Slot
- Dark circle with dashed border
- Click → opens Gem Browser filtered to support gems
- Selecting a support fills the slot with its icon

### Filled Support Slot
- Shows support gem icon with colored border
- Click → remove or swap
- Hover → tooltip with gem details

### Gem Hover Tooltip

Appears on hover of any gem (skill or support):
- **Gem name** (gold)
- **Tags** as pills (Support, Projectile, Fire, etc.)
- **Crafting level** (when available for cutting)
- **Support text** / description
- Effects listed in teal

### Above the Gem Rows

Total support gem attribute requirements summary:
- "Support Requirements: Str 5 | Dex 10 | Int 0"
- Computed from the requirement weights of all equipped support gems across all skills

### Adding a Skill

"+ Add Skill" button below the last skill row → opens Gem Browser filtered to active/spirit gems.

### Gem Priority

Rather than a separate section, priority is shown as numbered badges directly on each gem circle. The number indicates the order in which to acquire gems during the campaign (1 = get first).

## 5. Vendor Regex (Integrated)

Moves from the bottom panel into the build plan as a collapsible section below the gems.

- **Collapsed by default** — shows "Vendor Regex (N)" with expand arrow
- **Expanded:** shows auto-generated regexes from gear targets + manual regexes
- **Auto-generated:** base names + mod text from gear slots that have items/mods set
- **Manual:** user-added regex strings (existing functionality)
- **Click-to-copy** behavior preserved
- **"In Town" indicator** still highlights when player enters a town zone
- **Phase-specific:** each phase has its own regex list

## 6. Updated Data Types

### Updated BuildPhase

```typescript
interface BuildPhase {
  id: string;
  name: string;
  order: number;
  trigger: {
    type: "level" | "zone" | "manual";
    level?: number;
    zoneId?: string;
    zoneName?: string;
  };
  gear: GearLayout;
  gems: SkillGroup[];
  regexes: string[];
}
```

### New GearLayout

```typescript
interface GearLayout {
  weapon: BuildGearEntry | null;
  weaponSwap: BuildGearEntry | null;   // Set 2 weapon
  offhand: BuildGearEntry | null;
  offhandSwap: BuildGearEntry | null;  // Set 2 offhand
  helmet: BuildGearEntry | null;
  bodyArmour: BuildGearEntry | null;
  gloves: BuildGearEntry | null;
  boots: BuildGearEntry | null;
  belt: BuildGearEntry | null;
  amulet: BuildGearEntry | null;
  ring1: BuildGearEntry | null;
  ring2: BuildGearEntry | null;
}
```

### New SkillGroup

```typescript
interface SkillGroup {
  id: string;
  skill: BuildGemEntry;               // the main active/spirit gem
  supports: (BuildGemEntry | null)[];  // 5 support slots, null = empty
  priority: number;                    // display order
}
```

### BuildGearEntry (updated)

```typescript
interface BuildGearEntry {
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
```

### BuildGemEntry (unchanged)

Existing type with optional `gemId`, `iconPath`, `color`, `craftingLevel` fields is sufficient.

## 7. Phase Auto-Advance

When the campaign guide detects progression:
- **Level trigger:** if the player's level (from levelStore) reaches a phase's trigger level, that phase becomes active
- **Zone trigger:** if the log watcher emits a zone-change matching a phase's trigger zoneId, that phase becomes active
- **Manual trigger:** phase only activates when the user clicks it

The build plan highlights the active phase and shows a brief indicator when auto-advancing: "Phase 2: First Upgrade activated"

## 8. Backward Compatibility

- Existing `customizations.json` files with the old BuildPhase format (flat gems/gear arrays) will be migrated on load:
  - `gear[]` array → mapped into GearLayout slots by the `slot` field
  - `gems[]` array → each gem with category "skill" becomes a SkillGroup, its supports[] become the support slots
  - Trigger defaults to `{ type: "manual" }`
- The migration happens once on load and saves the new format

## 9. Out of Scope

- Passive tree / ascendancy planning
- DPS calculations
- Import from external build planners
- Skill gem leveling stat details
