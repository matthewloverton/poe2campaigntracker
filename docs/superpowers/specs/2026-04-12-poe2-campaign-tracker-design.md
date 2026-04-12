# PoE2 Campaign Tracker — Design Spec

## Overview

A standalone desktop app (Tauri + React + TypeScript) that serves as a second-monitor campaign companion for Path of Exile 2. Provides step-by-step campaign guide progression with auto-tracking via Client.txt log file, plus tools for gem planning, gear optimization, vendor regex searching, zone layout maps, and campaign timing.

**Target user:** PoE2 players optimizing campaign speed — glanceable on a second monitor while playing.

## Architecture

### Tech Stack

- **Desktop shell:** Tauri (Rust backend, system webview)
- **Frontend:** React + TypeScript
- **Persistence:** Local JSON files (no database)
- **Data source:** Guide data bundled from [Exile-UI](https://github.com/Lailloken/Exile-UI) repository JSON files, transformed at build time

### Project Structure

```
poe2campaigntracker/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # App entry, Tauri setup
│   │   ├── commands/       # Tauri command handlers
│   │   │   ├── file_io.rs  # Read/write user data JSON files
│   │   │   ├── log_watcher.rs  # Tail Client.txt, emit zone-change events
│   │   │   └── window.rs   # Display mode switching, overlay window setup
│   │   └── detect.rs       # Auto-detect PoE2 install path
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                    # React frontend
│   ├── components/
│   │   ├── GuidePanel/     # Core step-by-step guide view
│   │   ├── CampaignTimer/  # Timer with act splits
│   │   ├── GemTracker/     # Priority-ordered gem plan
│   │   ├── GearAdvisor/    # Gear slot priorities and mod lists
│   │   ├── ZoneMap/        # Zone layout map viewer
│   │   ├── VendorRegex/    # Vendor search regex panel
│   │   ├── LevelIndicator/ # XP zone-level range indicator
│   │   └── Settings/       # App configuration
│   ├── layouts/
│   │   ├── CompanionLayout.tsx  # Flex-based sidebar layout for companion mode
│   │   ├── OverlayLayout.tsx    # Transparent canvas with draggable widgets
│   │   └── WidgetContainer.tsx  # Draggable/resizable wrapper for overlay widgets
│   ├── data/               # Bundled guide data (transformed from Exile-UI JSON)
│   │   ├── guide.ts        # Act/zone/step progression data
│   │   ├── areas.ts        # Zone IDs, names, level recommendations
│   │   └── gems.ts         # Gem availability by act and category
│   ├── hooks/
│   │   ├── useLogWatcher.ts    # Subscribe to zone-change events from Tauri backend
│   │   ├── useTimer.ts         # Campaign timer logic
│   │   └── useAutoAdvance.ts   # Guide auto-advance from zone detection
│   ├── store/              # App state (React context or Zustand)
│   │   ├── guideStore.ts   # Current page/step, progress state
│   │   ├── timerStore.ts   # Timer state, act splits
│   │   └── userDataStore.ts # User customizations, gem plan, gear config
│   ├── App.tsx
│   └── main.tsx
├── user-data/              # Persisted user files (written at runtime)
│   ├── settings.json       # Client.txt path, display preferences
│   ├── progress.json       # Current step, timer splits, completion state
│   └── customizations.json # Gem plans, gear config, notes, vendor regexes
├── assets/
│   └── maps/               # Zone layout images (Act 1 from Mobalytics, user-addable)
├── scripts/
│   └── transform-guide-data.ts  # Build script: Exile-UI JSON → app data format
├── package.json
└── tsconfig.json
```

### Tauri Backend Responsibilities

The Rust backend is a thin layer handling four things:

1. **File I/O** — Read/write JSON files in the `user-data/` directory for settings, progress, and customizations. Exposes Tauri commands: `read_user_data(filename)`, `write_user_data(filename, data)`.

2. **Log watcher** — Tails the PoE2 `Client.txt` log file, parses zone-change lines (pattern: `Generating level N area "AreaId" with seed N`), and emits `zone-changed` events to the frontend with the area ID and zone name.

3. **Install detection** — On first launch, scans common install paths for the PoE2 Client.txt:
   - `C:\Program Files (x86)\Steam\steamapps\common\Path of Exile 2\logs\Client.txt`
   - `C:\Program Files\Grinding Gear Games\Path of Exile 2\logs\Client.txt`
   - Falls back to manual path selection via system file dialog.

4. **Window management** — Handles switching between companion and overlay display modes:
   - **Companion mode:** Standard decorated window with normal behavior.
   - **Overlay mode:** Reconfigures the window to fullscreen, transparent, frameless, always-on-top. On Windows, uses the native HWND handle to set `WS_EX_LAYERED` extended window style for per-pixel alpha click-through (transparent areas pass clicks to the game, widget areas capture input).
   - Exposes a Tauri command `set_display_mode(mode)` that toggles between modes at runtime.

### Frontend State Management

Use Zustand for lightweight state management. Three stores:

- **guideStore** — current act, current page index, total pages, auto-advance enabled flag
- **timerStore** — running/paused state, start timestamp, act split timestamps, elapsed times
- **userDataStore** — loaded from `customizations.json` on startup; gem plan, gear config, notes, vendor regexes. Writes back to disk on changes (debounced).

## Features

### 1. Guide Panel (core view)

The main area of the app. Displays the current "page" of campaign steps.

**Layout:**
- **Header:** Current act and zone name (e.g. "Act 1 — Clearfell"), progress bar showing page N of total
- **Step list:** Rendered instructions from the Exile-UI guide data. Each step is a line with:
  - Inline icons for markup tags: `(img:waypoint)` → waypoint icon, `(img:checkpoint)` → boss icon, `(img:quest_2)` → NPC quest icon, `(img:portal)` → portal icon, `(img:skill)` → gem icon
  - Color-highlighted text: `(color:red)` → red text, `(color:cc99ff)` → purple text for location names
  - Hint lines: `(hint)` prefix → rendered in smaller, muted text, collapsible
  - Zone destinations: `areaidXXX ;; Zone Name` → rendered as a zone link/label
- **Navigation:** Back/forward buttons. Dropdown to jump to any act → zone directly.
- **Inline notes:** Click any step to attach a personal note that persists below that step.

**Auto-advance behavior:**
- When the log watcher emits a `zone-changed` event, the guide checks if the new zone matches the target area ID on the current page.
- If the zone matches the current page's target: advance to next page. Show a brief toast: "Advanced to: [Zone Name]".
- If the zone matches a later page (player skipped ahead): fast-forward to that page.
- If the zone doesn't match any upcoming target (backtracking, side trip for waypoint): stay on current page. No action.
- Manual back/forward always available regardless of auto-advance state.

**Conditional steps:**
- The Exile-UI data contains conditional blocks (e.g. `"condition": ["league-start", "yes"]`). On first launch, prompt the user for relevant choices. Filter guide steps accordingly.

### 2. Campaign Timer

Always visible in the top bar.

**Display:** `HH:MM:SS | A1 | HH:MM:SS` — total elapsed, current act number, current act elapsed.

**Behavior:**
- Auto-starts on first zone-change event detected.
- Auto-splits when entering a new act (zone ID prefix changes from `g1_` to `g2_`, etc.).
- Records completed act times to `progress.json`.
- Pause/resume button for breaks.
- Reset button with confirmation dialog (starts fresh run).
- Persists across app restarts: saves running state + timestamps to `progress.json`. On reopen, calculates elapsed from saved start time.

### 3. Gem Tracker

Collapsible side panel. Shows your build's gem plan as a priority-ordered list.

**Gem plan structure:**
Each entry in the plan contains:
- **Gem name** and **category** (skill / support / spirit)
- **Priority rank** — drag to reorder. Top = level first.
- **Source:** quest reward (which quest/act), uncut gem cutting (tier needed), or vendor purchase (which act)
- **Status:** not acquired / acquired / leveling / target level reached
- **Cutting/leveling order** — separate ordered list for which gems to cut/level in what sequence

**Interactions:**
- Add gems via search (searchable list from `gems 2.json`, filterable by category)
- Remove gems from plan
- Drag to reorder priority
- Check off as acquired
- Gems that become available in the current act are highlighted

**Notifications:**
- When entering an act where a planned gem becomes available: toast notification "X is now available from [source]"
- Quest reward gems are also highlighted inline in the guide panel at the relevant step

**Data:** Persisted in `customizations.json`.

### 4. Gear Advisor

Collapsible side panel. Tracks gear priorities and desired mods.

**Gear slot list:**
- Slots ordered by user priority (drag to reorder): e.g. Weapon > Boots > Gloves > Rings > Body > Helmet > Belt > Amulet
- Priority order indicates which slots to upgrade first

**Per slot:**
- **Desired mods** — ordered list of stat priorities (e.g. Boots: 1. movement speed, 2. life, 3. resistances)
- **Free-text notes** — e.g. "swap to 2H mace if found with high phys", "need capped cold res before Act 3 boss"
- **Crafting milestones** — flag specific acts/levels for upgrades (e.g. "Act 2 level 16: craft Varnished Crossbow with 3 damage prefixes")

**Vendor check reminders:**
- Flag specific zones/acts where you want a "check vendors" reminder
- These appear as highlighted markers in the guide panel when you reach that zone
- Option for recurring reminder: "check vendors every time I enter a town"

**Data:** Persisted in `customizations.json`.

### 5. Level / XP Indicator

Small persistent display near the timer bar.

**Shows:**
- Current zone's recommended level range (from areas data: `"recommendation": "min | max"`)
- Color-coded feedback:
  - **Green:** character level within optimal range for the zone
  - **Yellow:** slightly over/under (1-2 levels off)
  - **Red:** significantly over/under (3+ levels, XP penalty territory)
- Act-level targets from campaign optimization data (e.g. "Act 1 target: level 13-14")

**Note:** Character level must be entered manually by the user (or updated periodically), since Client.txt doesn't reliably expose level info. A simple +/- stepper or number input in the top bar.

### 6. Zone Layout Maps

Collapsible panel showing schematic zone maps.

**Act 1 maps:**
- Bundled from Mobalytics CDN images (schematic diagrams showing pathing, waypoints, exits, boss locations)
- Zones with multiple seeds show all variants (e.g. Clearfell Seed 1, Seed 2)

**Behavior:**
- Auto-switches to current zone's map on zone change
- Manual zone selection dropdown for looking ahead
- Zoomable and pannable (pinch/scroll to zoom, drag to pan)

**Extensibility:**
- Zones without maps show "No layout available"
- Users can add their own map images to the `assets/maps/` directory, named by zone ID. The app scans and picks them up.
- Future acts can be added by dropping images into the maps folder.

### 7. Vendor Regex Panel

Auto-shows when entering a town zone. Click-to-copy regex strings.

**Auto-show behavior:**
- Town zones detected by zone ID (e.g. `g1_town`, `g2_town`, etc.)
- Panel slides in when entering town, slides out when leaving
- Manual toggle button to dismiss or bring back

**Regex sources:**
- **Auto-generated from gear config:** Desired mods per slot → regex patterns that highlight matching items in vendor UI
- **Auto-generated from gem plan:** Highlights uncut gems and vendor-purchasable gems you still need
- **Custom regexes:** User-added raw regex strings for anything else

**Each regex entry shows:**
- Description label (e.g. "Act 1 crossbow + damage mods")
- The regex string
- Click anywhere on the entry → copies regex to clipboard, brief "Copied!" flash confirmation

**Example:** `cross|mov|[egdl] da.* a|s.* skills` (crossbow with movement speed, damage mods, skill levels)

**Data:** Custom regexes persisted in `customizations.json`. Auto-generated ones rebuild dynamically from gear/gem config.

### 8. Settings

Accessible via gear icon in the top bar.

- **Display mode** — switch between Companion and Overlay modes (also toggleable via hotkey, e.g. F6)
- **Client.txt path** — auto-detected, with manual browse button
- **Font size** — slider for readability at different monitor distances
- **Notifications** — toggle auto-advance toasts, gem alerts, vendor reminders individually
- **Auto-show vendor regex** — toggle the auto-show-in-town behavior
- **Overlay settings** (when in overlay mode):
  - Per-widget opacity slider
  - Reset widget positions to defaults
  - Edit mode hotkey configuration (default F5)
- **Data management:**
  - Export customizations as JSON (share between machines / characters)
  - Import customizations from JSON
  - Reset all customizations to defaults
- **Reset run** — clear progress and timer for a fresh campaign run (with confirmation)

## Display Modes

The app supports two modes, switchable from the settings or a hotkey (e.g. F6):

### Companion Mode (default)

A normal desktop window for use on a second monitor. This is the standard layout described earlier.

**Layout (single-panel with collapsible sides):**
```
┌──────────────────────────────────────────────────────┐
│  [Timer: 01:23:45 | A1 | 00:15:30]  [Lvl: 8 ▼]  ⚙ │
│  ═══════════════════════════════════════════════════  │
│  ▌Progress: ████████░░░░░░░░░░ Page 5/42            │
├──────────┬───────────────────────────┬───────────────┤
│ Gems  [▼]│  Act 1 — The Grelwood     │ Map      [▼] │
│          │                           │               │
│ 1. Explo.│  ⚔ kill Beira             │  [zone map]  │
│ 2. Frost │  → enter The Grelwood     │  [zoomable]  │
│ 3. Multi.│    get waypoint            │               │
│ ─────────│    hint: diamond-shape     │               │
│ Gear  [▼]│  → enter The Red Vale     │               │
│          │    📝 "check for boots"   │               │
│ 1. Weapon│                           │               │
│ 2. Boots │  [< prev]    [next >]     │               │
│ 3. Gloves│                           │               │
├──────────┴───────────────────────────┴───────────────┤
│ 🔍 Vendor Regex (auto-shown in town)                 │
│  [click to copy] cross|mov|[egdl] da.* a|s.* skills │
└──────────────────────────────────────────────────────┘
```

- Left sidebar: Gem Tracker + Gear Advisor (collapsible, independently)
- Center: Guide Panel (always visible)
- Right sidebar: Zone Map (collapsible)
- Bottom: Vendor Regex (auto-shows in towns, manually toggleable)
- Top bar: Timer + Level Indicator + Settings gear
- Side panels can be collapsed to give the guide panel full width.

### Overlay Mode

A fullscreen transparent always-on-top window that sits over the game. Same features as companion mode, but rendered as independent floating widgets you can position anywhere on screen.

**Window setup:**
- Single Tauri window: fullscreen, transparent background, frameless, always-on-top
- Transparent areas pass through clicks to the game (Windows per-pixel alpha hit testing — areas with no drawn content are click-through)
- Each feature panel (guide, timer, gems, gear, map, vendor regex) is a separate draggable widget with a semi-transparent dark background

**Widgets:**
Each widget is a self-contained panel rendering the same React component as its companion-mode counterpart, but styled for overlay use:
- Semi-transparent dark background (adjustable opacity per widget)
- Compact layout — less padding, smaller fonts than companion mode
- Individually toggleable: show/hide each widget via a control menu or hotkey

**Play mode vs Edit mode (hotkey toggle, e.g. F5):**
- **Play mode:** Widgets display information and support minimal interaction (click-to-copy on regexes, back/forward on guide). Drag handles are hidden. Widgets are slightly more transparent.
- **Edit mode:** Widgets show drag handles and resize grips. Can reposition, resize, and toggle widgets. Slightly more opaque with a visible border/glow to indicate editability. A small control bar appears showing all available widgets with on/off toggles.

**Widget position persistence:**
- Each widget's position (x, y), size (width, height), opacity, and enabled/hidden state are saved to `settings.json` under an `overlayLayout` key
- Positions persist across app restarts
- Separate layout state from companion mode — switching modes preserves each mode's layout

**Overlay layout example:**
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─Timer──────────┐                    ┌─Map────────────┐  │
│  │01:23:45|A1|15m │                    │  [zone map]    │  │
│  │Lvl: 8 (green)  │                    │  [zoomable]    │  │
│  └────────────────┘                    └────────────────┘  │
│                                                             │
│                    (game visible                             │
│                     through transparent                      │
│                     background)                              │
│                                                             │
│  ┌─Guide──────────────────────┐  ┌─Gems──────────────────┐ │
│  │ Act 1 — The Grelwood       │  │ 1. Explosive Grenade  │ │
│  │ ⚔ kill Beira               │  │ 2. Frost Bomb         │ │
│  │ → enter The Grelwood       │  │ 3. Multishot I        │ │
│  │ [< prev]     [next >]      │  └───────────────────────┘ │
│  └────────────────────────────┘                             │
│                                                             │
│  ┌─Vendor Regex (in town)─────────────────────────────────┐ │
│  │ [copy] cross|mov|[egdl] da.* a|s.* skills              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Shared Component Architecture

Both modes render the same React components. Each feature component (GuidePanel, CampaignTimer, GemTracker, etc.) accepts a `displayMode: 'companion' | 'overlay'` prop that controls:
- Styling: compact vs full layout, transparency level, border treatment
- Wrapper: embedded in flex layout (companion) vs draggable/resizable container (overlay)

The `App.tsx` root switches between two layout shells based on the active mode:
- **CompanionLayout** — traditional flex-based layout with collapsible sidebars
- **OverlayLayout** — transparent canvas with freely positioned widget containers

## Visual Design

**Dark theme** matching the PoE2 aesthetic:
- Dark background (#1a1a2e or similar deep dark) for companion mode
- Semi-transparent dark (#1a1a2e at 80-90% opacity) for overlay widgets
- Muted gold/brown accents for headers and borders
- Light text (#e0e0e0) for readability
- Red/green/yellow for status indicators
- Purple (#cc99ff) for location names (matching Exile-UI convention)
- Teal highlights for interactive elements

## Data Pipeline

### Build-time Transform

The `scripts/transform-guide-data.ts` script converts Exile-UI JSON files into a cleaner TypeScript-friendly format:

**Input (Exile-UI format):**
```json
[
  [
    ["kill the_bloated_miller", "enter areaidg1_town ;; clearfell encampment"],
    ["(img:quest_2) renly: (img:skill) || enter areaidg1_2 ;; clearfell"]
  ]
]
```

**Output (app format):**
```typescript
interface GuidePage {
  act: number;           // 1-4
  pageIndex: number;     // within act
  targetAreaId: string;  // zone that triggers advance (last areaid on page)
  targetZoneName: string;
  steps: GuideStep[];
}

interface GuideStep {
  raw: string;           // original markup string
  tokens: StepToken[];   // parsed: { type: 'text'|'icon'|'color'|'hint'|'zone'|'conditional', value: string }
  isHint: boolean;
  zoneId?: string;       // if step references a zone
}
```

### Zone matching

The log watcher parses lines like:
```
2025-01-15 12:34:56 [INFO Client] Generating level 5 area "G1_2" with seed 12345
```

Extracts the area ID, normalizes to lowercase, and emits to frontend. The guide store compares against the current page's `targetAreaId` field.

## Persistence Schema

### settings.json
```json
{
  "clientTxtPath": "C:\\...\\Path of Exile 2\\logs\\Client.txt",
  "fontSize": 14,
  "displayMode": "companion",
  "notifications": {
    "autoAdvance": true,
    "gemAlerts": true,
    "vendorReminders": true
  },
  "autoShowVendorRegex": true,
  "overlayLayout": {
    "guide": { "x": 50, "y": 500, "width": 400, "height": 250, "opacity": 0.85, "enabled": true },
    "timer": { "x": 50, "y": 20, "width": 250, "height": 60, "opacity": 0.85, "enabled": true },
    "gems": { "x": 900, "y": 500, "width": 300, "height": 200, "opacity": 0.85, "enabled": true },
    "gear": { "x": 900, "y": 300, "width": 300, "height": 180, "opacity": 0.85, "enabled": false },
    "map": { "x": 900, "y": 20, "width": 300, "height": 250, "opacity": 0.85, "enabled": true },
    "vendorRegex": { "x": 50, "y": 780, "width": 600, "height": 80, "opacity": 0.85, "enabled": true }
  }
}
```

### progress.json
```json
{
  "currentPageIndex": 12,
  "timerState": "running",
  "timerStartedAt": "2026-04-12T15:30:00Z",
  "timerPausedElapsed": 0,
  "actSplits": {
    "1": { "startedAt": "...", "completedAt": "...", "elapsed": 1845000 },
    "2": { "startedAt": "...", "completedAt": null, "elapsed": null }
  }
}
```

### customizations.json
```json
{
  "gemPlan": [
    {
      "name": "Explosive Grenade",
      "category": "skill",
      "priority": 1,
      "source": { "type": "quest", "quest": "Renly", "act": 1 },
      "status": "acquired",
      "cuttingOrder": 1
    }
  ],
  "gearSlots": [
    {
      "slot": "weapon",
      "priority": 1,
      "desiredMods": ["flat damage", "% increased physical damage", "projectile skill levels"],
      "notes": "Save currency until Act 2 level 16. Craft Varnished Crossbow with 3 damage prefixes.",
      "vendorCheckZones": ["g1_town", "g2_town"],
      "craftingMilestones": [
        { "act": 2, "level": 16, "note": "Craft GIGA weapon on Varnished Crossbow" }
      ]
    }
  ],
  "inlineNotes": {
    "page_5_step_2": "check vendor for movement speed boots here"
  },
  "vendorRegexes": [
    {
      "label": "Act 1 crossbow + mods",
      "regex": "cross|mov|[egdl] da.* a|s.* skills",
      "enabled": true,
      "autoGenerated": false
    }
  ]
}
```

## Guide Data Markup Rendering

The Exile-UI guide uses a custom markup. The app's step renderer parses these into React components:

| Markup | Renders as |
|--------|-----------|
| `(img:waypoint)` | Waypoint icon (blue diamond) |
| `(img:checkpoint)` | Boss/checkpoint icon (red skull) |
| `(img:quest_2)` | NPC quest icon (yellow exclamation) |
| `(img:portal)` | Portal icon (purple swirl) |
| `(img:skill)` | Skill gem icon (green gem) |
| `(img:support)` | Support gem icon (blue gem) |
| `(img:in-out2)` | Side-trip icon (arrow loop) |
| `(img:lab)` | Trial icon |
| `(color:red)text` | Red-colored text span |
| `(color:cc99ff)text` | Purple-colored text span (locations) |
| `(hint)_ text` | Muted, smaller hint text (collapsible) |
| `areaidXXX ;; Zone Name` | Zone label badge |
| `arena:name` | Highlighted arena/landmark name |
| `(quest:name)` | Quest reward indicator |
| `\|\|` | Visual separator (or "then") |
| `kill name` | "kill" in red + enemy name bolded |
| `<tag>` | Class/build-specific tag label |

## Out of Scope (Future)

- Skill tree overlay / Path of Building integration
- Multiplayer/shared progress
- Auto-detecting character level from game memory
- Acts 2-4 zone layout maps (added when community maps become available)
- Mobile companion version
- Build import from external tools
