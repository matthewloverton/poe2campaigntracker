# PoE2 Item & Gem Database — Design Spec

## Overview

Add a full equipment and gem database to the campaign tracker, powered by structured data from [RePoE](https://repoe-fork.github.io/poe2/). Provides standalone browsable viewers for items and gems, feeds into the build plan editor with searchable pickers replacing free-text fields, and enhances campaign integration with level-aware reminders referencing real game data.

**Data source:** RePoE PoE2 fork — `base_items.min.json`, `mods.min.json`, `uniques.min.json`, `skill_gems.min.json`, plus art assets from the `Art/` directory. All data is transformed at build time into typed TypeScript modules, matching the existing guide data pipeline pattern.

## 1. Data Layer

### 1.1 Build-Time Transform Script

`scripts/transform-item-data.ts` — downloads RePoE JSON files and art assets, transforms into lean app-friendly TypeScript.

**Inputs (fetched from `https://repoe-fork.github.io/poe2/`):**
- `base_items.min.json` (~2.2MB) — all game items
- `mods.min.json` (~7.7MB) — all modifiers
- `uniques.min.json` (~103KB) — unique item definitions
- `skill_gems.min.json` — all gem definitions
- `Art/2DItems/` — equipment icons (webp)
- `Art/2DArt/SkillIcons/4k/` — gem skill icons (webp)
- `Art/2DArt/SkillIcons/Support/4k/` — gem support icons (webp)

**Outputs:**

#### `src/data/items.ts`
Filtered to released equipment only (~970 items across 28 item classes).

```typescript
interface BaseItem {
  id: string;              // metadata path key
  name: string;            // display name, e.g. "Varnished Crossbow"
  itemClass: string;       // e.g. "Crossbow", "Body Armour", "Ring"
  dropLevel: number;       // minimum drop/requirement level
  requirements: {
    level: number;
    strength: number;
    dexterity: number;
    intelligence: number;
  };
  properties: {
    // Weapons
    physicalDamageMin?: number;
    physicalDamageMax?: number;
    attackTime?: number;       // ms between attacks (lower = faster)
    criticalStrikeChance?: number; // x100, e.g. 500 = 5%
    range?: number;
    // Armour
    armour?: { min: number; max: number };
    evasion?: { min: number; max: number };
    energyShield?: { min: number; max: number };
  };
  implicits: string[];     // implicit mod IDs
  tags: string[];          // item tags (used for mod spawn weight matching)
  iconPath: string;        // resolved webp path relative to assets dir
}
```

**Item class groups for UI navigation:**
- **Weapons:** Claw, Dagger, Wand, One Hand Sword, Two Hand Sword, One Hand Axe, Two Hand Axe, One Hand Mace, Two Hand Mace, Sceptre, Staff, Warstaff (Quarterstaves), Spear, Flail, Bow, Crossbow, Focus, TrapTool (Traps)
- **Armour:** Body Armour, Helmet, Gloves, Boots, Shield, Buckler
- **Jewelry:** Amulet, Ring, Belt
- **Off-hand:** Quiver

#### `src/data/mods.ts`
Filtered to `domain: "item"` with `generation_type: "prefix" | "suffix"` (~1,750 craftable mods).

```typescript
interface ItemMod {
  id: string;              // mod key, e.g. "LocalIncreasedPhysicalDamagePercent3"
  name: string;            // affix name, e.g. "Tempered"
  text: string;            // display text, e.g. "(65-84)% increased Physical Damage"
  type: string;            // mod type/group, e.g. "LocalIncreasedPhysicalDamagePercent"
  generationType: "prefix" | "suffix";
  group: string;           // mod group for mutual exclusion
  requiredLevel: number;   // ilvl required to roll this mod
  stats: Array<{
    id: string;
    min: number;
    max: number;
  }>;
  canSpawnOn: string[];  // item tags where spawn weight > 0 (simplified from raw spawn_weights)
}
```

**Utility functions:**
- `getModsForItem(item: BaseItem): { prefixes: ItemMod[], suffixes: ItemMod[] }` — returns all mods whose spawn_weights have a non-zero weight for any of the item's tags
- `getModsForItemAtLevel(item: BaseItem, ilvl: number)` — same but filtered to `requiredLevel <= ilvl`
- `groupModsByType(mods: ItemMod[])` — groups mods by `type` for tier display (e.g. all tiers of "% increased Physical Damage" together)

#### `src/data/uniques.ts`
All unique items (~400) with their unique mods cross-referenced.

```typescript
interface UniqueItem {
  id: string;
  name: string;
  itemClass: string;
  iconPath: string;
  mods: string[];          // unique mod texts resolved from mods.json generation_type:"unique"
}
```

#### `src/data/gems.ts` (replaces existing)
All 1,103 gems from `skill_gems.min.json`, replacing the current Exile-UI gems.json source.

```typescript
interface GemEntry {
  id: string;              // metadata path key
  name: string;            // display name
  gemType: "active" | "support" | "spirit";
  color: "r" | "g" | "b" | "w";  // str-red, dex-green, int-blue, neutral
  craftingLevel: number;   // level when available for cutting
  craftingTypes: string[]; // weapon/style: ["Crossbow", "Bow", ...]
  tags: string[];          // gameplay tags: ["attack", "fire", "projectile", ...]
  supportText?: string;    // description (supports only)
  recommendedSupports: string[]; // gem IDs (active/spirit only)
  requirementWeights: {
    strength: number;
    dexterity: number;
    intelligence: number;
  };
  iconPath: string;        // resolved webp path
}
```

**Tier mapping** (derived from `craftingLevel`, matching poe2gems.com tiers):
- Tier I: craftingLevel 1-3
- Tier II: craftingLevel 4-7
- Tier III: craftingLevel 8-15
- Tier IV: craftingLevel 16-25
- Tier V: craftingLevel 26+

**Utility functions:**
- `searchGems(query: string, filters?: { gemType?, color?, craftingType?, tags? }): GemEntry[]`
- `getRecommendedSupports(gemId: string): GemEntry[]`
- `getGemsByWeaponType(weaponType: string): GemEntry[]`
- `getGemsByTier(): Map<number, GemEntry[]>`

### 1.2 Art Assets

Downloaded during the transform and placed in:
- `public/assets/items/` — equipment icons, flat directory (e.g. `items/2HCrossbow01.webp`)
- `public/assets/gems/` — all gem icons (active, support, spirit), flat directory

The transform script extracts the filename from each item/gem's `dds_file` path, replaces `.dds` with `.webp`, and downloads from the corresponding RePoE `Art/` URL. Files go in `public/` so Vite serves them as static assets.

### 1.3 Data Refresh

To update when a PoE2 patch drops: re-run `npm run transform-items` (or similar). The script re-downloads all RePoE data and regenerates the TypeScript modules + assets. No runtime network dependency.

## 2. Item Database Browser

A standalone browsable panel for the full equipment database.

### 2.1 Layout

**Two-pane browser:**

```
┌─────────────────┬─────────────────────────────────────────┐
│ Search: [_____] │  Varnished Crossbow                     │
│                 │  [icon]  Level 16 | 12-36 dmg | 1.6 aps │
│ ▼ Weapons       │  Req: 24 Str, 24 Dex                    │
│   Crossbows  26 │  Implicit: (none)                       │
│   Bows       26 │  Tags: crossbow, ranged, two_hand, ...  │
│   Daggers    22 │                                         │
│   ...           │  ┌─Prefixes──┬─Suffixes──┬─Uniques──┐  │
│ ▼ Armour        │  │                                   │  │
│   Body      152 │  │ ilvl filter: [___] ☐ enabled      │  │
│   Helmets   113 │  │                                   │  │
│   ...           │  │ % inc Physical Damage              │  │
│ ▼ Jewelry       │  │   T7 Tempered (65-84)%    lvl 16  │  │
│   Rings      18 │  │   T6 Razor    (85-109)%   lvl 33  │  │
│   ...           │  │   T5 ...                          │  │
│                 │  │                                   │  │
│                 │  │ Adds # to # Physical Damage       │  │
│                 │  │   T5 Heavy   (4-6 to 9-12) lvl 1  │  │
│                 │  │   ...                             │  │
│                 │  └───────────────────────────────────┘  │
└─────────────────┴─────────────────────────────────────────┘
```

### 2.2 Left Pane — Category Tree + Search

- Text search at top — filters across all item classes by name, shows matching items inline
- Collapsible category groups: Weapons, Armour, Jewelry, Off-hand
- Each item class shows count of bases (e.g. "Crossbows 26")
- Click an item class → shows list of all bases in that class, sorted by drop level ascending
- Click a base → populates the right detail pane

### 2.3 Right Pane — Item Detail

**Item card (top):**
- Item icon (webp from assets)
- Name, item class
- Level requirement + attribute requirements
- Stat line: damage range + attack speed + crit (weapons) or armour/evasion/ES values (armour)
- Implicit mods listed if any

**Mod table (bottom), three tabs:**

**Prefixes tab / Suffixes tab:**
- Mods grouped by type (e.g. all tiers of "% increased Physical Damage" together)
- Each group is a collapsible section showing all tiers:
  - Tier number, affix name, stat text with range, required level
  - Sorted by required level ascending within each group
- **ilvl filter:** number input + toggle. When enabled, mod tiers above the ilvl are greyed out / dimmed. Below are shown normally. Default: disabled (all tiers visible).
- Only shows mods whose spawn_weights match the selected item's tags

**Uniques tab:**
- Lists all unique items in the same item class
- Each entry: unique name, icon, unique mod texts

### 2.4 Access Points

- **Top bar button** — opens the browser as a full panel replacing center guide content, with a close button to return to the guide
- **From gear editor** — "Browse" button opens the browser pre-filtered to the relevant item class; selecting a base flows back into the gear editor field and closes the browser
- Closable, returns to previous view

## 3. Gem Database Browser

Modeled after poe2gems.com's visual style and layout.

### 3.1 Layout

```
┌──────────────────────────────────────────────────────────────┐
│  [All] [Crossbow] [Bow] [Spear] [Mace] [Sword] [Staff]     │
│  [Flail] [Elemental] [Occult] [Primal]                      │
│                                                              │
│  [Skills] [Supports] [Spirit]        Search: [____________] │
│                                                              │
│  ── Tier I ──────────────────────────────────────────────    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │  [icon] │ │  [icon] │ │  [icon] │ │  [icon] │           │
│  │ Explsve │ │  Frost  │ │  Armor  │ │  Smoke  │           │
│  │ Grenade │ │  Bomb   │ │ Pierce  │ │  Mine   │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│                                                              │
│  ── Tier III ────────────────────────────────────────────    │
│  ┌─────────┐ ┌─────────┐                                    │
│  │  [icon] │ │  [icon] │                                    │
│  │ Incndry │ │  Flash  │                                    │
│  │ Grenade │ │  Grenade│                                    │
│  └─────────┘ └─────────┘                                    │
│  ...                                                         │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Category Navigation

Top bar of filter buttons matching poe2gems.com categories, derived from `craftingTypes`:
- **All** — no filter
- **Crossbow, Bow, Spear, Mace, Sword, Quarterstaff, Flail** — martial weapon types
- **Elemental, Occult, Primal** — caster styles
- Plus **Axe, Dagger** if they have distinct entries

Toggle row: **Skills** | **Supports** | **Spirit** — filters by `gemType`.

Text search filters by name and tags.

### 3.3 Grid Display

- Responsive multi-column grid of gem cards
- Grouped by tier with section headers ("Tier I", "Tier II", etc.)
- Each card:
  - Gem icon (real game art from RePoE)
  - Square frame for active gems, round/circular frame for support gems, square frame with distinct glow for spirit gems
  - Color-tinted border: red (str), green (dex), blue (int), neutral/grey (w)
  - Gem name below icon
  - Crafting level indicator
- Dark stone-texture PoE2 aesthetic — warm gold text (#decf9d), dark background, ornate border treatment

### 3.4 Gem Detail Panel

Click a gem card → expands a detail panel (inline below the card, or slide-in side panel):
- Large icon + full name
- Gem type badge (Active / Support / Spirit)
- Color + crafting level
- Crafting types shown as category pills
- Tags as pills (attack, fire, projectile, area, grenade, etc.)
- Support text (for support gems)
- **Recommended supports** (for active/spirit gems): row of small clickable support gem icons with names. Click one → navigates to that support's detail.
- **"Add to build plan"** button — adds to the active phase's gem list

### 3.5 Access Points

- **Top bar button** — opens as full panel replacing center guide content, with a close button to return
- **From gem editor in build plan** — opens in picker mode; selecting a gem flows back into the editor and closes the browser

## 4. Build Plan Integration

### 4.1 Gear Editor Upgrades

The existing `PhaseEditor` gear editing flow gains database-backed fields:

**Base type field:**
- Becomes a searchable autocomplete dropdown
- Type text → shows matching base items with name, item class, level requirement, and tiny icon
- Selecting a base populates: icon, level, requirements, available mods
- Can also click "Browse" to open the full item database browser; selecting there flows back

**Desired mods field:**
- Becomes a searchable mod picker
- Only shows mods whose spawn_weights match the selected base's tags
- Each mod in the picker shows: affix name, stat text, tier, required level
- When ilvl filter is set, dims unavailable tiers
- Selected mods stack as an ordered priority list (existing behavior, now with real data)
- Can still type free-text for edge cases

**Gear entry display:**
- Shows base item icon + name + level badge
- Desired mods show formatted stat text instead of raw strings

**Updated `BuildGearEntry` type:**
```typescript
interface BuildGearEntry {
  id: string;
  slot: string;
  baseItemId?: string;     // reference to BaseItem.id (new)
  base: string;            // display name (kept for backward compat / free-text fallback)
  desiredModIds?: string[]; // references to ItemMod.id (new)
  desiredMods: string[];   // display text (kept for backward compat / free-text fallback)
  notes: string;
}
```

### 4.2 Gem Editor Upgrades

**Gem picker:**
- Gem name field opens the gem browser in picker mode
- Search/filter by category, weapon type, color
- Selecting a gem populates: icon, name, color, craftingLevel, craftingTypes
- Existing gems in the plan show with real icons — large circles for active/spirit, small circles for supports

**Support management:**
- When editing an active gem's supports, the picker pre-shows recommended supports from the game data
- Recommended supports appear first in the search results, marked with a "recommended" badge
- Can still search/add any other support

**Updated `BuildGemEntry` type:**
```typescript
interface BuildGemEntry {
  id: string;
  gemId?: string;          // reference to GemEntry.id (new)
  name: string;            // display name
  category: "skill" | "support" | "spirit";
  priority: number;
  supports: string[];      // support gem names or IDs
  iconPath?: string;       // resolved icon (new)
  color?: string;          // gem color (new)
  craftingLevel?: number;  // when available (new)
}
```

### 4.3 Vendor Regex Auto-Generation (Enhanced)

When gear targets use real mod data:
- Regex patterns generated from actual mod stat text (e.g. `ItemMod.text` → extract key terms)
- Base type name included in regex when a specific base is selected
- Patterns are more precise than hand-typed strings
- Auto-generated regexes in the vendor panel update dynamically when gear targets change
- Existing manual regex entry still supported alongside auto-generated ones

## 5. Campaign Integration

### 5.1 Gem Pickup Reminders

- Step reminders that reference gems by `gemId` show the gem's icon, name, and crafting level inline in the guide step
- When a gem's `craftingLevel` falls within the current act's level range, it auto-highlights in the build plan sidebar
- Quest reward gems from guide data cross-referenced with the build plan — if a guide step mentions a gem quest reward that matches a planned gem, it gets a visual callout (icon + "Pick up [Gem Name]")

### 5.2 Gear Milestone Reminders

- Reminders reference a `BuildGearEntry` with real base type and desired mods
- Display shows: item icon + base name + level + key desired mods inline
- "Look for Varnished Crossbow (lvl 16) — % increased Physical Damage, flat damage"
- Click the reminder → copies the vendor regex for that gear target to clipboard

### 5.3 Level-Aware Highlighting

- Build plan sidebar dims gear targets whose base drop level exceeds the current act's level range
- Highlights gear targets that just became available (drop level matches current progression)
- Same for gems — crafting level vs current act level
- This is passive visual treatment, not blocking — all items remain visible and editable

## 6. Visual Design

Follows the existing app's dark PoE2 aesthetic, with additions:

- **Item cards:** dark panel with item icon, gold text for name, muted stats below
- **Mod table rows:** alternating dark rows, tier numbers in muted gold, stat ranges in light text, greyed-out rows for ilvl-filtered mods
- **Gem cards:** poe2gems.com-inspired stone texture feel, gold text (#decf9d), color-tinted borders matching gem color (red/green/blue/grey)
- **Gem icon frames:** square with beveled edge for actives, circular for supports, square with glow for spirit
- **Category buttons:** icon + text pills, highlighted when active, matching game's weapon type icons where available

## 7. Backward Compatibility

- `BuildGearEntry` and `BuildGemEntry` retain their existing string fields (`base`, `desiredMods`, `name`, `supports`) so existing `customizations.json` files load without migration
- New `baseItemId`, `desiredModIds`, `gemId` fields are optional — entries without them display as free-text (current behavior)
- When a user edits an existing free-text entry and selects from the database picker, the ID fields get populated alongside the display strings

## 8. Out of Scope

- Endgame gem leveling stats / DPS calculations (this is a campaign tracker)
- Passive tree integration
- Trade site integration / price lookups
- Crafting simulator
- Runtime data fetching from RePoE (build-time only)
