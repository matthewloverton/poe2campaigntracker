# Reload Cycle Discovery — 2026-04-19

## reload_time on crossbow base items

`reload_time` is **not present** in the current `src/data/raw/base_items.json`. The `transformBaseItems` function in `scripts/transform-item-data.mjs` maps only these weapon properties: `physical_damage_min/max`, `attack_time`, `critical_strike_chance`, and `range`. It never reads `reload_time` (nor a `reload_duration` variant).

Per PoB reference data (user screenshots), the Makeshift Crossbow has **800ms reload time**. This value is consistent with all crossbows in PoE2 — every crossbow base type uses 800ms as the standard reload. This was confirmed indirectly through PoB's displayed breakdown: `Total Firing Time: 0.63s + Reload Time: 0.8s = Attack time (cycle): 1.43s`.

The raw RePoE2 source likely contains `reload_time` in `properties` on crossbow items (consistent with the game data). Since running the transform requires a live network fetch, the value is added manually to `base_items.json` for all 26 crossbow entries using the known 800ms value.

The transform script has been updated to map `props.reload_time` → `reloadTime` (milliseconds) so future regeneration will preserve it automatically.

## Magazine / ammo capacity per skill

`base_number_of_crossbow_bolts` is found in the **Ammunition** stat set on crossbow skills. In `skill_gems.json`, each `GemEntry.skillDetail.statSets` is an array of `StatSet` objects. The `Ammunition` stat set (index 0 on Galvanic Shards) has `levels["1"].stats["base_number_of_crossbow_bolts"] = 1`.

All 12 `CrossbowSkill`-typed active gems have exactly 1 bolt in the Ammunition stat set at level 1 (and constant across levels — it's a static stat, not scaling).

Gas Grenade has no Ammunition stat set — it is a Grenade, not a magazine-fed crossbow attack.

## How the transform handles each field

- **reload_time**: Previously dropped. Now mapped via `...(props.reload_time != null && { reloadTime: props.reload_time })` in `transformBaseItems`.
- **ammo capacity**: The Ammunition stat set's `base_number_of_crossbow_bolts` stat is present in `statSets[n].levels[lvl].stats` in the transformed `skill_gems.json`. The transform already preserves this correctly via the `extractStatSets` function. A new `ammoCapacity` top-level field is surfaced on `SkillDetail` by reading this stat from the Ammunition stat set at level 1.

## What the implementation reads

- `weaponProps.reloadTime` — from `BaseItem.properties.reloadTime` (ms), set to 800 for all crossbows.
- `detail.ammoCapacity` — from `SkillDetail.ammoCapacity` (integer, e.g. 1), derived from the Ammunition stat set's `base_number_of_crossbow_bolts` at level 1. Skills without an Ammunition stat set get `undefined`, which disables the cycle formula.
