# Path of Building (PoE2) Import/Export Design

**Date:** 2026-04-16
**Status:** Approved

## Goal

Let users move build data between this app and Path of Building Community — PoE2 fork.

- **Import:** Paste a PoB build code → app creates one build phase per PoB item set, populated with matched gear + skill groups.
- **Export:** Copy any crafted gear slot as a PoB-compatible item text block → paste directly into PoB's item-import UI.

## Non-Goals

- Importing or exporting the passive tree.
- Exporting a whole build as a PoB code (only per-item export).
- Round-tripping gem socket layouts / runes / soul cores in exported items (v1 skips sockets).
- Importing flasks or jewels (no corresponding model in this app).
- Live sync / URL-based sharing beyond what clipboard paste provides.

## User Flows

### Import

1. User clicks **Import from PoB** in the build plan header.
2. Modal opens with a textarea + "Import" button.
3. User pastes a PoB build code (the long base64 string shared on Reddit / pobb.in).
4. On submit:
   - Decode (base64 URL-safe → zlib inflate → UTF-8 XML).
   - Parse into a normalized shape (items, item sets, skill groups, skill sets).
   - Match items against base/mod/unique databases.
   - Match gems against the gems database.
   - Pair item sets with skill sets (see "Set Pairing" below).
5. Modal switches to a **preview** view showing:
   - Build name (from `<Build>` element, else "Imported Build").
   - One row per phase that will be created, with item count, skill-group count, and warning count.
   - A warnings panel (uniques not in DB, mods that fell back to free text, unknown slots, unmatched gems).
6. User clicks **Create N phases**:
   - Phases are appended to `customizationsStore.buildPhases`.
   - If a phase name collides with an existing one, auto-suffix `(2)`, `(3)`, …
   - Active phase is set to the first newly-created phase.
7. Modal closes.

### Export

1. Each gear slot with a populated `BuildGearEntry` shows a small **copy icon** in its top-right corner.
2. Clicking the icon:
   - Generates the PoB item text block (see "Export Format" below).
   - Writes it to the clipboard via `navigator.clipboard.writeText`.
   - Shows a brief in-slot "Copied!" badge (~600ms).
3. On clipboard failure (permission denied), falls back to `prompt("Copy this into PoB:", text)` — same pattern as the existing Settings export.

## Set Pairing Rules

PoB has independent `<ItemSet>` and `<SkillSet>` collections. This app's `BuildPhase` owns both gear and gems together, so we produce one phase per item set and attach a paired skill set.

Pairing proceeds in three passes:

1. **Name match** — any item set whose `title` exactly matches a skill set `title` is paired. Both are removed from the remaining pool.
2. **Index fallback** — remaining item sets and remaining skill sets are paired in their original document order.
3. **Leftover item sets** (more item sets than skill sets) — fall back to PoB's `activeSkillSet`.

If PoB has only one skill set, every item set gets paired with it via step 2/3.

## Architecture

New module `src/lib/pob/`:

```
src/lib/pob/
  types.ts          PoBItem, PoBSkillGroup, PoBSkillSet, ImportResult, ImportWarning
  codec.ts          decodeBuildCode(code: string): string  (XML)
  parseBuild.ts     parseBuildXml(xml: string): ParsedBuild
  matchItem.ts      matchItem(pobItem, slot): { entry, warnings }
  matchGem.ts       matchSkillGroup(pobGroup): { group, warnings }
  encodeItem.ts     encodeItem(entry: BuildGearEntry, base: BaseItem): string
  pairSets.ts       pairSets(items, skills, activeSkillSetId): Phase[]
  __fixtures__/     Real PoB build codes for tests
```

UI additions:

```
src/components/PoBImport/
  PoBImportModal.tsx   Paste + preview + confirm
  PoBImportModal.module.css
  ImportPreview.tsx    Phase list + warnings panel

src/components/BuildPlan/
  GearSlot.tsx         (modified) add copy button
```

Integration:
- Button entry point in `BuildPlan.tsx` header, next to existing phase controls.
- `customizationsStore` gets a new action `createPhasesFromPoB(phases: BuildPhase[])` that handles name collision suffixing and activates the first new phase.

## Data Model Mapping

### PoB slot → app slot

| PoB `<Slot name=...>` | App `GearSlotKey` |
|---|---|
| `Weapon 1` | `weapon` |
| `Weapon 2` | `offhand` |
| `Weapon 1 Swap` | `weaponSwap` |
| `Weapon 2 Swap` | `offhandSwap` |
| `Helmet` | `helmet` |
| `Body Armour` | `bodyArmour` |
| `Gloves` | `gloves` |
| `Boots` | `boots` |
| `Amulet` | `amulet` |
| `Ring 1` | `ring1` |
| `Ring 2` | `ring2` |
| `Belt` | `belt` |
| `Flask 1`..`5`, `Jewel*`, socket names | *(ignored, warning)* |

Table lives as a single `const POB_SLOT_MAP` in `matchItem.ts`; unknown slots raise a warning and skip the item.

### PoB item text block → `BuildGearEntry`

Parse the item body (newline-separated sections separated by `--------`):
- Header: rarity, item name, base type.
- Stat block: quality, damage ranges, req level/attributes, item level.
- Implicits: lines ending `(implicit)` — ignored for mod matching (they come from the base).
- Explicit mods: remaining lines (some with `(crafted)` / `(fractured)` suffixes — strip suffixes before matching).

Match:
- `base` (raw string) always set.
- `baseItemId` set if `Base Type` resolves against `baseItems`.
- `uniqueId` set if rarity=UNIQUE and item name resolves against uniques DB.
- For each explicit line: normalize numeric values to `#` (e.g. `"+83 to maximum Life"` → `"# to maximum Life"`), search `allMods` for a match, set `desiredModIds[i]` and `desiredMods[i]`. Unmatched lines keep the raw text in `desiredMods[i]` with no corresponding `desiredModIds[i]`.
- `quality`, `notes` carried over where present.
- `modRolls` not populated on import (we don't know which tier PoB used, and the percentile would be a guess).

### PoB skill group → `SkillGroup`

PoB XML:
```xml
<Skill mainActiveSkill="1" enabled="true" label="Lightning Arrow">
  <Gem level="20" quality="0" skillId="LightningArrowOfTheStorm" enabled="true" />
  <Gem level="20" quality="0" skillId="SupportMartialTempo" enabled="true" />
</Skill>
```

- `enabled="false"` groups → dropped, logged in warnings (one line per dropped group).
- `mainActiveSkill` index points at the main skill in the gem list. First gem is usually the main; fall back to gem[0] if `mainActiveSkill` is missing or out of range.
- Match `skillId` against the gems DB to fill `BuildGemEntry.gemId` / `name` / `iconPath`. Unmatched gem → still added to the group with a synthetic entry (`name` = skillId), warning emitted.
- Skill groups attached to the paired phase; if a phase gets no paired skill set, its gems are `[]` (user fills them in).

## Export Format

Matches the text format PoE generates when copying an item in-game (Ctrl+C). PoB's "Create custom / Import item" accepts this directly.

```
Item Class: <ItemClass>
Rarity: Rare
<Item Name>
<Base Type>
--------
Quality: +<q>% (augmented)
<damage / armour / evasion / ES lines from base>
--------
Requires: Level <req>, <attr reqs if any>
--------
Item Level: <ilvl>
--------
<implicit 1> (implicit)
<implicit 2> (implicit)
--------
<explicit mod 1>
<explicit mod 2>
...
--------
Note: Crafted in PoE2 Campaign Tracker
```

Generation rules:
- **Item Class** — from base item's `itemClass`.
- **Rarity** — `Rare` unless `uniqueId` is set, then `Unique`.
- **Item Name** — for uniques, the unique name; for rares, generate a plausible name (`"Doom Song"`-style, not load-bearing — PoB doesn't care).
- **Base Type** — the base item's `name`.
- **Quality** — `entry.quality` (default 20 for crafted-in-app items).
- **Stat lines** — from the base's damage / defence stats (augmented by quality where appropriate).
- **Requires** — from base's level + attribute reqs.
- **Item Level** — fixed at 82 (max-tier lets PoB compute tier labels if asked; not visible to build calculations).
- **Implicits** — base's implicit mod text, if any.
- **Explicits** — for each `desiredMods[i]`:
  - If `desiredModIds[i]` is set, resolve the mod; compute value from tier range and `modRolls[modId]` percentile (if set) or mid-point (if not).
  - If only `desiredMods[i]` (free text) is set: pass through as-is.
- **Note** — a marker so PoB users see where the item came from.

All section dividers are exactly `--------` (eight dashes, the format PoE uses).

## Error Handling

| Scenario | Behavior |
|---|---|
| Decode fails | Modal shows red banner: "Not a valid PoB code. Copy the full string from Path of Building's Import/Export → Generate Build Code." Stay on paste screen. |
| Valid decode, empty `<Items>` and `<Skills>` | Disable Create button, show "Nothing to import — this build has no items or skills". |
| Valid decode, one of `<Items>` / `<Skills>` missing | Continue; preview shows what was parsed + warning "No items found in build" / "No skills found in build". |
| PoB slot not in map | Warning: `Ignored slot: <name>` in `<set title>`. Item skipped. |
| Base not in DB | Entry created with raw `base` string. `baseItemId` empty. Warning: `Base "<name>" not in database`. |
| Unique not in DB | Treated as rare fallback (name lost, mods still matched). Warning: `Unique "<name>" not in database`. |
| Explicit mod can't be matched | Raw text kept in `desiredMods`. Warning: `Mod fell back to free text: "<text>"`. |
| Gem `skillId` not in DB | Added to group as synthetic entry. Warning: `Gem not in database: <skillId>`. |
| Phase name collision | Auto-suffix `(2)`, `(3)`, … |
| `navigator.clipboard.writeText` fails (export) | Fallback to `prompt("Copy this into PoB:", text)` — same pattern as Settings export. |

No libraries beyond `pako` (zlib in JS). DOMParser, TextDecoder, btoa/atob are native.

## Testing

Unit tests colocated with the module.

### `codec.test.ts`
- Round-trip: decode a known PoB code → XML; encoding the XML back reproduces the same code (or equivalent — zlib deflate is not deterministic, so verify by decoding both and comparing XML).
- Malformed input: truncated base64, non-zlib bytes, non-UTF-8 output — asserts thrown error with an informative message.

### `parseBuild.test.ts`
- Fixture: 2 item sets + 2 skill sets (one unnamed).
- Assert the parsed shape: item counts, slot names, gem ids, enabled/disabled flags.

### `pairSets.test.ts`
- Name match: item sets `["Endgame", "Level"]`, skill sets `["Level", "Endgame"]` → pairs by name.
- Index fallback: item sets `["A", "B"]`, skill sets `["X", "Y"]` → A↔X, B↔Y.
- Mixed: item sets `["Endgame", "Level", "Extra"]`, skill sets `["Level", "Endgame"]` → Endgame↔Endgame, Level↔Level, Extra↔active.
- Single skill set: item sets `["A", "B", "C"]`, skill sets `["Only"]` → all three paired with Only.

### `matchItem.test.ts`
- Base + all mods matched (happy).
- Base matched, one mod falls back to free text (warning fires, `desiredModIds[i]` undefined, `desiredMods[i]` raw).
- Base not matched (kept as free text, warning fires).
- Unique matched via uniques DB (`uniqueId` set).
- Unknown slot (null return + warning).
- Mod with `(crafted)` suffix matched after stripping.

### `matchGem.test.ts`
- Skill group with 1 main + 3 supports, all matched (group.skill = first gem, supports has 3).
- Unmatched gem → still added, warning emitted.
- Disabled group → returns null, warning emitted.

### `encodeItem.test.ts`
- Snapshot: given a fixture `BuildGearEntry` with known base + mods, assert exact output string.
- With `modRolls` set → values match percentile computation.
- Without `modRolls` → values match mid-point.
- Round-trip-ish: `parseItemText(encodeItem(entry))` produces an entry with the same `desiredMods` set (ignoring order + synthesized item name).

### Fixtures (`src/lib/pob/__fixtures__/`)
- `rare-only.pob.txt` — rare-only build, covers base + mod matching.
- `unique-heavy.pob.txt` — covers uniques path.
- `multi-set.pob.txt` — covers pairing (2 item sets, 2 skill sets, matching names).

No browser / E2E tests for the modal. Pure logic is covered; UI wiring verified by hand — matches the existing testing pattern in this codebase.
