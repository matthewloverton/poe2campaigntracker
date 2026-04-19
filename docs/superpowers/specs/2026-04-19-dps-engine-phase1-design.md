# DPS Engine — Phase 1 Design

**Status:** Draft for review
**Date:** 2026-04-19
**Parent:** [DPS Program Roadmap](2026-04-19-dps-program-roadmap.md)
**Phase:** 1 of 6

## Overview

Introduce a TypeScript DPS calculation engine that computes real per-skill damage-per-second for the active Build Plan phase, driven by gear mods, support gems, and skill gem innate stats. Surface results inline on each `SkillRow` with an expandable breakdown, and as a delta readout in the Craft Emulator when rolling weapons.

This phase deliberately excludes the passive tree, auras/buffs, flasks, ailments/DoT, and enemy resistances. Those phases land separately (see roadmap). Phase 1's architecture is designed so later phases slot in as new modifier sources and pipeline stages, not as engine rewrites.

**Calculation reference:** PathOfBuilding-PoE2's `CalcOffence.lua` pipeline shape is mirrored in TypeScript: `base → conversions → (1 + Σ increased) × ∏ more → rate → crit expectation`, per damage type, summed.

**Data source:** Existing RePoE2 ingestion via `scripts/transform-item-data.mjs`, extended to preserve structured per-level stats currently discarded.

## 1. Data Layer Changes

### 1.1 Extend `transform-item-data.mjs`

The script already fetches `skill_gems.min.json` from RePoE2. It currently preserves `costs`, `damageMultiplier`, and human-readable `statText` per level, discarding the structured `stats` dict and several skill-static fields.

**Preserve additionally per level:**
- `stats: Record<string, number>` — raw RePoE2 stat id → value (e.g. `base_fire_damage_min: 15`, `damage_effectiveness: 150`)
- `attackTime` (ms), when present

**Preserve additionally per skill (static):**
- `baseFlags: { attack?: boolean; spell?: boolean; projectile?: boolean; area?: boolean; ... }`
- `activeSkillTypes: string[]` (e.g. `["Attack", "Grenade", "Fire"]`)
- `weaponRestrictions: string[]` (item classes the skill is usable with)

Support gems: preserve structured `stats` per level plus `allowed_types` and `excluded_types` filters for tag matching.

### 1.2 Type additions (`src/types/itemDatabase.ts`)

Extend `SkillLevelData`:

```ts
interface SkillLevelData {
  costs: Record<string, number>;
  damageMultiplier?: number;
  statText: string[];
  stats: Record<string, number>;        // new — structured stat id → value
  attackTime?: number;                  // new — ms
}
```

Extend `SkillDetail`:

```ts
interface SkillDetail {
  // ...existing fields...
  baseFlags?: Record<string, boolean>;          // new
  activeSkillTypes?: string[];                   // new
  weaponRestrictions?: string[];                 // new
}
```

Add to `GemEntry` for support gems:

```ts
interface SupportFilter {
  allowedTypes?: string[];
  excludedTypes?: string[];
  addedTypes?: string[];
}
```

### 1.3 Regeneration

Regenerating `skill_gems.json` after the transform change is part of the implementation; no runtime behaviour differs until the engine consumes the new fields.

## 2. Engine (`src/lib/dps/`)

Pure, side-effect-free TypeScript module. No store imports, no React. Consumed via `useDps(snapshot)` hook.

### 2.1 Files

```
src/lib/dps/
├── types.ts          — all public types
├── snapshot.ts       — build snapshot assembly helpers (UI edge)
├── statMap.ts        — StatMap data structure + merge ops
├── modStats.ts       — gear mods → StatMap contributions
├── skillStats.ts     — skill gem innate stats → StatMap
├── supportStats.ts   — linked support gems → StatMap (with tag filter)
├── pipeline.ts       — base → conv → inc/more → rate → crit
├── breakdown.ts      — CalcBreakdown assembly
├── index.ts          — public calcDps(snapshot): SkillDps[]
└── __fixtures__/     — test snapshots and expected values
```

### 2.2 Input

```ts
interface DpsSnapshot {
  gear: GearLayout;                  // from BuildPhase.gear
  skillGroups: SkillGroup[];         // all active skills
  primarySkillId: string;            // highlighted skill for Craft delta
  rollMode: "actual" | "max";        // default "actual"
  // Phase 2+ additions land here (tree, auras, flasks, enemy)
}
```

### 2.3 StatMap — the central abstraction

`StatMap` is the load-bearing data structure for the entire program. Phase 1 introduces it; every later phase feeds into it.

```ts
type StatId = string;                // PoB-compatible, e.g. "physical_damage_+%"

interface StatContribution {
  value: number;
  kind: "flat" | "increased" | "more";
  tags: string[];                    // e.g. ["attack", "projectile", "fire"]
  source: ModifierSource;
}

interface ModifierSource {
  type: "gear" | "support" | "skill" | "gem_quality";   // Phase 1 set
  // Phase 2+: "tree" | "aura" | "buff" | "flask" | "ailment"
  id: string;                        // e.g. gear slot id, gem id, mod id
  label: string;                     // human-readable for breakdown UI
}

type StatMap = Map<StatId, StatContribution[]>;
```

**Key properties:**
- PoB's stat IDs are used verbatim. No translation layer.
- Every contribution is tagged with its source for breakdown rendering and future debugging.
- Contributions retain `tags` so the pipeline can filter stats per skill (e.g. `"projectile_damage_+%"` only applies to projectile skills).

### 2.4 Pipeline stages

Each stage is a pure function. Later phases add stages; they do not replace these.

```ts
// Stage A: assemble all contributions
buildStatMap(snapshot) → StatMap

// Stage B: resolve base damage per type for a given skill
calcBaseDamage(skill, level, weapon, statMap) → DamageRange[]

// Stage C: apply conversions (phys → fire etc.)
applyConversions(base, statMap) → DamageRange[]

// Stage D: increased × more per damage type
applyMultipliers(base, statMap, skillTags) → DamageRange[]

// Stage E: rate (attacks or casts per second)
calcRate(skill, level, weapon, statMap) → number

// Stage F: crit expectation
calcCrit(skill, statMap) → { chance, multi, expectedMulti }

// Stage G: combine into final DPS + breakdown
composeDps(damageByType, rate, crit) → { dps, breakdown }
```

### 2.5 Output

```ts
interface SkillDps {
  skillId: string;
  skillName: string;
  level: number;
  dps: number;
  perHit: { min: number; max: number };
  rate: number;
  crit: { chance: number; multi: number; expectedMulti: number };
  damageByType: Record<DamageType, { min: number; max: number }>;
  breakdown: CalcBreakdown;
}

interface CalcBreakdown {
  stages: BreakdownStage[];           // ordered, renderable
  sources: SourceSummary[];           // e.g. "8 gear mods, 2 supports, 1 skill"
}

interface BreakdownStage {
  label: string;                      // "Base per hit", "× Effectiveness (140%)"
  detail?: string;
  value?: number | string;            // formatted display value
  kind: "base" | "add" | "inc" | "more" | "rate" | "crit" | "total";
  contributions?: Array<{ source: ModifierSource; value: number }>;
}
```

`BreakdownStage.kind` is the extension point: Phase 2 adds `"tree"`, Phase 3 adds `"aura"`, etc. The UI renders unknown kinds generically.

### 2.6 Damage type handling

From Phase 1, all five damage types are tracked independently: `physical | fire | cold | lightning | chaos`. Skills dealing only one type still produce a full `damageByType` with zero entries elsewhere. This removes the incentive for Phase 3+ to refactor the shape.

### 2.7 Roll mode

`rollMode === "max"` resolves every gear mod at its max-roll value; `"actual"` uses the stored `modRolls[modId]` percentile. Uniques always resolve at their fixed unique-item values regardless of mode. Roll mode does not affect support gems, skill gems, or anything else.

## 3. UI

### 3.1 SkillRow — inline DPS column

`SkillRow` becomes a 3-column layout: skill gem | support gem strip | DPS value. The whole row is click-to-expand; expansion reveals the breakdown inline within the row, pushing the row below downward (no modal, no overlay).

```
┌─ row (collapsed) ─────────────────────────────────────────────┐
│  [gem]  [s][s][s][s][s]                        12,430 DPS  ▸  │
└───────────────────────────────────────────────────────────────┘

┌─ row (expanded) ──────────────────────────────────────────────┐
│  [gem]  [s][s][s][s][s]                        12,430 DPS  ▾  │
│                                                                │
│  Base per hit              420 – 680 fire                      │
│  × Effectiveness (140%)    588 – 952                           │
│  + Added (gloves, ring)    +18 – 34 fire                       │
│  × Increased (sum 87%)     × 1.87                              │
│  × More (supports)         × 1.44 × 1.20                       │
│  = Avg per hit             1,612                               │
│  × Rate 2.1/s              × 2.1                               │
│  × Crit expectation        × 1.34                              │
│  ─────────────────────────────────────                         │
│  = 12,430 DPS                                                  │
│  Sources: 8 gear, 2 supports, 1 skill                          │
└───────────────────────────────────────────────────────────────┘
```

A star-toggle on the row marks the primary skill (drives Craft Emulator delta). Roll-mode pill (`actual | max`) lives at the top of the Build Plan skill section.

### 3.2 Craft Emulator — delta readout

Compact card next to the rolled item preview:

```
┌─ Impact on Gas Grenade ──────────────┐
│  12,430  →  14,180                    │
│  +1,750 DPS  (+14.1%)         ▾      │
└───────────────────────────────────────┘
```

- Substitutes the rolled weapon into the active Build Plan phase snapshot.
- Re-runs engine; renders delta.
- Expanded view shows side-by-side breakdown with changed rows highlighted.
- Skill selector dropdown on the card label; defaults to primary.

### 3.3 Shared components

All in `src/components/Dps/`:

- `<DpsValue />` — number formatting (12,430 / 1.24M)
- `<DpsBreakdown />` — renders a `CalcBreakdown`; extensible row model keyed on `BreakdownStage.kind`
- `<RollModeToggle />` — 2-state pill
- `<DpsDelta />` — used in Craft Emulator

Engine calls flow through `useDps(snapshot)`, memoised on snapshot identity.

### 3.4 Explicitly not in Phase 1 UI

- No standalone DPS page.
- No multi-skill comparison view beyond the Craft Emulator primary dropdown.
- No enemy-config panel (no resistances in engine).
- No charts or graphs.
- No per-mod hover attribution on the gear grid (Phase 2 candidate).

## 4. Testing Strategy

`src/lib/dps/__fixtures__/` — each fixture is a hand-built `DpsSnapshot` plus expected `SkillDps` values.

- **Unit tests per stage:** feed a `StatMap` and/or snapshot into one stage, assert its output. Stages are the unit.
- **Golden-number tests:** end-to-end `calcDps` against hand-calculated expected DPS for each fixture. Numbers are computed outside the engine (spreadsheet or ad-hoc calc) and pasted in as expected values. Any engine change shows as a diff.
- **Regression coverage grows organically:** every time a new skill/mod/support is wired in, its fixture is added.

Initial fixture set (minimum for merge):
1. Bare crossbow, Galvanic Shards (attack, weapon-derived base).
2. Bare crossbow, Gas Grenade (grenade, skill-own base, no weapon scaling).
3. Crossbow + flat-phys ring, Galvanic Shards (tests `flat` contributions).
4. Crossbow + two supports, Gas Grenade (tests `more` stacking and tag filtering).
5. Crossbow + full Build Plan gear, primary skill (integration).

Mercenary-build focus ensures the author's real use case is exercised.

## 5. Data Ingestion Risks & Mitigations

- **RePoE2 stat id naming differs from PoB internal ids in edge cases.** Mitigation: on engine init, a small translation table maps any known divergences; log unknown stat ids in dev builds so gaps surface.
- **Support-gem tag filters are nuanced** (allowed/excluded/added types). Mitigation: explicit `applies(support, skill): boolean` helper with tests; no inline filtering logic.
- **Skill `statText` becomes redundant with structured stats.** Mitigation: keep `statText` as-is for tooltips; engine never reads it.
- **Damage Effectiveness on grenades vs attacks.** Mitigation: behaviour driven by `skill.baseFlags.attack` — attacks scale weapon damage by effectiveness, non-attacks apply effectiveness to their own skill-granted added damage.

## 6. File Inventory

**Modified:**
- `scripts/transform-item-data.mjs` — preserve structured skill stat fields.
- `src/types/itemDatabase.ts` — extend `SkillLevelData`, `SkillDetail`, add support filter types.
- `src/components/BuildPlan/SkillRow.tsx` + CSS — 3-column layout, expandable row.
- `src/components/BuildPlan/BuildPlan.tsx` — host `<RollModeToggle />`.
- `src/components/CraftEmulator/CraftEmulator.tsx` + CSS — add delta card.
- `src/data/raw/skill_gems.json` — regenerated output of transform change (not hand-edited).

**New:**
- `src/lib/dps/` — full engine directory (files listed §2.1).
- `src/components/Dps/` — shared UI components (§3.3).
- `src/components/Dps/*.module.css` — styles.

No changes to stores, settings, or existing data files beyond regeneration.

## 7. Out of Scope for Phase 1

Documented here so future brainstorms don't re-derive the exclusion list:

- Passive tree (Phase 2)
- Auras, buffs, flasks, charms (Phase 3)
- Ailments, DoT, enemy resistance/armour model (Phase 4)
- PoB XML import/export (Phase 5)
- Full loadout comparison UI (Phase 6)
- Reload/cycle DPS, magazine mechanics
- Defensive stats (life/ES/evasion/armour totals, resistance caps)
- Cost/mana/rage sustain modelling
- Animation cancelling, attack-canceled-reload, etc.
- Triggered skill effective DPS
