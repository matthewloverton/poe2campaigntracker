# Phase 1 Plan Amendments — post-Task 1 findings

**Status:** Authoritative. When any task in `2026-04-19-dps-engine-phase1.md` contradicts this doc, this doc wins.

**Source of these amendments:** `2026-04-19-repoe2-skill-fields.md` (both investigations).

## Amendment 1 — No `base_flags`; use `active_skill.types`

RePoE2 does not provide `active_skill.base_flags`. Skill classification is a string array at `active_skill.types`, e.g. `["Attack", "Projectile", "Grenade", "Fire"]`.

**Consequences:**

- `SkillDetail.baseFlags?` field is **not added** to types. Remove any reference to it.
- `SkillDetail.activeSkillTypes: string[]` is the **only** classification field.
- In the engine, wherever the plan says `skillGem.skillDetail?.baseFlags?.attack`, replace with:
  ```ts
  const types = gem.skillDetail?.activeSkillTypes ?? [];
  const isAttack = types.includes("Attack");
  ```
- `getSkillTags` already maps `activeSkillTypes` to lowercase; no change to that helper.

## Amendment 2 — No `damage_effectiveness`; use `damage_multiplier` per stat set

RePoE2 does not have a `damage_effectiveness` field. The per-level scaling is in `stat_sets[i].per_level[lvl].damage_multiplier` (a number like 15, 40, 150). This serves the same role PoB calls "damage effectiveness": a percentage multiplier applied to the skill's damage inputs.

**Consequences:**

- `SkillLevelData` does NOT get a `damageEffectiveness` field.
- The existing `damageMultiplier?: number` on `SkillLevelData` already exists — but it currently comes from a single "primary" stat set. It must become stat-set-aware (see Amendment 4).
- In `calcBaseDamage`, replace the line:
  ```ts
  const damageEffectiveness = (skillLevelData?.stats?.["damage_effectiveness_+%"] ?? 0) + 100;
  ```
  with per-stat-set iteration (see Amendment 4) using each stat set's own `damage_multiplier`.

## Amendment 3 — Per-level structured stats use positional mapping

The per-level `stats` field is a sparse array of `{value: N} | null`, not a `Record<string, number>`. The index maps to `static.stats[index].id`.

**Consequences:**

- `SkillLevelData.stats: Record<string, number>` is **resolved at transform time**, not stored raw. The transform script (Task 2) must:
  1. For each stat set, read `static.stats` to get the index → id mapping.
  2. For each level, iterate the sparse `per_level[lvl].stats` array. For each non-null entry at index N, emit `{ id: static.stats[N].id, value: stats[N].value }`.
  3. Write the resolved `Record<string, number>` to the transformed JSON.
  4. Merge in any stats with `static.stats[N].value` defined that aren't overridden per-level (i.e. a stat id may only appear in the resolved dict at the static value if no per-level entry exists — implementation's call; simplest is "if per-level has a value, use it; else use static value; else omit").

- This keeps `SkillLevelData.stats: Record<string, number>` as designed. Downstream engine code is unchanged.

**Task 2 implementation note:**

```js
// Inside extractStatSets, for each level:
const staticStats = ss.static?.stats || []; // [{ id, type, value? }, ...]
const sparsePerLevel = ssLevel?.stats || []; // [null | {value: N}, ...]

const resolvedStats = {};
for (let n = 0; n < staticStats.length; n++) {
  const staticEntry = staticStats[n];
  if (!staticEntry?.id) continue;
  const override = sparsePerLevel[n];
  if (override != null && typeof override.value === "number") {
    resolvedStats[staticEntry.id] = override.value;
  } else if (typeof staticEntry.value === "number") {
    resolvedStats[staticEntry.id] = staticEntry.value;
  }
}

levels[lvl] = {
  costs: data.costs || {},
  damageMultiplier: ssLevel?.damage_multiplier,
  statText: ssLevel?.stat_text
    ? Object.values(ssLevel.stat_text).map((t) => cleanModText(t))
    : [],
  stats: resolvedStats,
  // attackTime omitted — no such per-level field in RePoE2
};
```

`SkillLevelData.attackTime` field is still defined in the type for future-proofing, but will always be `undefined` for v1.

## Amendment 4 — Skills have multiple stat_sets; aggregate damage from all

Many skills have 2+ stat sets that each deal damage independently (Gas Grenade: impact + cloud + explosion; Galvanic Shards: projectile + beam). The current plan's `SkillDetail.levels` only stores the primary stat set's per-level data, and the engine only processes `skillDetail.levels[level]`.

**Consequences:**

- `SkillDetail` already has an optional `statSets?: StatSet[]` field carrying all non-hidden stat sets. This field becomes **required to read in the engine**, not just "for tooltips".
- The engine must treat each stat set as a separate damage-dealing instance sharing the same gear/support stats:
  1. For each stat set on the gem, compute a per-stat-set damage: `base × damage_multiplier% × (1 + inc) × more`.
  2. Sum hits across all stat sets in the **per-hit** value (i.e. pressing the grenade deals impact + cloud-tick + explosion in one "use").
  3. Rate is the skill-level rate (attack/cast/cooldown), applied once to the summed per-hit.

**`SkillDetail` amendment (Task 3):**

Keep the existing primary-set shape as a convenience for simple skills, but guarantee `statSets` is always populated when there's at least one non-hidden stat set:

```ts
export interface SkillDetail {
  description?: string;
  castTime?: number;
  cooldown?: number;
  storedUses?: number;
  attackSpeedMultiplier?: number;
  maxLevel: number;
  levels: Record<string, SkillLevelData>;   // primary set (for back-compat)
  staticStatText: string[];
  qualityStats: QualityStat[];
  /** ALL non-hidden stat sets, including the primary. Always present. */
  statSets: StatSet[];
  activeSkillTypes?: string[];
  weaponRestrictions?: string[];
  // baseFlags removed — see Amendment 1.
}
```

Make `statSets` non-optional. In the transform, guarantee it's emitted even for single-stat-set skills (single-element array).

**Engine amendment (Task 11, `calcDps`):**

Iterate stat sets and sum their contributions:

```ts
// Replace the single calcBaseDamage call with:
const statSets = skillGem.skillDetail?.statSets ?? [];
let combinedPerHit: DamageByType = zeroDamageByType();
let combinedBreakdownStages: BreakdownStage[] = [];

for (const ss of statSets) {
  const lvlData = ss.levels[String(level)] ?? ss.levels[String(detail.maxLevel)];
  if (!lvlData) continue;
  const ssEffectiveness = (lvlData.damageMultiplier ?? 100); // percent

  // For this stat set: merge ss-level stats into a local StatMap on top of gear+support+skill
  const ssStatMap = mergeStatMaps(statMap, statMapFromSkillLevel(ss.name, lvlData, skillTags));
  const base = calcBaseDamage({ isAttack, damageEffectiveness: ssEffectiveness, weapon: weaponProps ?? null, skillFlat: zeroDamageByType(), statMap: ssStatMap });
  const converted = applyConversions(base, ssStatMap);
  const final = applyMultipliers(converted, ssStatMap, skillTags);
  for (const t of DAMAGE_TYPES) {
    combinedPerHit[t].min += final[t].min;
    combinedPerHit[t].max += final[t].max;
  }
  combinedBreakdownStages.push({
    kind: "base",
    label: `${ss.name}: ${sumPerHit(final).min.toFixed(0)}–${sumPerHit(final).max.toFixed(0)}`,
  });
}
```

Introduce a small helper in `skillStats.ts`:

```ts
export function statMapFromSkillLevel(
  setName: string,
  lvl: SkillLevelData,
  skillTags: string[],
): StatMap {
  const map = emptyStatMap();
  for (const [id, value] of Object.entries(lvl.stats ?? {})) {
    if (value === 0) continue;
    addContribution(map, id, {
      value,
      kind: statKindForId(id),
      tags: skillTags,
      source: { type: "skill", id: setName, label: setName },
    });
  }
  return map;
}
```

The original `collectSkillStats` (Task 8) still exists but now handles only the *primary* stat set's innate stats for back-compat; the multi-set aggregation in `calcDps` uses `statMapFromSkillLevel` per set.

## Amendment 5 — `costs` location

`per_level[lvl].costs` lives on the **top-level** skill `per_level`, not the stat_set `per_level`. The existing transform already handles this correctly (reads `data.costs` from the outer scope). No change needed, but verify in Task 2 that the refactor doesn't break cost extraction.

## Amendment 6 — Transform: support-gem filter field names

The plan's Task 2 speculated `gem.allowed_active_skill_types / excluded_active_skill_types / added_active_skill_types`. Task 1 did not confirm these fields on support gems. Task 2 should:

1. Inspect a known support gem's raw entry (e.g. "Martial Tempo") in `skill_gems.min.json` to confirm the actual field names.
2. If the speculated names are correct, proceed. If not, update Task 2's step 3 with the real names and keep the same `allowedActiveSkillTypes / excludedActiveSkillTypes / addedActiveSkillTypes` names on the transformed output.

## Amendment 7 — Task 12 fixture for multi-stat-set skill

Task 12's "bare crossbow + Gas Grenade" fixture must hand-calculate expected DPS from **all three** stat sets (impact + cloud + explosion), not just one. The expected value in the golden-number test reflects the sum.

---

## Rollup of field-name changes

| Plan assumption | Reality | Resolution |
|---|---|---|
| `active_skill.base_flags: Record<string, boolean>` | Not present | Dropped. Use `active_skill.types: string[]`. |
| Per-level `stats: Record<id, number>` raw from RePoE2 | Sparse array with positional mapping to `static.stats` | Resolved at transform time (Amendment 3). Engine shape unchanged. |
| `damage_effectiveness_+%` stat id | Not present | Use `damage_multiplier` per stat set per level as the effectiveness percent. |
| Single stat set per skill | Up to 3+ stat sets per skill | Engine iterates stat sets; damage sums. `SkillDetail.statSets` non-optional. |
| `attack_time` per level | Not present in RePoE2 | Field retained in type (future-proof), always undefined for v1. |
