# DPS Engine Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a TypeScript DPS engine that computes real per-skill damage-per-second from gear + support gems + skill innate stats, surfaced inline on `SkillRow` and as a delta readout in the Craft Emulator.

**Architecture:** Pure engine in `src/lib/dps/` organised around a central `StatMap` with `ModifierSource`-tagged contributions. Pipeline mirrors PoB's shape (base → conv → inc/more → rate → crit) but written in TypeScript. Data from RePoE2 via extended `transform-item-data.mjs`. No store coupling; UI consumes via a `useDps(snapshot)` hook.

**Tech Stack:** TypeScript, React, Vitest, Zustand (existing stores, read-only), Vite, Tauri. Existing patterns: `src/data/` for transformed JSON + typed wrappers, `src/lib/` for pure modules, CSS Modules for components.

**Reference specs:**
- [Phase 1 Design](../specs/2026-04-19-dps-engine-phase1-design.md)
- [Program Roadmap](../specs/2026-04-19-dps-program-roadmap.md)

**Conventions used throughout this plan:**
- All paths relative to repo root (`D:/Github/poe2campaigntracker`).
- Tests use Vitest (`*.test.ts` colocated with source).
- Run tests via `npm test -- <path>` (or `npm test -- --run <path>` for single-pass).
- Commits follow existing style in `git log` (e.g. `feat(dps): …`, `chore(data): …`).
- Never use `--no-verify`.

---

## Task 1: Investigate RePoE2 skill_gems raw data shape

**Purpose:** Confirm exact field names present on raw RePoE2 skill entries before modifying the transform. The existing transform drops several fields we need; we must know what's actually available. Produces a short findings doc used by Task 2.

**Files:**
- Create: `docs/superpowers/plans/notes/2026-04-19-repoe2-skill-fields.md`
- Read-only: `scripts/transform-item-data.mjs` (see `transformGems`, lines ~588–700)

- [ ] **Step 1: Fetch one raw skill_gems entry for inspection**

Pick a simple active attack gem (e.g. Galvanic Shards) and a grenade (e.g. Gas Grenade). Fetch the raw RePoE2 JSON directly:

```bash
curl -s https://repoe-fork.github.io/poe2/skill_gems.min.json -o /tmp/skill_gems.min.json
```

Then in Node REPL (or a temp script):

```js
const data = require("/tmp/skill_gems.min.json");
const gem = Object.entries(data).find(([, v]) => v.base_item?.display_name === "Galvanic Shards")[1];
console.log(JSON.stringify(gem, null, 2));
```

Repeat for Gas Grenade.

- [ ] **Step 2: Also fetch the raw skills-by-id dictionary that grants_skills references**

The transform code uses `rawSkills[id]` — inspect the shape of that. If RePoE2 ships a separate `skills.min.json` (or the skill records are embedded), document it:

```bash
# Check what other JSON files RePoE2 exposes
curl -s https://repoe-fork.github.io/poe2/ | grep -oE 'href="[^"]+\.json"'
```

- [ ] **Step 3: Write findings doc**

Capture, for each sample skill, the exact field paths for:
- Per-level structured stats (expected path: `stat_sets[i].per_level[lvl].stats: Record<string, number>` — confirm)
- Damage effectiveness (expected: `per_level[lvl].damage_effectiveness` or on stat_set level — confirm)
- `active_skill.base_flags` (attack, spell, projectile, area, duration, etc.)
- `active_skill.active_skill_types` or `types`
- `active_skill.weapon_restrictions`
- Attack time / cast time location (`cast_time` already used; note if `attack_time` exists per-level)

File:

```markdown
# RePoE2 skill_gems field findings (2026-04-19)

## Raw shape of a skill entry
(paste pruned JSON for Galvanic Shards showing only the fields we care about)

## Raw shape of a skill record (referenced by grants_skills id)
(paste pruned JSON showing active_skill block, stat_sets, per_level)

## Confirmed field paths
- Per-level structured stats: `stat_sets[i].per_level[lvl].stats` → `Record<stat_id, number>`
- Damage effectiveness: `<ACTUAL PATH>`
- base_flags: `active_skill.base_flags` → `Record<string, boolean>`
- active_skill_types: `<ACTUAL PATH>`
- weapon_restrictions: `<ACTUAL PATH>`
- attack_time: `<ACTUAL PATH or "not present">`

## Gotchas observed
(anything surprising, e.g. fields missing on some skill types)
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/notes/2026-04-19-repoe2-skill-fields.md
git commit -m "docs(dps): RePoE2 skill_gems field findings for Phase 1 transform"
```

---

## Task 2: Extend `transform-item-data.mjs` to preserve structured skill fields

**Purpose:** Stop discarding the structured per-level `stats` and skill-static fields needed by the DPS engine. No runtime behaviour changes yet; `skill_gems.json` grows.

**Files:**
- Modify: `scripts/transform-item-data.mjs` (function `transformGems`, approx lines 588–700)
- Regenerates: `src/data/raw/skill_gems.json`
- Reference: `docs/superpowers/plans/notes/2026-04-19-repoe2-skill-fields.md` (Task 1 output)

- [ ] **Step 1: Extend `extractStatSets` helper to preserve structured stats per level**

Inside `extractStatSets(skill, fallbackName)`, when building each `levels[lvl]` entry, add the structured `stats` dict and `attack_time` if present. Replace the existing block:

```js
levels[lvl] = {
  costs: data.costs || {},
  damageMultiplier: ssLevel?.damage_multiplier,
  statText: ssLevel?.stat_text
    ? Object.values(ssLevel.stat_text).map((t) => cleanModText(t))
    : [],
};
```

with:

```js
levels[lvl] = {
  costs: data.costs || {},
  damageMultiplier: ssLevel?.damage_multiplier,
  statText: ssLevel?.stat_text
    ? Object.values(ssLevel.stat_text).map((t) => cleanModText(t))
    : [],
  // Structured stats consumed by the DPS engine. Raw stat ids from RePoE2;
  // numeric values are the resolved per-level amount.
  stats: ssLevel?.stats ? { ...ssLevel.stats } : {},
  ...(data.attack_time !== undefined && { attackTime: data.attack_time }),
};
```

If Task 1 findings placed `stats` elsewhere (e.g. `data.stats` instead of `ssLevel.stats`), adjust accordingly. Prefer the stat-set-scoped path when both exist.

- [ ] **Step 2: Preserve skill-static fields on `skillDetail`**

In the `skillDetail = { ... }` assignment block, add the new fields. Replace:

```js
skillDetail = {
  description: primary.active_skill?.description
    ? cleanModText(primary.active_skill.description)
    : undefined,
  castTime: primary.cast_time,
  cooldown: primary.static?.cooldown,
  storedUses: primary.static?.stored_uses,
  attackSpeedMultiplier: primary.static?.attack_speed_multiplier,
  maxLevel,
  levels: primarySets[0]?.levels ?? {},
  staticStatText: primarySets[0]?.staticStatText ?? [],
  qualityStats: allStatSets.find((ss) => ss.qualityStats.length > 0)?.qualityStats ?? [],
  ...(allStatSets.length > 1 && { statSets: allStatSets }),
};
```

with:

```js
const activeSkill = primary.active_skill || {};
const baseFlags = activeSkill.base_flags || {};
const activeSkillTypes = activeSkill.active_skill_types || activeSkill.types || [];
const weaponRestrictions = activeSkill.weapon_restrictions || [];

skillDetail = {
  description: activeSkill.description ? cleanModText(activeSkill.description) : undefined,
  castTime: primary.cast_time,
  cooldown: primary.static?.cooldown,
  storedUses: primary.static?.stored_uses,
  attackSpeedMultiplier: primary.static?.attack_speed_multiplier,
  maxLevel,
  levels: primarySets[0]?.levels ?? {},
  staticStatText: primarySets[0]?.staticStatText ?? [],
  qualityStats: allStatSets.find((ss) => ss.qualityStats.length > 0)?.qualityStats ?? [],
  ...(allStatSets.length > 1 && { statSets: allStatSets }),
  ...(Object.keys(baseFlags).length > 0 && { baseFlags }),
  ...(activeSkillTypes.length > 0 && { activeSkillTypes }),
  ...(weaponRestrictions.length > 0 && { weaponRestrictions }),
};
```

Adjust field paths based on Task 1 findings.

- [ ] **Step 3: Preserve support-gem filter fields**

Inside the top-level `results.push({ ... })` for a gem entry, add support filter fields. Locate:

```js
...(gem.support_text && { supportText: gem.support_text }),
recommendedSupports: gem.recommended_supports ?? [],
```

and add immediately after:

```js
...(gem.allowed_active_skill_types && { allowedActiveSkillTypes: gem.allowed_active_skill_types }),
...(gem.excluded_active_skill_types && { excludedActiveSkillTypes: gem.excluded_active_skill_types }),
...(gem.added_active_skill_types && { addedActiveSkillTypes: gem.added_active_skill_types }),
```

Again, adjust based on Task 1 findings (field names may differ).

- [ ] **Step 4: Run the transform and verify the output**

```bash
npm run transform-items
# (or whatever script name exists — check package.json "scripts")
```

If no npm script exists, run directly:

```bash
node scripts/transform-item-data.mjs
```

Verify the output:

```bash
# Pick a known active skill and inspect one level
node -e "const g=require('./src/data/raw/skill_gems.json').find(x=>x.name==='Galvanic Shards');console.log(JSON.stringify(g.skillDetail.levels[1],null,2));console.log('baseFlags:',g.skillDetail.baseFlags);"
```

Expected: output shows a non-empty `stats` object on the level, and `baseFlags` populated with attack/projectile etc.

- [ ] **Step 5: Commit**

```bash
git add scripts/transform-item-data.mjs src/data/raw/skill_gems.json
git commit -m "feat(data): preserve structured skill stats + base flags from RePoE2"
```

---

## Task 3: Extend TypeScript types for the new gem fields

**Files:**
- Modify: `src/types/itemDatabase.ts`

- [ ] **Step 1: Extend `SkillLevelData`**

Replace:

```ts
export interface SkillLevelData {
  costs: Record<string, number>;
  damageMultiplier?: number;
  statText: string[];
}
```

with:

```ts
export interface SkillLevelData {
  costs: Record<string, number>;
  damageMultiplier?: number;
  statText: string[];
  /** Structured stat id → value map from RePoE2 per_level data. */
  stats: Record<string, number>;
  /** Per-level attack time in milliseconds (when provided by RePoE2). */
  attackTime?: number;
}
```

- [ ] **Step 2: Extend `SkillDetail`**

Replace:

```ts
export interface SkillDetail {
  description?: string;
  castTime?: number;        // ms
  cooldown?: number;        // ms
  storedUses?: number;
  attackSpeedMultiplier?: number;  // e.g. -25 means 75% of base
  maxLevel: number;
  levels: Record<string, SkillLevelData>;
  staticStatText: string[];
  qualityStats: QualityStat[];
  statSets?: StatSet[];
}
```

with:

```ts
export interface SkillDetail {
  description?: string;
  castTime?: number;
  cooldown?: number;
  storedUses?: number;
  attackSpeedMultiplier?: number;
  maxLevel: number;
  levels: Record<string, SkillLevelData>;
  staticStatText: string[];
  qualityStats: QualityStat[];
  statSets?: StatSet[];
  /** e.g. { attack: true, projectile: true, area: true } */
  baseFlags?: Record<string, boolean>;
  /** e.g. ["Attack", "Projectile", "Grenade", "Fire"] */
  activeSkillTypes?: string[];
  /** Item classes the skill is usable with (e.g. ["Crossbow"]). */
  weaponRestrictions?: string[];
}
```

- [ ] **Step 3: Extend `StatSet` with the same new per-level shape**

`StatSet.levels` is typed as `Record<string, SkillLevelData>` already, so no change needed there. Confirm by reading the type — if it uses an inline type instead, update it to `Record<string, SkillLevelData>`.

- [ ] **Step 4: Extend `GemEntry` with support filter fields**

Find `GemEntry` and add these optional fields:

```ts
export interface GemEntry {
  // ...existing fields...
  /** For support gems: active skill types this support can apply to. */
  allowedActiveSkillTypes?: string[];
  /** For support gems: active skill types explicitly excluded. */
  excludedActiveSkillTypes?: string[];
  /** For support gems: active skill types this support adds to the skill. */
  addedActiveSkillTypes?: string[];
}
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. Existing test files (`gems.test.ts`, `items.test.ts`, `mods.test.ts`) should still pass.

- [ ] **Step 6: Run existing data tests**

```bash
npm test -- --run src/data
```

Expected: all pass. If any fail because an existing test asserted the old shape, update the assertion minimally (do not rewrite test logic).

- [ ] **Step 7: Commit**

```bash
git add src/types/itemDatabase.ts
git commit -m "feat(types): extend SkillLevelData and SkillDetail for structured stats"
```

---

## Task 4: Scaffold the DPS engine module + shared types

**Files:**
- Create: `src/lib/dps/types.ts`
- Create: `src/lib/dps/index.ts`

- [ ] **Step 1: Create `src/lib/dps/types.ts`**

```ts
import type { GearLayout, SkillGroup } from "../../types/buildPlan";

export type DamageType = "physical" | "fire" | "cold" | "lightning" | "chaos";

export const DAMAGE_TYPES: readonly DamageType[] = [
  "physical", "fire", "cold", "lightning", "chaos",
] as const;

export type StatId = string; // PoB-compatible (e.g. "physical_damage_+%")

export type ContributionKind = "flat" | "increased" | "more";

export type ModifierSourceType =
  | "gear"
  | "support"
  | "skill"
  | "gem_quality";
// Phase 2+: "tree" | "aura" | "buff" | "flask" | "ailment"

export interface ModifierSource {
  type: ModifierSourceType;
  id: string;
  label: string;
}

export interface StatContribution {
  value: number;
  kind: ContributionKind;
  tags: string[];
  source: ModifierSource;
}

export type StatMap = Map<StatId, StatContribution[]>;

export type RollMode = "actual" | "max";

export interface DpsSnapshot {
  gear: GearLayout;
  skillGroups: SkillGroup[];
  primarySkillId: string;
  rollMode: RollMode;
}

export interface DamageRange {
  min: number;
  max: number;
}

export type DamageByType = Record<DamageType, DamageRange>;

export interface CritInfo {
  chance: number;     // 0..1
  multi: number;      // e.g. 1.5 for +50% crit multi
  expectedMulti: number;
}

export type BreakdownStageKind =
  | "base"
  | "add"
  | "inc"
  | "more"
  | "rate"
  | "crit"
  | "total";

export interface BreakdownContribution {
  source: ModifierSource;
  value: number;
}

export interface BreakdownStage {
  kind: BreakdownStageKind;
  label: string;
  detail?: string;
  value?: number | string;
  contributions?: BreakdownContribution[];
}

export interface SourceSummary {
  type: ModifierSourceType;
  count: number;
}

export interface CalcBreakdown {
  stages: BreakdownStage[];
  sources: SourceSummary[];
}

export interface SkillDps {
  skillId: string;
  skillName: string;
  level: number;
  dps: number;
  perHit: DamageRange;
  rate: number;
  crit: CritInfo;
  damageByType: DamageByType;
  breakdown: CalcBreakdown;
}
```

- [ ] **Step 2: Create `src/lib/dps/index.ts` with a stub public API**

```ts
import type { DpsSnapshot, SkillDps } from "./types";

export * from "./types";

/**
 * Compute DPS for every active skill in the snapshot.
 * Phase 1 scope: gear mods + support gems + skill innate stats.
 */
export function calcDps(snapshot: DpsSnapshot): SkillDps[] {
  // Real implementation lands in Task 11.
  void snapshot;
  return [];
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dps/types.ts src/lib/dps/index.ts
git commit -m "feat(dps): scaffold engine module with public types"
```

---

## Task 5: StatMap module

**Files:**
- Create: `src/lib/dps/statMap.ts`
- Create: `src/lib/dps/statMap.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/dps/statMap.test.ts
import { describe, it, expect } from "vitest";
import { emptyStatMap, addContribution, mergeStatMaps, sumInc, productMore, sumFlat } from "./statMap";
import type { ModifierSource } from "./types";

const src = (id: string, label: string): ModifierSource => ({ type: "gear", id, label });

describe("statMap", () => {
  it("adds contributions under a stat id", () => {
    const m = emptyStatMap();
    addContribution(m, "physical_damage_+%", { value: 20, kind: "increased", tags: ["attack"], source: src("ring1", "Ring 1") });
    addContribution(m, "physical_damage_+%", { value: 15, kind: "increased", tags: ["attack"], source: src("gloves", "Gloves") });
    expect(m.get("physical_damage_+%")?.length).toBe(2);
  });

  it("sumInc adds increased contributions matching the required tag", () => {
    const m = emptyStatMap();
    addContribution(m, "damage_+%", { value: 20, kind: "increased", tags: ["attack"], source: src("a", "A") });
    addContribution(m, "damage_+%", { value: 30, kind: "increased", tags: ["spell"], source: src("b", "B") });
    expect(sumInc(m, "damage_+%", ["attack"])).toBe(20);
    expect(sumInc(m, "damage_+%", ["spell"])).toBe(30);
  });

  it("productMore multiplies more contributions matching tags", () => {
    const m = emptyStatMap();
    addContribution(m, "damage_+%_final", { value: 40, kind: "more", tags: ["projectile"], source: src("a", "A") });
    addContribution(m, "damage_+%_final", { value: 25, kind: "more", tags: ["projectile"], source: src("b", "B") });
    // (1 + 0.4) * (1 + 0.25) = 1.75
    expect(productMore(m, "damage_+%_final", ["projectile"])).toBeCloseTo(1.75, 6);
  });

  it("sumFlat sums flat contributions", () => {
    const m = emptyStatMap();
    addContribution(m, "base_fire_damage_min", { value: 5, kind: "flat", tags: [], source: src("a", "A") });
    addContribution(m, "base_fire_damage_min", { value: 3, kind: "flat", tags: [], source: src("b", "B") });
    expect(sumFlat(m, "base_fire_damage_min")).toBe(8);
  });

  it("ignores contributions whose tags do not match required tags", () => {
    const m = emptyStatMap();
    addContribution(m, "damage_+%", { value: 50, kind: "increased", tags: ["spell"], source: src("a", "A") });
    expect(sumInc(m, "damage_+%", ["attack"])).toBe(0);
  });

  it("mergeStatMaps combines contributions", () => {
    const a = emptyStatMap();
    const b = emptyStatMap();
    addContribution(a, "x", { value: 1, kind: "flat", tags: [], source: src("a", "A") });
    addContribution(b, "x", { value: 2, kind: "flat", tags: [], source: src("b", "B") });
    const merged = mergeStatMaps(a, b);
    expect(merged.get("x")?.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm test -- --run src/lib/dps/statMap.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/dps/statMap.ts`**

```ts
import type { StatContribution, StatId, StatMap } from "./types";

export function emptyStatMap(): StatMap {
  return new Map();
}

export function addContribution(map: StatMap, id: StatId, c: StatContribution): void {
  const list = map.get(id);
  if (list) list.push(c);
  else map.set(id, [c]);
}

export function mergeStatMaps(...maps: StatMap[]): StatMap {
  const out = emptyStatMap();
  for (const m of maps) {
    for (const [id, list] of m) {
      for (const c of list) addContribution(out, id, c);
    }
  }
  return out;
}

/** A contribution matches when every required tag is present in its tag list,
 *  OR when it has no tags (global modifier). */
function tagsMatch(contribTags: string[], required: string[]): boolean {
  if (contribTags.length === 0) return true;
  return required.every((t) => contribTags.includes(t));
}

export function sumInc(map: StatMap, id: StatId, required: string[]): number {
  const list = map.get(id);
  if (!list) return 0;
  let sum = 0;
  for (const c of list) {
    if (c.kind !== "increased") continue;
    if (!tagsMatch(c.tags, required)) continue;
    sum += c.value;
  }
  return sum;
}

export function productMore(map: StatMap, id: StatId, required: string[]): number {
  const list = map.get(id);
  if (!list) return 1;
  let prod = 1;
  for (const c of list) {
    if (c.kind !== "more") continue;
    if (!tagsMatch(c.tags, required)) continue;
    prod *= 1 + c.value / 100;
  }
  return prod;
}

export function sumFlat(map: StatMap, id: StatId): number {
  const list = map.get(id);
  if (!list) return 0;
  let sum = 0;
  for (const c of list) if (c.kind === "flat") sum += c.value;
  return sum;
}

/** Return all contributions for a stat id whose tags match. Useful for breakdowns. */
export function listMatching(map: StatMap, id: StatId, required: string[]): StatContribution[] {
  const list = map.get(id);
  if (!list) return [];
  return list.filter((c) => tagsMatch(c.tags, required));
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
npm test -- --run src/lib/dps/statMap.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dps/statMap.ts src/lib/dps/statMap.test.ts
git commit -m "feat(dps): StatMap with flat/inc/more aggregation and tag filtering"
```

---

## Task 6: Snapshot assembly helpers

**Purpose:** Build a `DpsSnapshot` from the current Zustand stores (build plan + roll mode). Keeps store coupling out of the engine.

**Files:**
- Create: `src/lib/dps/snapshot.ts`
- Create: `src/lib/dps/snapshot.test.ts`

- [ ] **Step 1: Read what's available on the build plan**

```bash
# Confirm shape of BuildPhase + GearLayout + SkillGroup
```

Refer to `src/types/buildPlan.ts` (read-only reference). The snapshot helper takes:
- A `BuildPhase` (has `.gear`, `.gems`)
- A `primarySkillId` (string — which `SkillGroup.skill.id` is primary)
- A `rollMode` (string)

- [ ] **Step 2: Write the failing tests**

```ts
// src/lib/dps/snapshot.test.ts
import { describe, it, expect } from "vitest";
import { snapshotFromPhase } from "./snapshot";
import type { BuildPhase } from "../../types/buildPlan";
import { EMPTY_GEAR_LAYOUT } from "../../types/buildPlan";

function makePhase(overrides: Partial<BuildPhase> = {}): BuildPhase {
  return {
    id: "p1",
    name: "Phase 1",
    order: 0,
    trigger: { type: "manual" },
    gear: { ...EMPTY_GEAR_LAYOUT },
    gems: [],
    regexes: [],
    ...overrides,
  };
}

describe("snapshotFromPhase", () => {
  it("produces a snapshot with the phase's gear and skill groups", () => {
    const phase = makePhase({
      gems: [
        {
          id: "g1",
          skill: { id: "s1", name: "Gas Grenade", category: "skill", priority: 0, supports: [] },
          supports: [],
          priority: 0,
        },
      ],
    });
    const snap = snapshotFromPhase(phase, "s1", "actual");
    expect(snap.gear).toBe(phase.gear);
    expect(snap.skillGroups).toBe(phase.gems);
    expect(snap.primarySkillId).toBe("s1");
    expect(snap.rollMode).toBe("actual");
  });

  it("defaults primarySkillId to the first skill group when given empty string", () => {
    const phase = makePhase({
      gems: [
        { id: "g1", skill: { id: "s1", name: "A", category: "skill", priority: 0, supports: [] }, supports: [], priority: 0 },
        { id: "g2", skill: { id: "s2", name: "B", category: "skill", priority: 1, supports: [] }, supports: [], priority: 1 },
      ],
    });
    expect(snapshotFromPhase(phase, "", "actual").primarySkillId).toBe("s1");
  });

  it("swapWeapon produces a new snapshot with the given weapon gear", () => {
    const { snapshotFromPhase, swapWeapon } = require("./snapshot");
    const phase = makePhase();
    const base = snapshotFromPhase(phase, "", "actual");
    const weapon = {
      id: "rolled-1",
      slot: "weapon",
      base: "Expert Crossbow",
      desiredMods: [],
      notes: "",
    };
    const swapped = swapWeapon(base, weapon as any);
    expect(swapped.gear.weapon).toBe(weapon);
    expect(swapped.gear.helmet).toBe(base.gear.helmet);
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

```bash
npm test -- --run src/lib/dps/snapshot.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 4: Implement `src/lib/dps/snapshot.ts`**

```ts
import type { BuildPhase, BuildGearEntry } from "../../types/buildPlan";
import type { DpsSnapshot, RollMode } from "./types";

export function snapshotFromPhase(
  phase: BuildPhase,
  primarySkillId: string,
  rollMode: RollMode,
): DpsSnapshot {
  const resolvedPrimary =
    primarySkillId || phase.gems[0]?.skill.id || "";
  return {
    gear: phase.gear,
    skillGroups: phase.gems,
    primarySkillId: resolvedPrimary,
    rollMode,
  };
}

export function swapWeapon(snapshot: DpsSnapshot, weapon: BuildGearEntry | null): DpsSnapshot {
  return {
    ...snapshot,
    gear: { ...snapshot.gear, weapon },
  };
}
```

- [ ] **Step 5: Run tests, verify they pass**

```bash
npm test -- --run src/lib/dps/snapshot.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/dps/snapshot.ts src/lib/dps/snapshot.test.ts
git commit -m "feat(dps): snapshot assembly from BuildPhase with weapon swap helper"
```

---

## Task 7: Mod stats — gear mods → StatMap

**Purpose:** Given a `GearLayout` and `rollMode`, emit every gear-sourced `StatContribution` into a `StatMap`.

**Files:**
- Create: `src/lib/dps/modStats.ts`
- Create: `src/lib/dps/modStats.test.ts`

- [ ] **Step 1: Understand the mod data**

Refer to `src/types/itemDatabase.ts` — `ItemMod` has `stats: Array<{ id, min, max }>` and generation info. `BuildGearEntry.desiredModIds: string[]` identifies which mods apply; `modRolls: Record<modId, 0..100>` gives the roll percentile. Look up mods via `src/data/mods.ts` (`modById`).

If `modById` is not exported, expose it:

```bash
grep -n "modById" src/data/mods.ts
```

If missing, add to `src/data/mods.ts`:

```ts
export const modById: Map<string, ItemMod> = new Map(allMods.map((m) => [m.id, m]));
```

- [ ] **Step 2: Write the failing tests**

```ts
// src/lib/dps/modStats.test.ts
import { describe, it, expect } from "vitest";
import { collectGearStats, statKindForId } from "./modStats";
import { emptyStatMap, sumInc, sumFlat } from "./statMap";
import type { GearLayout } from "../../types/buildPlan";
import { EMPTY_GEAR_LAYOUT } from "../../types/buildPlan";

describe("statKindForId", () => {
  it("classifies +% suffix as increased", () => {
    expect(statKindForId("physical_damage_+%")).toBe("increased");
    expect(statKindForId("attack_speed_+%")).toBe("increased");
  });
  it("classifies base_*_min / _max as flat", () => {
    expect(statKindForId("base_fire_damage_min")).toBe("flat");
    expect(statKindForId("base_physical_damage_max")).toBe("flat");
  });
  it("classifies *_final or _more as more", () => {
    expect(statKindForId("damage_+%_final")).toBe("more");
  });
});

describe("collectGearStats", () => {
  it("returns an empty map for empty gear", () => {
    const gear: GearLayout = { ...EMPTY_GEAR_LAYOUT };
    const map = collectGearStats(gear, "actual");
    expect(map.size).toBe(0);
  });

  // Integration-style test using a fabricated mod id + roll.
  // This relies on modById; if no matching mod exists, the test is skipped
  // by using a fixture mod injected via a test helper (see test file for pattern).
});
```

- [ ] **Step 3: Run tests, verify they fail**

```bash
npm test -- --run src/lib/dps/modStats.test.ts
```

- [ ] **Step 4: Implement `src/lib/dps/modStats.ts`**

```ts
import type { GearLayout, BuildGearEntry, GearSlotKey } from "../../types/buildPlan";
import { GEAR_SLOT_LABELS } from "../../types/buildPlan";
import { modById } from "../../data/mods";
import type { ContributionKind, RollMode, StatContribution, StatMap } from "./types";
import { addContribution, emptyStatMap } from "./statMap";

/**
 * Infer contribution kind from PoE2/PoB stat id naming conventions.
 * - "*_+%_final" / ends with "_more" → more
 * - ends with "_+%" (without _final) → increased
 * - otherwise → flat
 */
export function statKindForId(id: string): ContributionKind {
  if (id.endsWith("_final") || id.endsWith("_more")) return "more";
  if (/_\+%$/.test(id)) return "increased";
  return "flat";
}

/** Resolve a stat's rolled value given percentile 0..100. */
function resolveStatValue(min: number, max: number, percentile: number): number {
  const p = Math.max(0, Math.min(100, percentile));
  return min + ((max - min) * p) / 100;
}

function slotKeys(gear: GearLayout): GearSlotKey[] {
  return Object.keys(gear) as GearSlotKey[];
}

export function collectGearStats(gear: GearLayout, rollMode: RollMode): StatMap {
  const map = emptyStatMap();
  for (const key of slotKeys(gear)) {
    const entry = gear[key];
    if (!entry) continue;
    addEntryStats(map, key, entry, rollMode);
  }
  return map;
}

function addEntryStats(
  map: StatMap,
  slotKey: GearSlotKey,
  entry: BuildGearEntry,
  rollMode: RollMode,
): void {
  const ids = entry.desiredModIds ?? [];
  for (const modId of ids) {
    const mod = modById.get(modId);
    if (!mod) continue;
    const percentile =
      rollMode === "max" ? 100 : entry.modRolls?.[modId] ?? 0;
    for (const stat of mod.stats) {
      const value = resolveStatValue(stat.min, stat.max, percentile);
      if (value === 0) continue;
      const contribution: StatContribution = {
        value,
        kind: statKindForId(stat.id),
        tags: mod.tags ?? [],
        source: {
          type: "gear",
          id: `${slotKey}:${modId}`,
          label: `${GEAR_SLOT_LABELS[slotKey]}: ${mod.name || mod.text || modId}`,
        },
      };
      addContribution(map, stat.id, contribution);
    }
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- --run src/lib/dps/modStats.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dps/modStats.ts src/lib/dps/modStats.test.ts src/data/mods.ts
git commit -m "feat(dps): collect gear mod stats into StatMap with roll-mode resolution"
```

---

## Task 8: Skill stats — skill gem innate → StatMap

**Purpose:** Given the active skill gem + level, emit its innate `stats` as flat/inc/more contributions.

**Files:**
- Create: `src/lib/dps/skillStats.ts`
- Create: `src/lib/dps/skillStats.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/dps/skillStats.test.ts
import { describe, it, expect } from "vitest";
import { collectSkillStats, getSkillTags } from "./skillStats";
import { sumFlat, sumInc } from "./statMap";
import type { GemEntry } from "../../types/itemDatabase";

function makeSkillGem(stats: Record<string, number>, flags: Record<string, boolean> = { attack: true }): GemEntry {
  return {
    id: "test-skill",
    name: "Test Skill",
    gemType: "active",
    color: "g",
    craftingLevel: 1,
    craftingTypes: ["Crossbow"],
    tags: ["attack", "projectile"],
    recommendedSupports: [],
    requirementWeights: { strength: 0, dexterity: 100, intelligence: 0 },
    iconPath: "",
    skillDetail: {
      maxLevel: 20,
      levels: {
        "1": { costs: {}, statText: [], stats },
      },
      staticStatText: [],
      qualityStats: [],
      baseFlags: flags,
      activeSkillTypes: ["Attack", "Projectile"],
    },
  };
}

describe("collectSkillStats", () => {
  it("emits flat base damage stats as flat contributions", () => {
    const gem = makeSkillGem({ base_fire_damage_min: 15, base_fire_damage_max: 22 });
    const map = collectSkillStats(gem, 1);
    expect(sumFlat(map, "base_fire_damage_min")).toBe(15);
    expect(sumFlat(map, "base_fire_damage_max")).toBe(22);
  });

  it("emits +% stats as increased contributions", () => {
    const gem = makeSkillGem({ physical_damage_+%: 30 } as any);
    const map = collectSkillStats(gem, 1);
    expect(sumInc(map, "physical_damage_+%", [])).toBe(30);
  });
});

describe("getSkillTags", () => {
  it("derives tags from activeSkillTypes lowercased", () => {
    const gem = makeSkillGem({}, { attack: true });
    expect(getSkillTags(gem)).toContain("attack");
    expect(getSkillTags(gem)).toContain("projectile");
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

```bash
npm test -- --run src/lib/dps/skillStats.test.ts
```

- [ ] **Step 3: Implement `src/lib/dps/skillStats.ts`**

```ts
import type { GemEntry } from "../../types/itemDatabase";
import type { StatMap } from "./types";
import { addContribution, emptyStatMap } from "./statMap";
import { statKindForId } from "./modStats";

export function getSkillTags(gem: GemEntry): string[] {
  const types = gem.skillDetail?.activeSkillTypes ?? [];
  return types.map((t) => t.toLowerCase());
}

export function collectSkillStats(gem: GemEntry, level: number): StatMap {
  const map = emptyStatMap();
  const detail = gem.skillDetail;
  if (!detail) return map;
  const lvl = detail.levels[String(level)] ?? detail.levels[String(detail.maxLevel)];
  if (!lvl) return map;
  const tags = getSkillTags(gem);
  for (const [statId, value] of Object.entries(lvl.stats ?? {})) {
    if (value === 0) continue;
    addContribution(map, statId, {
      value,
      kind: statKindForId(statId),
      tags,
      source: { type: "skill", id: gem.id, label: gem.name },
    });
  }
  return map;
}

export function getSkillLevel(gem: GemEntry, requestedLevel: number): number {
  const max = gem.skillDetail?.maxLevel ?? 1;
  return Math.max(1, Math.min(max, requestedLevel));
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --run src/lib/dps/skillStats.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/dps/skillStats.ts src/lib/dps/skillStats.test.ts
git commit -m "feat(dps): collect skill gem innate stats into StatMap"
```

---

## Task 9: Support stats — linked supports → StatMap

**Purpose:** For each linked support gem, check tag compatibility with the supported skill, then emit the support's structured stats into the StatMap tagged with the skill's tags (so skill-scoped multipliers apply only when calcing this skill).

**Files:**
- Create: `src/lib/dps/supportStats.ts`
- Create: `src/lib/dps/supportStats.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/dps/supportStats.test.ts
import { describe, it, expect } from "vitest";
import { supportApplies, collectSupportStats } from "./supportStats";
import { sumInc, productMore } from "./statMap";
import type { GemEntry } from "../../types/itemDatabase";

function makeSkill(types: string[]): GemEntry {
  return {
    id: "skill",
    name: "Skill",
    gemType: "active",
    color: "g", craftingLevel: 1, craftingTypes: [], tags: [],
    recommendedSupports: [], requirementWeights: { strength: 0, dexterity: 0, intelligence: 0 },
    iconPath: "",
    skillDetail: { maxLevel: 1, levels: { "1": { costs: {}, statText: [], stats: {} } }, staticStatText: [], qualityStats: [], activeSkillTypes: types },
  };
}

function makeSupport(stats: Record<string, number>, allowed?: string[], excluded?: string[]): GemEntry {
  return {
    id: "support",
    name: "Support",
    gemType: "support",
    color: "g", craftingLevel: 1, craftingTypes: [], tags: [],
    recommendedSupports: [], requirementWeights: { strength: 0, dexterity: 0, intelligence: 0 },
    iconPath: "",
    allowedActiveSkillTypes: allowed,
    excludedActiveSkillTypes: excluded,
    skillDetail: { maxLevel: 1, levels: { "1": { costs: {}, statText: [], stats } }, staticStatText: [], qualityStats: [] },
  };
}

describe("supportApplies", () => {
  it("applies when skill has all required active types", () => {
    const skill = makeSkill(["Attack", "Projectile"]);
    const sup = makeSupport({}, ["Projectile"]);
    expect(supportApplies(sup, skill)).toBe(true);
  });
  it("does not apply when skill lacks required type", () => {
    const skill = makeSkill(["Spell"]);
    const sup = makeSupport({}, ["Projectile"]);
    expect(supportApplies(sup, skill)).toBe(false);
  });
  it("does not apply when skill matches an excluded type", () => {
    const skill = makeSkill(["Attack", "Channelled"]);
    const sup = makeSupport({}, ["Attack"], ["Channelled"]);
    expect(supportApplies(sup, skill)).toBe(false);
  });
});

describe("collectSupportStats", () => {
  it("adds inc contributions tagged with the skill's tags", () => {
    const skill = makeSkill(["Attack", "Projectile"]);
    const sup = makeSupport({ "projectile_damage_+%": 40 });
    const map = collectSupportStats([sup], skill);
    expect(sumInc(map, "projectile_damage_+%", ["attack", "projectile"])).toBe(40);
  });
  it("skips non-applying supports", () => {
    const skill = makeSkill(["Spell"]);
    const sup = makeSupport({ "projectile_damage_+%": 40 }, ["Projectile"]);
    const map = collectSupportStats([sup], skill);
    expect(sumInc(map, "projectile_damage_+%", ["spell"])).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

```bash
npm test -- --run src/lib/dps/supportStats.test.ts
```

- [ ] **Step 3: Implement `src/lib/dps/supportStats.ts`**

```ts
import type { GemEntry } from "../../types/itemDatabase";
import type { StatMap } from "./types";
import { addContribution, emptyStatMap } from "./statMap";
import { statKindForId } from "./modStats";
import { getSkillTags } from "./skillStats";

export function supportApplies(support: GemEntry, skill: GemEntry): boolean {
  const skillTypes = new Set(skill.skillDetail?.activeSkillTypes ?? []);
  const allowed = support.allowedActiveSkillTypes ?? [];
  const excluded = support.excludedActiveSkillTypes ?? [];
  if (allowed.length > 0 && !allowed.some((t) => skillTypes.has(t))) return false;
  if (excluded.some((t) => skillTypes.has(t))) return false;
  return true;
}

export function collectSupportStats(
  supports: GemEntry[],
  skill: GemEntry,
  level = 1,
): StatMap {
  const map = emptyStatMap();
  const skillTags = getSkillTags(skill);
  for (const sup of supports) {
    if (!supportApplies(sup, skill)) continue;
    const detail = sup.skillDetail;
    if (!detail) continue;
    const lvl = detail.levels[String(level)] ?? detail.levels[String(detail.maxLevel)];
    if (!lvl) continue;
    for (const [statId, value] of Object.entries(lvl.stats ?? {})) {
      if (value === 0) continue;
      addContribution(map, statId, {
        value,
        kind: statKindForId(statId),
        tags: skillTags,
        source: { type: "support", id: sup.id, label: sup.name },
      });
    }
  }
  return map;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --run src/lib/dps/supportStats.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/dps/supportStats.ts src/lib/dps/supportStats.test.ts
git commit -m "feat(dps): support-gem stat aggregation with tag-filter compatibility"
```

---

## Task 10: Pipeline stages — base, conversions, multipliers, rate, crit, compose

**Files:**
- Create: `src/lib/dps/pipeline.ts`
- Create: `src/lib/dps/pipeline.test.ts`

- [ ] **Step 1: Write the failing tests (unit, not yet end-to-end)**

```ts
// src/lib/dps/pipeline.test.ts
import { describe, it, expect } from "vitest";
import {
  calcBaseDamage,
  applyConversions,
  applyMultipliers,
  calcRate,
  calcCrit,
  zeroDamageByType,
} from "./pipeline";
import { emptyStatMap, addContribution } from "./statMap";
import type { BuildGearEntry } from "../../types/buildPlan";
import type { DamageType } from "./types";

function flat(id: string, value: number) {
  return { value, kind: "flat" as const, tags: [], source: { type: "gear" as const, id: "x", label: "X" } };
}

describe("zeroDamageByType", () => {
  it("initialises all types to 0/0", () => {
    const z = zeroDamageByType();
    (["physical","fire","cold","lightning","chaos"] as DamageType[]).forEach((t) => {
      expect(z[t]).toEqual({ min: 0, max: 0 });
    });
  });
});

describe("calcBaseDamage — attack skill with weapon", () => {
  it("combines weapon damage × effectiveness + skill flat + gear flat", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "base_physical_damage_min", flat("a", 5));
    addContribution(statMap, "base_physical_damage_max", flat("a", 10));
    const weapon = { physicalDamageMin: 20, physicalDamageMax: 40 };
    const base = calcBaseDamage({
      isAttack: true,
      damageEffectiveness: 150,
      weapon,
      skillFlat: { physical: { min: 0, max: 0 }, fire: { min: 0, max: 0 }, cold: { min: 0, max: 0 }, lightning: { min: 0, max: 0 }, chaos: { min: 0, max: 0 } },
      statMap,
    });
    // (20 + 5) * 1.5 = 37.5, (40 + 10) * 1.5 = 75
    expect(base.physical.min).toBeCloseTo(37.5, 3);
    expect(base.physical.max).toBeCloseTo(75, 3);
  });
});

describe("applyMultipliers", () => {
  it("applies (1 + sum inc) × product(more) per type", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "physical_damage_+%", { value: 50, kind: "increased", tags: [], source: { type: "gear", id: "x", label: "X" } });
    addContribution(statMap, "damage_+%_final", { value: 40, kind: "more", tags: [], source: { type: "support", id: "y", label: "Y" } });
    const base = { physical: { min: 10, max: 20 }, fire: { min: 0, max: 0 }, cold: { min: 0, max: 0 }, lightning: { min: 0, max: 0 }, chaos: { min: 0, max: 0 } };
    const out = applyMultipliers(base, statMap, []);
    // 10 * (1 + 0.5) * 1.4 = 21, 20 * 1.5 * 1.4 = 42
    expect(out.physical.min).toBeCloseTo(21, 3);
    expect(out.physical.max).toBeCloseTo(42, 3);
  });
});

describe("calcRate — attack", () => {
  it("combines weapon attack time with inc attack speed and skill multiplier", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "attack_speed_+%", { value: 20, kind: "increased", tags: [], source: { type: "gear", id: "x", label: "X" } });
    const rate = calcRate({
      isAttack: true,
      weaponAttackTime: 800, // ms → 1.25 aps base
      skillAttackSpeedMultiplier: 0, // no mod
      castTime: undefined,
      skillAttackTime: undefined,
      statMap,
      skillTags: ["attack"],
    });
    // 1.25 * 1.20 = 1.50
    expect(rate).toBeCloseTo(1.5, 3);
  });
});

describe("calcCrit", () => {
  it("expected multi = 1 + chance*(multi - 1)", () => {
    const statMap = emptyStatMap();
    const out = calcCrit({ baseCritChance: 0.05, baseCritMulti: 1.5, statMap, tags: [] });
    // 1 + 0.05 * (1.5 - 1) = 1.025
    expect(out.expectedMulti).toBeCloseTo(1.025, 4);
  });
});

describe("applyConversions", () => {
  it("converts a percentage of physical into fire", () => {
    const statMap = emptyStatMap();
    addContribution(statMap, "skill_physical_damage_%_to_convert_to_fire", {
      value: 50, kind: "flat", tags: [], source: { type: "skill", id: "s", label: "S" },
    });
    const base = { physical: { min: 100, max: 100 }, fire: { min: 0, max: 0 }, cold: { min: 0, max: 0 }, lightning: { min: 0, max: 0 }, chaos: { min: 0, max: 0 } };
    const out = applyConversions(base, statMap);
    expect(out.physical.min).toBeCloseTo(50, 3);
    expect(out.fire.min).toBeCloseTo(50, 3);
  });
});
```

- [ ] **Step 2: Run tests, verify fail**

```bash
npm test -- --run src/lib/dps/pipeline.test.ts
```

- [ ] **Step 3: Implement `src/lib/dps/pipeline.ts`**

```ts
import type {
  CritInfo,
  DamageByType,
  DamageRange,
  DamageType,
  StatMap,
} from "./types";
import { DAMAGE_TYPES } from "./types";
import { productMore, sumFlat, sumInc } from "./statMap";

export function zeroDamageByType(): DamageByType {
  const o = {} as DamageByType;
  for (const t of DAMAGE_TYPES) o[t] = { min: 0, max: 0 };
  return o;
}

export interface CalcBaseInput {
  isAttack: boolean;
  damageEffectiveness: number; // percent, e.g. 150
  weapon: { physicalDamageMin?: number; physicalDamageMax?: number } | null;
  skillFlat: DamageByType;
  statMap: StatMap;
}

export function calcBaseDamage(input: CalcBaseInput): DamageByType {
  const out = zeroDamageByType();
  const eff = input.damageEffectiveness / 100;

  // Physical: weapon + skill flat + gear flat, all × effectiveness (for attacks)
  const weaponPhysMin = input.weapon?.physicalDamageMin ?? 0;
  const weaponPhysMax = input.weapon?.physicalDamageMax ?? 0;
  const gearPhysMin = sumFlat(input.statMap, "base_physical_damage_min");
  const gearPhysMax = sumFlat(input.statMap, "base_physical_damage_max");
  out.physical.min = (weaponPhysMin + input.skillFlat.physical.min + gearPhysMin) * (input.isAttack ? eff : 1);
  out.physical.max = (weaponPhysMax + input.skillFlat.physical.max + gearPhysMax) * (input.isAttack ? eff : 1);

  // Elemental + chaos: skill flat + gear flat × effectiveness
  for (const t of ["fire", "cold", "lightning", "chaos"] as DamageType[]) {
    const gearMin = sumFlat(input.statMap, `base_${t}_damage_min`);
    const gearMax = sumFlat(input.statMap, `base_${t}_damage_max`);
    const skillMin = input.skillFlat[t].min;
    const skillMax = input.skillFlat[t].max;
    const mult = input.isAttack ? eff : 1;
    out[t].min = (skillMin + gearMin) * mult;
    out[t].max = (skillMax + gearMax) * mult;
  }

  // For non-attacks, skills often embed their own base damage in skill stats directly.
  // That path is covered when stats include base_<type>_damage_min/max on the skill gem
  // (they land in the StatMap as flat, so gearPhys + skillFlat.physical already counts them).

  return out;
}

/** Apply skill/gear/skill conversion percentages phys→fire etc.
 *  Only phys→ele and phys→chaos handled in Phase 1 (most common PoE2 case).
 *  Stat ids referenced (adjust based on Task 1 findings if names differ): */
const CONVERSION_STAT_IDS: Array<{ from: DamageType; to: DamageType; id: string }> = [
  { from: "physical", to: "fire", id: "skill_physical_damage_%_to_convert_to_fire" },
  { from: "physical", to: "cold", id: "skill_physical_damage_%_to_convert_to_cold" },
  { from: "physical", to: "lightning", id: "skill_physical_damage_%_to_convert_to_lightning" },
  { from: "physical", to: "chaos", id: "skill_physical_damage_%_to_convert_to_chaos" },
];

export function applyConversions(base: DamageByType, map: StatMap): DamageByType {
  const out: DamageByType = JSON.parse(JSON.stringify(base));
  for (const { from, to, id } of CONVERSION_STAT_IDS) {
    const pct = sumFlat(map, id);
    if (pct <= 0) continue;
    const capped = Math.min(100, pct);
    const frac = capped / 100;
    const moved: DamageRange = { min: out[from].min * frac, max: out[from].max * frac };
    out[from].min -= moved.min;
    out[from].max -= moved.max;
    out[to].min += moved.min;
    out[to].max += moved.max;
  }
  return out;
}

/** Apply increased × more per damage type. Global "damage_+%" stats apply to all types. */
export function applyMultipliers(
  base: DamageByType,
  map: StatMap,
  skillTags: string[],
): DamageByType {
  const out = zeroDamageByType();
  const globalInc = sumInc(map, "damage_+%", skillTags);
  const globalMore = productMore(map, "damage_+%_final", skillTags);

  for (const t of DAMAGE_TYPES) {
    const typeInc = sumInc(map, `${t}_damage_+%`, skillTags);
    const typeMore = productMore(map, `${t}_damage_+%_final`, skillTags);
    const totalInc = 1 + (globalInc + typeInc) / 100;
    const totalMore = globalMore * typeMore;
    out[t].min = base[t].min * totalInc * totalMore;
    out[t].max = base[t].max * totalInc * totalMore;
  }
  return out;
}

export interface CalcRateInput {
  isAttack: boolean;
  weaponAttackTime?: number;       // ms, attacks
  skillAttackTime?: number;        // ms, attacks without weapon timing (rare)
  castTime?: number;               // ms, spells
  skillAttackSpeedMultiplier: number; // e.g. -25 → 75% of base
  statMap: StatMap;
  skillTags: string[];
}

export function calcRate(input: CalcRateInput): number {
  const baseTimeMs = input.isAttack
    ? input.weaponAttackTime ?? input.skillAttackTime ?? 1000
    : input.castTime ?? 1000;
  const baseRate = 1000 / baseTimeMs;
  const skillRateMult = 1 + (input.skillAttackSpeedMultiplier || 0) / 100;
  const incSpeed = input.isAttack
    ? sumInc(input.statMap, "attack_speed_+%", input.skillTags)
    : sumInc(input.statMap, "cast_speed_+%", input.skillTags);
  const moreSpeed = input.isAttack
    ? productMore(input.statMap, "attack_speed_+%_final", input.skillTags)
    : productMore(input.statMap, "cast_speed_+%_final", input.skillTags);
  return baseRate * skillRateMult * (1 + incSpeed / 100) * moreSpeed;
}

export interface CalcCritInput {
  baseCritChance: number;   // 0..1
  baseCritMulti: number;    // e.g. 1.5 for +50% crit multi (base)
  statMap: StatMap;
  tags: string[];
}

export function calcCrit(input: CalcCritInput): CritInfo {
  const incChance = sumInc(input.statMap, "critical_strike_chance_+%", input.tags);
  const chance = Math.max(0, Math.min(1, input.baseCritChance * (1 + incChance / 100)));
  const incMulti = sumFlat(input.statMap, "critical_strike_multiplier_+") / 100;
  const multi = input.baseCritMulti + incMulti;
  const expectedMulti = 1 + chance * (multi - 1);
  return { chance, multi, expectedMulti };
}

export function sumPerHit(byType: DamageByType): DamageRange {
  let min = 0, max = 0;
  for (const t of DAMAGE_TYPES) { min += byType[t].min; max += byType[t].max; }
  return { min, max };
}

export function avg(range: DamageRange): number {
  return (range.min + range.max) / 2;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --run src/lib/dps/pipeline.test.ts
```

Expected: PASS. If conversion stat id differs from what Task 1 findings showed, adjust `CONVERSION_STAT_IDS` and the corresponding test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dps/pipeline.ts src/lib/dps/pipeline.test.ts
git commit -m "feat(dps): pipeline stages — base, conversions, multipliers, rate, crit"
```

---

## Task 11: Public API `calcDps` + first golden-number fixture

**Purpose:** Tie all stages together. Ship the first end-to-end golden-number test exercising a bare crossbow + Galvanic Shards snapshot.

**Files:**
- Modify: `src/lib/dps/index.ts` (replace stub `calcDps`)
- Create: `src/lib/dps/breakdown.ts`
- Create: `src/lib/dps/__fixtures__/bareCrossbowGalvanic.ts`
- Create: `src/lib/dps/calcDps.test.ts`

- [ ] **Step 1: Implement `src/lib/dps/breakdown.ts`**

```ts
import type { BreakdownStage, CalcBreakdown, ModifierSource, SourceSummary } from "./types";

export function makeBreakdown(stages: BreakdownStage[], sources: ModifierSource[]): CalcBreakdown {
  return { stages, sources: summariseSources(sources) };
}

function summariseSources(sources: ModifierSource[]): SourceSummary[] {
  const counts = new Map<string, number>();
  for (const s of sources) counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
  return Array.from(counts.entries()).map(([type, count]) => ({ type: type as any, count }));
}
```

- [ ] **Step 2: Replace stub `calcDps` in `src/lib/dps/index.ts`**

```ts
import type { DpsSnapshot, SkillDps, DamageByType, BreakdownStage, ModifierSource } from "./types";
import { DAMAGE_TYPES } from "./types";
import { gemById } from "../../data/gems";
import { baseItemById } from "../../data/items";
import {
  applyConversions,
  applyMultipliers,
  avg,
  calcBaseDamage,
  calcCrit,
  calcRate,
  sumPerHit,
  zeroDamageByType,
} from "./pipeline";
import { collectGearStats } from "./modStats";
import { collectSkillStats, getSkillLevel, getSkillTags } from "./skillStats";
import { collectSupportStats } from "./supportStats";
import { mergeStatMaps } from "./statMap";
import { makeBreakdown } from "./breakdown";

export * from "./types";
export { snapshotFromPhase, swapWeapon } from "./snapshot";

export function calcDps(snapshot: DpsSnapshot): SkillDps[] {
  const gearStats = collectGearStats(snapshot.gear, snapshot.rollMode);
  const results: SkillDps[] = [];

  for (const group of snapshot.skillGroups) {
    const skillGemId = group.skill.gemId;
    if (!skillGemId) continue;
    const skillGem = gemById.get(skillGemId);
    if (!skillGem || skillGem.gemType !== "active") continue;

    const level = getSkillLevel(skillGem, (group.skill.craftingLevel ?? skillGem.skillDetail?.maxLevel ?? 1));
    const skillStats = collectSkillStats(skillGem, level);

    const supportGems = group.supports
      .filter((s): s is NonNullable<typeof s> => !!s && !!s.gemId)
      .map((s) => gemById.get(s.gemId!))
      .filter((g): g is NonNullable<typeof g> => !!g);
    const supportStats = collectSupportStats(supportGems, skillGem, level);

    const statMap = mergeStatMaps(gearStats, skillStats, supportStats);
    const skillTags = getSkillTags(skillGem);
    const isAttack = !!skillGem.skillDetail?.baseFlags?.attack;

    const weaponEntry = snapshot.gear.weapon;
    const weaponBase = weaponEntry?.baseItemId ? baseItemById.get(weaponEntry.baseItemId) : undefined;
    const weaponProps = weaponBase?.properties;
    const skillLevelData = skillGem.skillDetail?.levels[String(level)];
    const damageEffectiveness = (skillLevelData?.stats?.["damage_effectiveness_+%"] ?? 0) + 100;

    // Skill flat base damage is already in skillStats (as base_*_damage_min/max).
    // calcBaseDamage also pulls those via statMap; pass a zero skillFlat to avoid double-count.
    const baseDamage = calcBaseDamage({
      isAttack,
      damageEffectiveness,
      weapon: weaponProps ?? null,
      skillFlat: zeroDamageByType(),
      statMap,
    });

    const converted = applyConversions(baseDamage, statMap);
    const final = applyMultipliers(converted, statMap, skillTags);
    const perHit = sumPerHit(final);

    const rate = calcRate({
      isAttack,
      weaponAttackTime: weaponProps?.attackTime,
      skillAttackTime: skillLevelData?.attackTime,
      castTime: skillGem.skillDetail?.castTime,
      skillAttackSpeedMultiplier: skillGem.skillDetail?.attackSpeedMultiplier ?? 0,
      statMap,
      skillTags,
    });

    const crit = calcCrit({
      baseCritChance: (weaponProps?.criticalStrikeChance ?? 5) / 100,
      baseCritMulti: 1.5,
      statMap,
      tags: skillTags,
    });

    const avgPerHit = avg(perHit);
    const dps = avgPerHit * rate * crit.expectedMulti;

    const stages: BreakdownStage[] = [
      { kind: "base", label: "Base per hit", value: `${perHit.min.toFixed(0)} – ${perHit.max.toFixed(0)}` },
      { kind: "rate", label: `Rate ${rate.toFixed(2)}/s`, value: rate },
      { kind: "crit", label: `Crit ${(crit.chance * 100).toFixed(1)}% × ${crit.multi.toFixed(2)}`, value: crit.expectedMulti },
      { kind: "total", label: "Total DPS", value: Math.round(dps) },
    ];
    const allSources: ModifierSource[] = [];
    for (const list of statMap.values()) for (const c of list) allSources.push(c.source);

    results.push({
      skillId: group.skill.id,
      skillName: skillGem.name,
      level,
      dps,
      perHit,
      rate,
      crit,
      damageByType: final,
      breakdown: makeBreakdown(stages, allSources),
    });
  }
  return results;
}
```

If `baseItemById` isn't exported from `src/data/items.ts`, add it:

```ts
// src/data/items.ts (additive)
export const baseItemById: Map<string, BaseItem> = new Map(allItems.map((i) => [i.id, i]));
```

- [ ] **Step 3: Create fixture `src/lib/dps/__fixtures__/bareCrossbowGalvanic.ts`**

```ts
import type { BuildPhase } from "../../../types/buildPlan";
import { EMPTY_GEAR_LAYOUT } from "../../../types/buildPlan";

/**
 * Bare crossbow + Galvanic Shards, no supports, no other gear.
 * Replace baseItemId / gemId strings with actual ids from the JSON
 * (see `src/data/raw/base_items.json` and `skill_gems.json`).
 *
 * When populating, prefer a plain magic-tier crossbow with fixed phys damage
 * and known attack time to make the expected DPS hand-calculable.
 */
export const bareCrossbowGalvanic: BuildPhase = {
  id: "fixture-bare-crossbow-galvanic",
  name: "Bare Crossbow Galvanic",
  order: 0,
  trigger: { type: "manual" },
  regexes: [],
  gear: {
    ...EMPTY_GEAR_LAYOUT,
    weapon: {
      id: "fx-weapon",
      slot: "weapon",
      baseItemId: "<FILL_FROM_DATA>", // e.g. "Metadata/Items/Weapons/.../FlatCrossbow"
      base: "Flat Crossbow",
      desiredModIds: [],
      desiredMods: [],
      notes: "",
      modRolls: {},
    },
  },
  gems: [
    {
      id: "fx-group-1",
      skill: {
        id: "fx-skill-1",
        gemId: "<FILL_FROM_DATA>", // Galvanic Shards gem id
        name: "Galvanic Shards",
        category: "skill",
        priority: 0,
        supports: [],
        craftingLevel: 1,
      },
      supports: [],
      priority: 0,
    },
  ],
};
```

Populate the two `<FILL_FROM_DATA>` ids by inspecting the JSON:

```bash
node -e "const i=require('./src/data/raw/base_items.json').find(x=>x.itemClass==='Crossbow');console.log(i.id, i.name, i.properties);"
node -e "const g=require('./src/data/raw/skill_gems.json').find(x=>x.name==='Galvanic Shards');console.log(g.id);"
```

- [ ] **Step 4: Hand-calculate the expected DPS**

Using the populated weapon's `physicalDamageMin/Max`, `attackTime`, and Galvanic Shards' level-1 `damage_effectiveness_+%` and any level-1 added damage from `stats`:

```
basePhysMin = (weaponPhysMin) * effectiveness
basePhysMax = (weaponPhysMax) * effectiveness
avgPerHit   = (basePhysMin + basePhysMax) / 2
rate        = 1000 / weaponAttackTime
crit_exp    = 1 + 0.05 * 0.5  // assuming 5% / 1.5x base
dps         = avgPerHit * rate * crit_exp
```

Compute and record the expected number with ±1 tolerance for floating arithmetic.

- [ ] **Step 5: Write the golden-number test `src/lib/dps/calcDps.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { calcDps, snapshotFromPhase } from "./index";
import { bareCrossbowGalvanic } from "./__fixtures__/bareCrossbowGalvanic";

describe("calcDps — end-to-end", () => {
  it("computes Galvanic Shards DPS for bare crossbow", () => {
    const snap = snapshotFromPhase(bareCrossbowGalvanic, "", "actual");
    const results = calcDps(snap);
    expect(results).toHaveLength(1);
    const gs = results[0];
    expect(gs.skillName).toBe("Galvanic Shards");
    // Replace 0 with the hand-calculated expected value
    const EXPECTED = 0;
    expect(gs.dps).toBeCloseTo(EXPECTED, 0);
  });
});
```

- [ ] **Step 6: Iterate until the number matches**

Run:

```bash
npm test -- --run src/lib/dps/calcDps.test.ts
```

If the number is off, inspect the breakdown:

```ts
console.log(JSON.stringify(gs.breakdown, null, 2));
```

Adjust either the engine (for genuine bugs) or the expected value (if the hand-calc was wrong).

- [ ] **Step 7: Commit**

```bash
git add src/lib/dps/index.ts src/lib/dps/breakdown.ts src/lib/dps/__fixtures__ src/lib/dps/calcDps.test.ts src/data/items.ts
git commit -m "feat(dps): public calcDps API + bare-crossbow golden fixture"
```

---

## Task 12: Additional golden-number fixtures

**Files:**
- Create: `src/lib/dps/__fixtures__/bareCrossbowGasGrenade.ts`
- Create: `src/lib/dps/__fixtures__/crossbowFlatPhysRingGalvanic.ts`
- Create: `src/lib/dps/__fixtures__/crossbowTwoSupportsGasGrenade.ts`
- Create: `src/lib/dps/__fixtures__/fullMercenaryBuild.ts`
- Extend: `src/lib/dps/calcDps.test.ts` with test cases

- [ ] **Step 1: Fixture — bare crossbow + Gas Grenade (no weapon scaling)**

Same shape as Task 11's fixture but with `gemId` pointing to Gas Grenade. Expected DPS derives purely from the grenade's skill `stats` (`base_fire_damage_min/max` etc.), weapon contribution zero.

- [ ] **Step 2: Fixture — crossbow + flat-phys ring + Galvanic Shards**

Copy the bare crossbow fixture; add a ring entry with `desiredModIds: ["<phys-to-attacks-mod-id>"]` and `modRolls: { "<id>": 100 }`. Pick a real mod:

```bash
node -e "const m=require('./src/data/raw/item_mods.json').filter(x=>x.stats?.some(s=>s.id==='attack_minimum_added_physical_damage')).slice(0,3);console.log(m.map(x=>x.id))"
```

Hand-calc expected DPS including the ring's flat added phys.

- [ ] **Step 3: Fixture — crossbow + two supports + Gas Grenade**

Add two supports to the skill group (e.g. Martial Tempo, Scattershot equivalents — inspect `skill_gems.json` for actual support ids). Verify `applies` logic and that `more` multipliers stack correctly.

- [ ] **Step 4: Fixture — full Mercenary build (integration)**

Assemble a realistic mid-campaign Mercenary loadout: crossbow with 2 mods, ring with flat phys, gloves with attack speed, boots, helmet, body armour, belt, amulet. Primary skill: Gas Grenade. One secondary skill. Hand-calc expected DPS.

- [ ] **Step 5: Extend `calcDps.test.ts` with one `it` per fixture**

Each follows the Task 11 pattern: compute `snapshotFromPhase`, call `calcDps`, assert `.dps` within tolerance.

- [ ] **Step 6: Run the full DPS suite**

```bash
npm test -- --run src/lib/dps
```

Expected: all pass. Any failures surface real engine bugs; fix before proceeding.

- [ ] **Step 7: Commit**

```bash
git add src/lib/dps/__fixtures__ src/lib/dps/calcDps.test.ts
git commit -m "test(dps): four additional golden-number fixtures for engine coverage"
```

---

## Task 13: `useDps` hook

**Files:**
- Create: `src/hooks/useDps.ts`
- Create: `src/hooks/useDps.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/hooks/useDps.test.tsx
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDps } from "./useDps";
import { bareCrossbowGalvanic } from "../lib/dps/__fixtures__/bareCrossbowGalvanic";
import { snapshotFromPhase } from "../lib/dps";

describe("useDps", () => {
  it("returns SkillDps results for a snapshot", () => {
    const snap = snapshotFromPhase(bareCrossbowGalvanic, "", "actual");
    const { result } = renderHook(() => useDps(snap));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].skillName).toBe("Galvanic Shards");
  });

  it("memoises on snapshot identity", () => {
    const snap = snapshotFromPhase(bareCrossbowGalvanic, "", "actual");
    const { result, rerender } = renderHook(({ s }) => useDps(s), { initialProps: { s: snap } });
    const first = result.current;
    rerender({ s: snap });
    expect(result.current).toBe(first);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

```bash
npm test -- --run src/hooks/useDps.test.tsx
```

- [ ] **Step 3: Implement `src/hooks/useDps.ts`**

```ts
import { useMemo } from "react";
import { calcDps } from "../lib/dps";
import type { DpsSnapshot, SkillDps } from "../lib/dps";

export function useDps(snapshot: DpsSnapshot): SkillDps[] {
  return useMemo(() => calcDps(snapshot), [snapshot]);
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- --run src/hooks/useDps.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDps.ts src/hooks/useDps.test.tsx
git commit -m "feat(dps): useDps hook memoised on snapshot identity"
```

---

## Task 14: `DpsValue` + `DpsBreakdown` components

**Files:**
- Create: `src/components/Dps/DpsValue.tsx`
- Create: `src/components/Dps/DpsValue.module.css`
- Create: `src/components/Dps/DpsBreakdown.tsx`
- Create: `src/components/Dps/DpsBreakdown.module.css`

- [ ] **Step 1: `DpsValue.tsx`**

```tsx
import styles from "./DpsValue.module.css";

export function formatDps(dps: number): string {
  if (dps >= 1_000_000) return `${(dps / 1_000_000).toFixed(2)}M`;
  if (dps >= 10_000) return Math.round(dps).toLocaleString();
  if (dps >= 1) return dps.toFixed(0);
  return "0";
}

export function DpsValue({ dps, suffix = "DPS" }: { dps: number; suffix?: string }) {
  return (
    <span className={styles.value}>
      <span className={styles.number}>{formatDps(dps)}</span>
      {suffix && <span className={styles.suffix}>{suffix}</span>}
    </span>
  );
}
```

```css
/* DpsValue.module.css */
.value { display: inline-flex; align-items: baseline; gap: 0.25rem; font-variant-numeric: tabular-nums; }
.number { font-weight: 600; color: var(--text-strong, #e8e8e8); }
.suffix { font-size: 0.8em; color: var(--text-muted, #999); }
```

- [ ] **Step 2: `DpsBreakdown.tsx`**

```tsx
import type { CalcBreakdown } from "../../lib/dps";
import styles from "./DpsBreakdown.module.css";

export function DpsBreakdown({ breakdown }: { breakdown: CalcBreakdown }) {
  return (
    <div className={styles.breakdown}>
      <ul className={styles.stages}>
        {breakdown.stages.map((stage, i) => (
          <li key={i} className={`${styles.stage} ${styles[`kind_${stage.kind}`] ?? ""}`}>
            <span className={styles.label}>{stage.label}</span>
            {stage.value !== undefined && (
              <span className={styles.stageValue}>
                {typeof stage.value === "number" ? stage.value.toLocaleString() : stage.value}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className={styles.sources}>
        Sources: {breakdown.sources.map((s) => `${s.count} ${s.type}`).join(", ")}
      </div>
    </div>
  );
}
```

```css
/* DpsBreakdown.module.css */
.breakdown { font-size: 0.85rem; color: var(--text, #ccc); padding: 0.5rem 0.75rem; background: var(--panel-deep, rgba(0,0,0,0.2)); border-radius: 4px; }
.stages { list-style: none; padding: 0; margin: 0 0 0.5rem 0; display: flex; flex-direction: column; gap: 0.15rem; }
.stage { display: flex; justify-content: space-between; gap: 1rem; }
.label { color: var(--text-muted, #aaa); }
.stageValue { font-variant-numeric: tabular-nums; }
.kind_total { border-top: 1px solid var(--border, #444); padding-top: 0.25rem; margin-top: 0.25rem; font-weight: 600; color: var(--text-strong, #fff); }
.sources { font-size: 0.75rem; color: var(--text-muted, #888); }
```

- [ ] **Step 3: Smoke-test the component renders without error**

Add a minimal render test (optional but recommended):

```tsx
// src/components/Dps/DpsBreakdown.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DpsBreakdown } from "./DpsBreakdown";

describe("DpsBreakdown", () => {
  it("renders all stages", () => {
    const { getByText } = render(
      <DpsBreakdown breakdown={{
        stages: [
          { kind: "base", label: "Base per hit", value: "100 – 200" },
          { kind: "total", label: "Total DPS", value: 12345 },
        ],
        sources: [{ type: "gear", count: 3 }],
      }} />,
    );
    expect(getByText("Base per hit")).toBeTruthy();
    expect(getByText("12,345")).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --run src/components/Dps
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Dps
git commit -m "feat(dps): DpsValue formatting + DpsBreakdown component"
```

---

## Task 15: `RollModeToggle` component

**Files:**
- Create: `src/components/Dps/RollModeToggle.tsx`
- Create: `src/components/Dps/RollModeToggle.module.css`

- [ ] **Step 1: Implement**

```tsx
import type { RollMode } from "../../lib/dps";
import styles from "./RollModeToggle.module.css";

export function RollModeToggle({
  value, onChange,
}: { value: RollMode; onChange: (m: RollMode) => void }) {
  return (
    <div className={styles.pill} role="radiogroup" aria-label="Roll mode">
      {(["actual", "max"] as RollMode[]).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          className={`${styles.option} ${value === m ? styles.active : ""}`}
          onClick={() => onChange(m)}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
```

```css
.pill { display: inline-flex; border: 1px solid var(--border, #444); border-radius: 999px; padding: 2px; gap: 2px; }
.option { background: transparent; border: 0; color: var(--text-muted, #888); padding: 2px 10px; border-radius: 999px; cursor: pointer; font-size: 0.8rem; text-transform: lowercase; }
.option:hover { color: var(--text, #ccc); }
.active { background: var(--accent, #c97f2a); color: #111; }
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Dps/RollModeToggle.tsx src/components/Dps/RollModeToggle.module.css
git commit -m "feat(dps): RollModeToggle pill component"
```

---

## Task 16: Integrate DPS into `SkillRow` (3-column + expand)

**Files:**
- Modify: `src/components/BuildPlan/SkillRow.tsx`
- Modify: `src/components/BuildPlan/SkillRow.module.css`

- [ ] **Step 1: Extend `SkillRowProps` to accept DPS data + primary toggle**

```ts
interface SkillRowProps {
  group: SkillGroup;
  dps?: SkillDps;                // new — optional while caller migrates
  isPrimary?: boolean;
  onTogglePrimary?: () => void;
  onSkillClick: () => void;
  onSupportClick: (index: number) => void;
  onRemoveSupport: (index: number) => void;
  onRemoveSkill: () => void;
  onReorderSupports: (fromIndex: number, toIndex: number) => void;
}
```

Import `SkillDps`:

```ts
import type { SkillDps } from "../../lib/dps";
```

- [ ] **Step 2: Add row-expanded local state + DPS column + breakdown panel**

Inside the component:

```tsx
const [expanded, setExpanded] = useState(false);
```

Import `useState`, `DpsValue`, `DpsBreakdown`:

```ts
import { useState } from "react";
import { DpsValue } from "../Dps/DpsValue";
import { DpsBreakdown } from "../Dps/DpsBreakdown";
```

Replace the current `return (...)` body with:

```tsx
return (
  <div className={`${styles.row} ${expanded ? styles.expanded : ""}`}>
    <div className={styles.rowMain}>
      {/* Skill gem */}
      <div
        className={styles.skillGem}
        style={{ borderColor: skillColor }}
        onClick={onSkillClick}
        onContextMenu={(e) => { e.preventDefault(); onRemoveSkill(); }}
        title={`${skill.name} (click to replace, right-click to remove)`}
      >
        {skillIcon ? (
          <img className={styles.skillGemImage} src={skillIcon} alt={skill.name} />
        ) : (
          <span className={styles.skillGemFallback}>{skill.name}</span>
        )}
        <span className={styles.priorityBadge}>{group.priority + 1}</span>
      </div>

      <span className={styles.skillName}>{skill.name}</span>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToParentElement]}>
        <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
          <div className={styles.supports}>
            {supports.map((sup, i) => {
              if (!sup) {
                return (
                  <div
                    key={i}
                    className={`${styles.supportSocket} ${styles.supportEmpty}`}
                    onClick={() => onSupportClick(i)}
                    title="Add support gem"
                  >
                    <span className={styles.emptyPlus}>+</span>
                  </div>
                );
              }
              return (
                <SortableSupport
                  key={i}
                  gem={sup}
                  index={i}
                  onSupportClick={onSupportClick}
                  onRemoveSupport={onRemoveSupport}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      <div className={styles.dpsColumn}>
        {onTogglePrimary && (
          <button
            type="button"
            className={`${styles.primaryStar} ${isPrimary ? styles.primaryStarActive : ""}`}
            onClick={onTogglePrimary}
            aria-label={isPrimary ? "Primary skill" : "Mark as primary"}
            title={isPrimary ? "Primary skill" : "Mark as primary"}
          >
            ★
          </button>
        )}
        {dps ? (
          <button
            type="button"
            className={styles.dpsTrigger}
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            <DpsValue dps={dps.dps} />
            <span className={styles.caret}>{expanded ? "▾" : "▸"}</span>
          </button>
        ) : (
          <span className={styles.dpsPlaceholder}>—</span>
        )}
      </div>
    </div>

    {expanded && dps && (
      <div className={styles.rowBreakdown}>
        <DpsBreakdown breakdown={dps.breakdown} />
      </div>
    )}
  </div>
);
```

- [ ] **Step 3: Update CSS**

Open `SkillRow.module.css` and add:

```css
.row { display: flex; flex-direction: column; }
.rowMain { display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: 0.5rem; }
.dpsColumn { display: inline-flex; align-items: center; gap: 0.35rem; justify-self: end; }
.primaryStar { background: transparent; border: 0; color: var(--text-muted, #666); cursor: pointer; font-size: 1rem; }
.primaryStar:hover { color: var(--accent, #c97f2a); }
.primaryStarActive { color: var(--accent, #c97f2a); }
.dpsTrigger { background: transparent; border: 0; color: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0 0.25rem; }
.caret { color: var(--text-muted, #888); font-size: 0.75rem; }
.dpsPlaceholder { color: var(--text-muted, #666); }
.rowBreakdown { padding: 0.25rem 0 0.5rem 2.5rem; }
.expanded { background: var(--row-expanded, rgba(255,255,255,0.02)); }
```

Adjust existing rules if `.row` used grid/flex elsewhere (read the current CSS first and reconcile).

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. If `SkillRow` callers break (missing new optional props), they're optional, so no change required.

- [ ] **Step 5: Commit**

```bash
git add src/components/BuildPlan/SkillRow.tsx src/components/BuildPlan/SkillRow.module.css
git commit -m "feat(dps): inline DPS column + expandable breakdown on SkillRow"
```

---

## Task 17: Wire `useDps`, roll-mode, and primary-skill into `BuildPlan`

**Files:**
- Modify: `src/components/BuildPlan/BuildPlan.tsx`

- [ ] **Step 1: Inspect BuildPlan.tsx to find the current phase + skill-group render loop**

```bash
grep -n "SkillRow" src/components/BuildPlan/BuildPlan.tsx
```

Identify: how the current `BuildPhase` is selected, where `SkillRow`s are mapped, and what stores are imported.

- [ ] **Step 2: Introduce local state for `rollMode` and `primarySkillId`**

At the top of the component (adjust to existing patterns):

```tsx
import { useState, useMemo } from "react";
import { useDps } from "../../hooks/useDps";
import { snapshotFromPhase } from "../../lib/dps";
import type { RollMode } from "../../lib/dps";
import { RollModeToggle } from "../Dps/RollModeToggle";

// Inside component body:
const [rollMode, setRollMode] = useState<RollMode>("actual");
const [primarySkillId, setPrimarySkillId] = useState<string>("");
const snapshot = useMemo(
  () => snapshotFromPhase(currentPhase, primarySkillId, rollMode),
  [currentPhase, primarySkillId, rollMode],
);
const dpsResults = useDps(snapshot);
const dpsBySkillId = useMemo(() => {
  const m = new Map<string, typeof dpsResults[number]>();
  for (const r of dpsResults) m.set(r.skillId, r);
  return m;
}, [dpsResults]);
```

Replace `currentPhase` with whatever variable name BuildPlan already uses for the selected phase.

- [ ] **Step 3: Render the `<RollModeToggle />` at the top of the skill section**

Place it near the existing skill section heading:

```tsx
<div className={styles.skillsHeader}>
  <h3>Skills</h3>
  <RollModeToggle value={rollMode} onChange={setRollMode} />
</div>
```

Add a `.skillsHeader` rule to the BuildPlan CSS if needed (flex, justify-between).

- [ ] **Step 4: Pass DPS + primary props to each `SkillRow`**

In the `skillGroups.map(...)`:

```tsx
<SkillRow
  key={group.id}
  group={group}
  dps={dpsBySkillId.get(group.skill.id)}
  isPrimary={primarySkillId === group.skill.id}
  onTogglePrimary={() => setPrimarySkillId(group.skill.id)}
  /* existing props unchanged */
  onSkillClick={...}
  onSupportClick={...}
  onRemoveSupport={...}
  onRemoveSkill={...}
  onReorderSupports={...}
/>
```

Primary defaults to the first skill when unset; the engine already handles that via `snapshotFromPhase`.

- [ ] **Step 5: Typecheck + manual smoke test**

```bash
npx tsc --noEmit
npm run dev
```

Navigate to Build Plan, confirm DPS numbers appear next to each active skill, clicking a row expands the breakdown, the roll-mode toggle flips between actual/max and numbers change, the star marks the primary skill. Fix any visual issues.

- [ ] **Step 6: Commit**

```bash
git add src/components/BuildPlan/BuildPlan.tsx src/components/BuildPlan/BuildPlan.module.css
git commit -m "feat(dps): wire useDps + roll-mode toggle + primary-skill into Build Plan"
```

---

## Task 18: `DpsDelta` component + Craft Emulator integration

**Files:**
- Create: `src/components/Dps/DpsDelta.tsx`
- Create: `src/components/Dps/DpsDelta.module.css`
- Modify: `src/components/CraftEmulator/CraftEmulator.tsx`

- [ ] **Step 1: Implement `DpsDelta.tsx`**

```tsx
import { useMemo, useState } from "react";
import { useDps } from "../../hooks/useDps";
import { snapshotFromPhase, swapWeapon } from "../../lib/dps";
import type { BuildPhase, BuildGearEntry } from "../../types/buildPlan";
import type { RollMode } from "../../lib/dps";
import { DpsValue, formatDps } from "./DpsValue";
import { DpsBreakdown } from "./DpsBreakdown";
import styles from "./DpsDelta.module.css";

interface Props {
  phase: BuildPhase;
  rolledWeapon: BuildGearEntry;
  primarySkillId?: string;
  rollMode?: RollMode;
}

export function DpsDelta({ phase, rolledWeapon, primarySkillId = "", rollMode = "actual" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState(primarySkillId);

  const baseSnap = useMemo(
    () => snapshotFromPhase(phase, selectedSkillId, rollMode),
    [phase, selectedSkillId, rollMode],
  );
  const swappedSnap = useMemo(
    () => swapWeapon(baseSnap, rolledWeapon),
    [baseSnap, rolledWeapon],
  );
  const baseResults = useDps(baseSnap);
  const swappedResults = useDps(swappedSnap);

  const pick = (results: typeof baseResults) =>
    results.find((r) => r.skillId === (selectedSkillId || baseSnap.primarySkillId)) ?? results[0];
  const before = pick(baseResults);
  const after = pick(swappedResults);

  if (!before || !after) {
    return <div className={styles.card}><span className={styles.muted}>No skill to compare</span></div>;
  }

  const delta = after.dps - before.dps;
  const pct = before.dps > 0 ? (delta / before.dps) * 100 : 0;
  const deltaClass = delta > 0 ? styles.gain : delta < 0 ? styles.loss : styles.neutral;

  return (
    <div className={styles.card}>
      <header className={styles.header}>
        <span className={styles.label}>Impact on</span>
        <select
          className={styles.skillSelect}
          value={selectedSkillId || baseSnap.primarySkillId}
          onChange={(e) => setSelectedSkillId(e.target.value)}
        >
          {baseResults.map((r) => (
            <option key={r.skillId} value={r.skillId}>{r.skillName}</option>
          ))}
        </select>
      </header>
      <div className={styles.values}>
        <DpsValue dps={before.dps} suffix="" />
        <span className={styles.arrow}>→</span>
        <DpsValue dps={after.dps} suffix="DPS" />
      </div>
      <div className={`${styles.delta} ${deltaClass}`}>
        {delta >= 0 ? "+" : ""}{formatDps(Math.abs(delta))} DPS ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
        <button className={styles.toggle} onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
          {expanded ? "▾" : "▸"}
        </button>
      </div>
      {expanded && (
        <div className={styles.breakdowns}>
          <div className={styles.breakdownCol}><h5>Current</h5><DpsBreakdown breakdown={before.breakdown} /></div>
          <div className={styles.breakdownCol}><h5>Rolled</h5><DpsBreakdown breakdown={after.breakdown} /></div>
        </div>
      )}
    </div>
  );
}
```

```css
/* DpsDelta.module.css */
.card { border: 1px solid var(--border, #333); border-radius: 6px; padding: 0.75rem; background: var(--panel, #1a1a1a); }
.header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
.label { color: var(--text-muted, #888); font-size: 0.8rem; }
.skillSelect { background: transparent; color: var(--text, #ddd); border: 1px solid var(--border, #444); border-radius: 4px; padding: 2px 6px; }
.values { display: flex; align-items: baseline; gap: 0.5rem; font-size: 1.2rem; }
.arrow { color: var(--text-muted, #888); }
.delta { margin-top: 0.25rem; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem; }
.gain { color: var(--good, #6fbf6f); }
.loss { color: var(--bad, #d0645a); }
.neutral { color: var(--text-muted, #888); }
.toggle { margin-left: auto; background: transparent; border: 0; color: var(--text-muted, #888); cursor: pointer; }
.breakdowns { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.5rem; }
.muted { color: var(--text-muted, #888); }
```

- [ ] **Step 2: Locate where the Craft Emulator renders the rolled item preview**

```bash
grep -n "rolled\|preview\|currentItem" src/components/CraftEmulator/CraftEmulator.tsx
```

Identify: the state holding the current rolled item and where its preview card is rendered.

- [ ] **Step 3: Render `<DpsDelta />` next to the item preview**

Import:

```ts
import { DpsDelta } from "../Dps/DpsDelta";
// plus whatever store hooks give you the active BuildPhase
```

In the JSX, next to the rolled item preview:

```tsx
{rolledItem && activePhase && (
  <DpsDelta
    phase={activePhase}
    rolledWeapon={rolledItem}
  />
)}
```

`rolledItem` must be a `BuildGearEntry` whose `baseItemId`, `desiredModIds`, and `modRolls` reflect the rolled state. If the Craft Emulator's internal model differs, map into that shape before passing.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Open Craft Emulator, roll a weapon, verify the DPS delta card appears, the number updates when you roll again, expanding shows side-by-side breakdowns, the skill selector switches which skill is compared.

- [ ] **Step 5: Commit**

```bash
git add src/components/Dps/DpsDelta.tsx src/components/Dps/DpsDelta.module.css src/components/CraftEmulator/CraftEmulator.tsx
git commit -m "feat(dps): Craft Emulator delta card with side-by-side breakdown"
```

---

## Task 19: End-to-end validation + roadmap check-in

**Files:**
- Modify: `README.md` (one-line entry under features)
- Verify: full test suite + build

- [ ] **Step 1: Run the full test suite**

```bash
npm test -- --run
```

Expected: all green. Investigate any failures.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: build succeeds with no new warnings.

- [ ] **Step 4: Manual end-to-end exercise**

1. Launch `npm run dev`.
2. Open Build Plan for an existing Mercenary phase.
3. Verify each active skill shows a DPS number.
4. Expand each row; verify breakdown renders.
5. Toggle `actual | max`; verify numbers change sensibly.
6. Star a different skill; verify primary is persisted locally (phase-scoped state is fine for Phase 1).
7. Open Craft Emulator.
8. Roll a weapon; verify delta card appears.
9. Re-roll; verify numbers update.
10. Expand delta; verify side-by-side breakdown.

- [ ] **Step 5: One-line README entry**

In `README.md`, under the features list, add:

```markdown
- **DPS engine (Phase 1)** — real skill DPS based on gear + supports + skill stats, shown inline in Build Plan and as a delta in the Craft Emulator
```

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: README entry for Phase 1 DPS engine"
```

- [ ] **Step 7: Summary for roadmap**

Add a short "status" note to the roadmap spec:

Append to `docs/superpowers/specs/2026-04-19-dps-program-roadmap.md` (at the end):

```markdown

## Status

- **2026-04-19:** Phase 1 shipped. Phase 2 (passive tree) is the next brainstorm target.
```

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers/specs/2026-04-19-dps-program-roadmap.md
git commit -m "docs(roadmap): mark DPS Phase 1 as shipped"
```

---

## Self-Review Notes

- **Spec coverage:** every numbered section of the Phase 1 design maps to a task — §1 data layer (Tasks 1–3), §2 engine (Tasks 4–11), §2.4 pipeline stages (Task 10), §2.5 output shape (Task 11), §3 UI (Tasks 13–18), §4 testing (Tasks 11–12), §5 risks acknowledged inline (conversion stat ids, support filters, damage effectiveness), §6 file inventory matches Tasks 2–18.
- **Placeholders scanned:** no TBD/TODO; the `<FILL_FROM_DATA>` strings in the fixture have explicit Node commands to resolve them. Expected golden-number values are `0` in scaffolding with a step requiring the engineer to hand-calculate and fill in.
- **Type consistency:** `StatMap`, `DpsSnapshot`, `SkillDps`, `ModifierSource`, `BreakdownStage`, `RollMode` used identically across every task after their definition in Task 4.
- **Known unknowns:** RePoE2 raw field paths (Task 1 produces findings that drive Task 2 adjustments); stat id naming for conversions (documented in Task 10 with a fallback to adjust if Task 1 reveals different names).
