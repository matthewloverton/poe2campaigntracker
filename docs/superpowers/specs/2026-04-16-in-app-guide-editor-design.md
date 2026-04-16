# In-App Guide Editor — Design

**Status:** Draft — awaiting user review
**Date:** 2026-04-16

## Purpose

Today the campaign guide comes from two bundled JSON files: `src/data/raw/guide.json` (default) and `src/data/raw/guide-custom.json` (custom). Switching to "Custom" in Settings just flips which one the `guideStore` reads; there is no way to modify guides without editing JSON on disk and rebuilding.

This spec adds an in-app editor that lets the user:

- Manage **multiple named custom guides**, stored in user data.
- **Fork the default guide** (or duplicate any custom guide) as a starting template.
- **Reorder, add, remove** acts, pages, and steps.
- Edit steps using a **step-editor toolbar** (icon / zone / color / quest / arena / class pickers, hint/optional toggles) instead of hand-writing raw syntax — while still allowing raw input for power edits.
- **Preview** each step rendered by the same tokenizer the running guide uses.
- **Auto-save** to user data; live-updates the active guide during a run.
- **Export / import** individual guides as JSON.

The default guide remains read-only and bundled — editing must fork first.

## Out of scope

- Cloud sync / multi-device sharing beyond manual export/import.
- Creating new condition *keys* (e.g., defining a brand-new filter axis). Only existing keys (`league-start`) are selectable in page metadata.
- WYSIWYG chip-based step editing. We keep raw syntax as the canonical step representation; the toolbar only *splices* raw syntax into the text input. Rationale: the tokenizer is battle-tested; a chip editor would need a perfect round-trip for every edge case (nested colors, conditionals, hints), which is a much larger project.
- A visual diff UI comparing a custom guide to the default.

## UX

### Entry point

A new **"Guides"** button in the build-plan header, alongside the existing Items / Gems / History trio in `App.tsx:98-112`. Uses the same `dbBtnStyle`.

### Modal shell

Full-screen modal matching the Items / Gems / History pattern: `95vw × 1400px max × 85vh`, closeable overlay, consistent header/close chrome. Standalone `GuideEditor` component at `src/components/GuideEditor/GuideEditor.tsx` plus its module CSS.

### Layout — two-pane tree + editor

```
┌───────────────────┬────────────────────────────────────────────┐
│ Guide tree        │  Editor (contextual to tree selection)     │
│ ─────────────     │  ─────────────────────────────────────     │
│ ▾ Default 🔒      │                                            │
│   ▸ Act 1         │                                            │
│   ▸ Act 2         │                                            │
│ ▾ SSF Custom      │                                            │
│   ▾ Act 1         │                                            │
│     • Riverbank   │                                            │
│     • Clearfell ◀ │                                            │
│     • Mud Burrow  │                                            │
│   ▸ Act 2         │                                            │
│ ▸ Safe            │                                            │
│                   │                                            │
│ [+ New Guide]     │                                            │
└───────────────────┴────────────────────────────────────────────┘
```

Left pane: expandable tree. Each node has a context icon for affordance:
- Guide node — duplicate / rename / delete / export
- Act node — add page / reorder (drag within act)
- Page node — labelled by `targetZoneName`; selecting populates the right pane

Drag reorder via `@dnd-kit` (already a dependency):
- Pages within their act
- Steps within their page
- Guides within the guide list (for user's own sort preference)

Acts are not reorderable (act numbers map to game acts 1-7; label is `Act N` / `Postgame N-4` per `GuidePanel.tsx:23`).

The currently-active guide (i.e., the one the running campaign is reading) is marked in the tree with a small "● playing" badge.

### Right pane by selection type

**Nothing selected** — placeholder "Select a guide, act, or page from the tree."

**Guide selected**
- Editable name field (auto-saves on blur)
- **Duplicate** — creates a deep copy named "<Name> (copy)"
- **Delete** — confirm dialog; disabled for default
- **Export** — copies guide JSON to clipboard (with a fallback prompt for manual copy, same pattern as `Settings.tsx:61-64`)
- **Active conditions** — per known condition key, a toggle showing what pages get filtered out when this guide is being played. Persists on the guide itself so each guide can have its own playback preferences. Example: `league-start: yes / no`.
- Read-only metadata for default: just the name and "Duplicate to new guide".

**Act selected**
- Page list (drag-reorder)
- Each page row shows: drag handle, zone name, step count, optional condition badge, trash icon (confirms)
- **+ Add page** at the bottom — creates an empty page in this act
- Disabled for default guide (explanatory "Duplicate to edit")

**Page selected (main editor)**

Top strip — page metadata:
- **Target zone (read-only)** — derived from step lines by the existing `extractTargetAreaId()` (`src/data/guide.ts:24`); no separate input. To change a page's target zone, edit the relevant `areaid...` step line. Shown as a small label so the user can see what the page resolves to.
- **Conditional** — off by default. If on: dropdown for key (currently only `league-start`) + dropdown for value (e.g., `yes` / `no`).

Below — step editor list. Each step is a row:

```
┌─────────────────────────────────────────────────────────┐
│ ⋮⋮  [Hint] [Optional]                                   │  ← toolbar row
│     Icon ▾  Zone ▾  Color ▾  Quest ▾  Arena ▾  Class ▾  │
│ ──────────────────────────────────────────────────────  │
│ ⋮⋮  kill (img:checkpoint) beira || enter...              │  ← raw text input
│ ──────────────────────────────────────────────────────  │
│       kill ◆ beira || enter ◇ the grelwood              │  ← live preview
└─────────────────────────────────────────────────────────┘
```

- **⋮⋮** drag handle — reorder steps.
- **Hint / Optional** — toggles; hint prepends `(hint)`, optional prepends `optional:`.
- **Toolbar pickers** — popovers. Each "inserts at cursor" in the raw input:
  - **Icon**: grid of known icons from the tokenizer (waypoint, checkpoint, quest_2, portal, skill, support, in-out2, lab, regal, ring, etc.).
  - **Zone**: search over `areas.json`, inserts `areaid<id> ;; <name>`.
  - **Color**: palette with known colors (red, purple `cc99ff`, magenta `ff00ff`, etc.) plus raw hex field; inserts `(color:<hex>)`.
  - **Quest**: free-text input, inserts `(quest:<slug>)`.
  - **Arena**: free-text input, inserts `arena:<slug>`.
  - **Class**: dropdown of known classes, inserts `<witch>` etc.
- **Raw input** — plain text; tokenized on every keystroke for preview.
- **Live preview** — renders via the existing `StepRenderer` component (same one the GuidePanel uses) for 1:1 fidelity.

**+ Add step** button at bottom of the list. Trash icon per row.

**Enabled state**: the page editor only writes to state if the current guide is non-default. Default-guide pages render everything read-only and disable inputs.

## Data model

### User-data storage

New Tauri user-data file: `guides.json`. Serialized shape:

```ts
interface StoredGuide {
  id: string;                     // uuid
  name: string;
  createdAt: string;              // ISO
  updatedAt: string;              // ISO
  acts: StoredAct[];              // index 0 = Act 1
  activeConditions: Record<string, string>; // per-guide playback filter
}

interface StoredAct {
  entries: StoredEntry[];         // preserves page order
}

type StoredEntry =
  | { type: "page"; lines: string[] }
  | { type: "conditional"; condition: [string, string]; lines: string[] };

interface GuidesFile {
  version: 1;
  activeGuideId: string | null;   // null = use default
  guides: StoredGuide[];          // user-created only (default is not stored here)
}
```

This is *close to* the existing raw JSON shape (`[act][entry][line]`) but lifted to a named-object structure with metadata.

The default guide is never serialized — it's always read from the bundled `guide.json`. Conceptually the tree shows it as guide id `"default"`, which the code resolves from the bundle.

### Conversion

Round-trip through the existing `transformGuideData()` pipeline in `src/data/guide.ts`:
- **On load**: for each stored guide, flatten `StoredAct[]` into the existing `RawGuide` shape and reuse `transformGuideData()` → `GuidePage[]`.
- **On edit**: writes update `StoredGuide` directly. A separate small selector rebuilds the `GuidePage[]` for that guide (tokenizing steps for preview).

This means the tokenizer is the single source of truth for parsing, just like today.

### Migration

On the first run after this feature ships, `guideStore.init()` (or equivalent on boot):

1. Reads `guides.json` from user data via `read_user_data`. If present, done.
2. If absent, bootstraps with the existing bundled `guide-custom.json` converted to a single `StoredGuide` named `"Custom"`. Writes `guides.json`.
3. The current `settingsStore.settings.guide` (`"default" | "custom"` string) becomes `activeGuideId`: `"default"` or the UUID of the migrated "Custom" guide. Settings schema keeps the field as a string for backward compat.

The bundled `src/data/raw/guide-custom.json` stays in the repo as the migration seed — not referenced at runtime after the first boot.

## Stores & components

### Store changes

**New:** `src/store/guidesStore.ts`
- Holds `StoredGuide[]` + `activeGuideId`.
- Actions: `createGuideFromDefault`, `duplicateGuide(id)`, `renameGuide(id, name)`, `deleteGuide(id)`, `setActiveGuide(id)`, `exportGuide(id): string`, `importGuide(json): string`.
- Page-level: `addPage(guideId, act)`, `deletePage(guideId, act, pageIdx)`, `reorderPage(...)`, `setPageCondition(...)`, `setPageTargetZone(...)`.
- Step-level: `addStep(guideId, act, pageIdx)`, `deleteStep(...)`, `reorderSteps(...)`, `setStepLine(guideId, act, pageIdx, stepIdx, raw)`, `toggleHint(...)`, `toggleOptional(...)`.
- Auto-saves to `guides.json` via Tauri on every mutation (debounced).
- Auto-updates `activeConditions` per-guide.

**Modified:** `src/store/guideStore.ts` (the running-guide store)
- `setGuide(id)` now takes a guide id (or `"default"`), replacing the binary `"default" | "custom"`.
- Reads from `guidesStore` for non-default guides; applies the active guide's `activeConditions` as the filter.

**Modified:** `src/store/settingsStore.ts`
- `settings.guide` changes from `"default" | "custom"` to `string` (guide id). Migration handled at load.

### New components (under `src/components/GuideEditor/`)

- `GuideEditor.tsx` — modal shell; holds selection state (selected guide / act / page).
- `GuideTree.tsx` — left pane; renders guides + acts + pages with drag handles and expand toggles.
- `GuidePane.tsx` — right pane when a guide is selected.
- `ActPane.tsx` — right pane when an act is selected.
- `PageEditor.tsx` — right pane when a page is selected; hosts metadata + step list.
- `StepRow.tsx` — one step, with toolbar + raw input + preview.
- `pickers/` — small popover components (`IconPicker`, `ZonePicker`, `ColorPicker`, `QuestPicker`, `ArenaPicker`, `ClassPicker`).

The existing `StepRenderer` component is reused for live preview.

### App integration

- `App.tsx`: add a fourth `dbBtnStyle` button "Guides" next to Items/Gems/History; wrap `<GuideEditor>` in the same overlay pattern as `<ItemBrowser>`.
- `Settings.tsx`: replace the default/custom radio pair with a dropdown sourced from `guidesStore.guides` (plus `Default`). Remove the "Edit src/data/raw/guide-custom.json to customize" hint.

## Error handling / edge cases

- **Deleting the active guide**: setActiveGuide falls back to `"default"`; a toast informs the user.
- **Deleting a page the user is currently running**: the running `guideStore.pages` is rebuilt; `currentPageIndex` clamps to `Math.min(idx, pages.length-1)`. Same pattern `setCondition` already uses in `guideStore.ts:66`.
- **Invalid raw step syntax**: the tokenizer is lenient; unknown tokens render as literal text. No validation error — the preview tells the user if something looks wrong.
- **Import JSON schema mismatch**: validate `version === 1` and `guides` is an array; on failure, `alert("Invalid guide JSON.")` and no state change — matches the Settings import pattern (`Settings.tsx:90-91`).
- **Disk write failure**: log to console; surface via existing toast system if one already exists for persistence errors, otherwise silent and retry on next mutation.

## Testing

Use Vitest (already configured). New tests:

- `guidesStore.test.ts`
  - `createGuideFromDefault` produces a full deep copy (mutating the new guide doesn't affect subsequent reads of default).
  - `duplicateGuide` copies all acts / pages / steps.
  - `addPage` / `deletePage` / `reorderPage` update the right act.
  - `addStep` / `deleteStep` / `reorderSteps` work on a specific page.
  - `setStepLine` with toolbar-inserted syntax produces a step whose tokens match expected (round-trip through tokenizer).
  - Migration from legacy bundled `guide-custom.json` yields a single guide named "Custom".
  - Import/export round-trip preserves structure.

- `guideStore.test.ts`
  - `setGuide(id)` with a custom guide id changes `pages` and respects `activeConditions`.
  - Falls back to `"default"` gracefully when the active guide is deleted.

Manual QA: the step editor requires visual verification (drag, pickers, preview parity with GuidePanel) — not worth automating for v1.

## Rollout

All changes land together; no feature flag. The feature is additive — if the new modal is never opened, behavior is unchanged (the migrated "Custom" guide is exactly the prior `guide-custom.json`).

## Open questions

1. **Active-conditions UI placement** — per-guide on the guide pane (as drafted) vs global in Settings. Per-guide is more flexible (each guide can have its own playback defaults) but arguably overkill if the user mostly toggles this once.

2. **Default-guide updates** — if the bundled `guide.json` gets updated in a future app version, users' forked custom guides won't get those changes. Is a "sync from default" / "show diff" feature wanted later? Out of scope for v1.
