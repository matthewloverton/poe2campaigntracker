# Local weapon mod diagnostic

## Test
Fixture: `crossbowLocalIncPhysGalvanic` (Makeshift Crossbow + max-rolled "+40-49% increased Physical Damage" + Galvanic Shards L1)

The mod was set to 100th percentile roll, which resolves to 49% (range is 40–49). This maximises visibility of any effect the engine applies.

## Results
- Engine DPS: **31.122**
- Bare reference DPS: 31.122
- PoB reference DPS: ~9.5 (with a 40% roll) / ~46.4 (expected with 49% roll, calculated below)

The engine produced **exactly the same DPS as the bare crossbow**, confirming the mod was silently ignored.

### Correct expected DPS if the mod were applied (49% roll)
Base weapon phys: 7–12. With 49% local inc: 7×1.49=10.43 – 12×1.49=17.88.
- Projectile set (dmgMult=15, ×8 projectiles): (10.43×0.15) – (17.88×0.15) × 8 = 12.52 – 21.46
- Beam set (dmgMult=75, ×1): (10.43×0.75) – (17.88×0.75) = 7.82 – 13.41
- Total perHit: min=20.34, max=34.87, avg=27.60
- DPS = 27.60 × 1.6 × 1.05 ≈ **46.37**

## Mod identification
- Mod id: `LocalIncreasedPhysicalDamagePercent1`
- Mod name: "Heavy"
- Stat id: `local_physical_damage_+%`
- Stat range: min=40, max=49
- Stat id classification via `statKindForId`: **"increased"** (the function matches `/_\+%$/`, which `local_physical_damage_+%` satisfies)
- Mod tags: `["physical_damage", "damage", "physical", "attack"]`

## Diagnosis

**`local_physical_damage_+%` is collected into the StatMap (it passes through `collectGearStats` / `addEntryStats` without issue) but is never read by the pipeline.**

In `pipeline.ts > applyMultipliers`, the only stat ids queried are:
- `damage_+%` (global increased damage)
- `physical_damage_+%` (type-specific increased physical damage)

The `local_*` prefix is a PoE convention for mods that apply to the weapon's base damage range rather than as a global multiplier on the skill result. The engine has no code path that reads `local_physical_damage_+%` from the StatMap.

The breakdown output from the diagnostic test confirms this: there is no `"inc"` stage in the breakdown at all — no multiplier was applied. The only stages present are `base` (Projectile), `more` (×8 projectiles), `base` (Beam), `rate`, `crit`, and `total`.

## Recommended fix scope

The correct PoE mechanic is: local weapon mods modify the weapon's **base damage range** before the skill formula reads it. This is how PoB handles it.

The minimal fix requires two changes:

1. **`modStats.ts` / `snapshot.ts`:** When building the weapon's effective base damage range for a snapshot, detect any mods in `weapon.desiredModIds` whose stat ids start with `local_`, and apply them directly to the weapon's `physicalDamageMin` / `physicalDamageMax` values before those values are stored in the snapshot. Specifically, `local_physical_damage_+%` should scale the base min/max by `(1 + value/100)`.

2. **Do NOT route `local_physical_damage_+%` into `applyMultipliers`** — that would double-count it as a global multiplier. The stat should be consumed at weapon-base resolution time, not at the multiplier pipeline stage.

This keeps the pipeline stateless with respect to local mods and matches PoE game mechanics.

No engine changes were made in this diagnostic task.
