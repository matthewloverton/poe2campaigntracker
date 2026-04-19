# DPS Program Roadmap

**Status:** Planning
**Date:** 2026-04-19
**Scope:** Multi-phase strategy to build a PoB-style DPS/build-planning capability inside the campaign tracker, eventually replacing Path of Building 2 (PoB2) as the author's personal build-planning tool.

## Strategic Framing

This is not a single feature. It is a multi-phase program. Each phase must:

1. Ship standalone value (the app is better after the phase even if no further phase is built).
2. Lay correct architectural groundwork for later phases, so earlier phases are not rewritten.

**Source of truth:** [RePoE2](https://repoe-fork.github.io/poe2/) JSON exports, already consumed by `scripts/transform-item-data.mjs`.

**Calculation reference:** [PathOfBuilding-PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2) — used as an *algorithm benchmark only*. All logic is ported to TypeScript. No Lua runtime, no PoB data loader, no PoB code executed at runtime.

## Status

- **2026-04-19:** Phase 1 shipped. Delivered TypeScript DPS engine mirroring PoB's calc pipeline: weapon damage with local-mod resolution, skill base damage via `damage_multiplier` per stat set, gear + implicit + support mod aggregation, phys→elemental conversions, PoE2-correct crit multi (×2 base), reload-cycle rate for crossbows (per-base reload from PoB2), two-stage integer rounding matching PoB's display, and per-skill gem-level control. Integrated into SkillRow with inline DPS and expandable breakdown, plus Craft Emulator delta card with side-by-side comparison. Phase 2 (passive tree) is the next brainstorm target.

**Non-negotiable architectural commitments (apply from Phase 1):**

- Use PoB's stat ID naming verbatim (e.g. `physical_damage_+%`, `base_fire_damage_min`) so future CalcOffence ports are mechanical translation.
- Every modifier carries a `ModifierSource` tag (`gear | support | skill | tree | aura | flask | ailment | ...`) from the first line of code, so later phases slot in as new source types without engine changes.
- Pipeline stages are discrete, composable functions over a central `StatMap`. New stages (ailments, enemy resistance) are added; existing stages are not rewritten.
- Damage types (phys/fire/cold/light/chaos) tracked independently from Phase 1 onwards, even when most are zero.
- A full `CalcBreakdown` structure is produced per skill per calculation, and the UI renders it via an extensible row model.

## Phases

### Phase 1 — DPS Engine Foundation
- Enrich RePoE2 skill data ingestion to preserve structured per-level stats.
- Build `src/lib/dps/` TypeScript engine: snapshot → stat aggregation → PoB-shaped pipeline → `SkillDps[]`.
- Scope: gear mods + support gems + skill gem innate stats.
- Scope excludes: passive tree, auras/buffs, flasks, ailments/DoT, enemy resistances, reload/cycle DPS.
- UI: inline DPS column on `SkillRow`, expandable breakdown; Craft Emulator delta readout.
- **Ships:** real DPS numbers for gear comparison inside Build Plan and Craft Emulator.
- **Foundation:** `StatMap`, `ModifierSource`, pipeline stages, PoB-compatible stat IDs.
- **Detail spec:** [2026-04-19-dps-engine-phase1-design.md](2026-04-19-dps-engine-phase1-design.md)

### Phase 2 — Passive Tree
- Ingest tree data (RePoE2 `passive_skills` or equivalent).
- Tree allocation UI; keystone/notable stat resolution.
- Tree contributions flow into `StatMap` via a `tree` `ModifierSource`. Engine unchanged.
- **Ships:** tree-aware DPS; full planned character view.

### Phase 3 — Auras, Buffs, Flasks
- Aura effect aggregation; self-effect stacking.
- Buff uptime model; flask/charm active states.
- New `aura | buff | flask` sources into `StatMap`.
- **Ships:** buff-inclusive DPS, realistic combat numbers.

### Phase 4 — Ailments, DoT, Enemy Model
- Separate pipelines for ignite/poison/bleed.
- Chill/shock effects on enemy; enemy resistance/armour model.
- New pipeline stages; headline DPS distinguishes hit vs effective.
- **Ships:** boss/pinnacle effective-DPS estimates.

### Phase 5 — PoB Import/Export Compatibility
- Read/write PoB2 build XML codes.
- **Ships:** ecosystem interop; ability to import community builds.

### Phase 6 — Loadouts & Build Comparison
- Formalise Build Plan phases into full loadouts with comparison views.
- **Ships:** side-by-side build compare; full PoB-replacement parity for author's personal use.

## Decomposition Rule

Each phase beyond Phase 1 gets its own brainstorm → spec → plan cycle when it is time to build. This document tracks intent and ordering only; later phases are intentionally under-specified here to avoid premature design.

## What This Program is Not

- Not a public alternative to PoB. Personal-scale tool; no support commitments to external users implied.
- Not a Lua runtime. Nothing from PoB2's codebase is executed; only its algorithms and stat IDs are referenced.
- Not a live game data scraper. All data is build-time ingested from RePoE2.
