# PoB Parity Deep Dive — 2026-04-19

## Scenario

- Makeshift Crossbow (7–12 phys, 625ms attack, 5% crit, 800ms reload)
- Local mod: "Adds 1 to 9 Lightning Damage" (LocalAddedLightningDamageTwoHand1_)
- Galvanic Shards L5, quality 0, no supports, no other gear, no tree

## Gap Summary

| Stat | PoB | Our engine (before fix) |
|------|-----|------------------------|
| Proj: Light range | 1–**4** | 1–**3** |
| Proj: avg | 3.5 | 3.0 |
| Beam: Light range | 8–23 | 9–22 |
| Beam: avg | 15.5 | 16.1 |
| Total DPS | ~14.0 | ~13.6 |

## Root Cause: Intermediate Rounding of Converted Damage

PoB2's `CalcOffence.lua` applies a rounding step to converted damage amounts
**before** adding them to the target type's retained base. This is done inside
`calcConvertedDamage` (lines 82–85):

```lua
local function calcConvertedDamage(activeSkill, output, cfg, damageType)
    local convertedMin, convertedMax = 0, 0
    for _, otherType in ipairs(dmgTypeList) do
        local convMult = conversionTable[otherType][damageType]
        if convMult > 0 then
            local min, max = output[otherType.."MinBase"], output[otherType.."MaxBase"]
            convertedMin = convertedMin + (min or 0) * convMult
            convertedMax = convertedMax + (max or 0) * convMult
        end
    end
    -- KEY: round the incoming conversions before returning
    if convertedMin ~= 0 and convertedMax ~= 0 then
        convertedMin = round(convertedMin)
        convertedMax = round(convertedMax)
    end
    return convertedMin, convertedMax
end
```

The returned `convertedMin/Max` (already rounded) is then used in the main loop:

```lua
local summedMin = baseMin * convMult + convertedMin + gainedMin
local summedMax = baseMax * convMult + convertedMax + gainedMax
output[damageType.."SummedMinBase"] = round(summedMin)   -- final round
output[damageType.."SummedMaxBase"] = round(summedMax)
```

## Step-by-Step Comparison (Projectile set, L5)

| Stage | PoB | Our engine (before fix) |
|-------|-----|------------------------|
| base.phys | {1.47, 2.52} | {1.47, 2.52} |
| base.light | {0.21, 1.89} | {0.21, 1.89} |
| convertedPhys→light | {0.882, 1.512} | {0.882, 1.512} |
| **Intermediate round** | {**1**, **2**} | *(skipped — kept as float)* |
| light total before final round | {1.21, **3.89**} | {1.092, **3.402**} |
| **Final round** | {1, **4**} | {1, **3**} |
| Phys retained (final round) | {1, 1} | {1, 1} |
| Proj perHit | 2–5 | 2–4 |

## All Hypotheses Tested

1. **Rounding rule** — Ruled out. Both PoB and JS use half-up rounding (identical).
2. **Weapon damage** — Ruled out. Both read 7–12 phys, 1–9 light.
3. **damageMultiplier** — Ruled out. Both use 21 (proj), 107 (beam) at L5.
4. **Gem-level implicit** — Not applicable. PoB's data has no `incrementalEffectiveness` in
   the `grantedEffectLevel` used by `CalcOffence`; it only affects `statInterpolation==3` stats
   (none relevant for Galvanic).
5. **damageEffectiveness** — Not a separate field for Galvanic; `baseMultiplier` IS the
   effectiveness and matches our `damageMultiplier`.
6. **Conversion percentage** — Ruled out. Both use exactly 60% (proj) / 100% (beam).
7. **Intermediate rounding in calcConvertedDamage** — **CONFIRMED ROOT CAUSE.**

## The Fix

`applyConversions` in `src/lib/dps/pipeline.ts` was rewritten to:

1. Accumulate conversion fractions per unique `(from, to)` pair (handles multiple stat IDs
   mapping to the same pair, with total-outflow capping at 100%).
2. For each target type, collect all incoming converted amounts using the full pre-retention
   base (matching PoB's `output[otherType.."MinBase"]`).
3. **Round those incoming conversion totals** (only when both min and max are non-zero).
4. Apply retained fraction to source types (continuous, not rounded).
5. Output = retained + rounded incoming; final per-type rounding done by caller (index.ts).

## Verified Math (Beam set, L5)

- base.phys = {7.49, 12.84}; base.light = {1.07, 9.63}
- incomingMin[light] = 7.49 × 1.0 = 7.49 → round = **7**
- incomingMax[light] = 12.84 × 1.0 = 12.84 → round = **13**
- out.light = {1.07+7=8.07, 9.63+13=22.63} → final round: **8, 23**
- Matches PoB: Light 8–23 ✓

## Final DPS Verification

| Component | Value |
|-----------|-------|
| Proj perHit | 2–5, avg 3.5 |
| Beam perHit | 8–23, avg 15.5 |
| Total perHit | 10–28, avg **19.0** |
| Rate | 0.7018/s |
| Crit multiplier | 1.05 |
| **DPS** | **19.0 × 0.7018 × 1.05 ≈ 14.0** ✓ |

## Files Changed

- `src/lib/dps/pipeline.ts` — `applyConversions` rewritten with intermediate rounding
- `src/lib/dps/__fixtures__/crossbowLocalLightningL5Galvanic.ts` — new fixture
- `src/lib/dps/calcDps.test.ts` — new PoB parity test

All 123 tests pass after the fix.
