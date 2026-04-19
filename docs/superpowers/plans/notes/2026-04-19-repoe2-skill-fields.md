# RePoE2 skill_gems field findings (2026-04-19)

## Summary

RePoE2 ships skill gem data across TWO separate JSON files:
- **skill_gems.min.json**: Gem container entries with metadata (color, crafting level, granted skill IDs)
- **skills.min.json**: Skill records referenced by gem entries via `grants_skills` array

Each skill entry in `skills.min.json` contains per-level stat progression (via `stat_sets[i].per_level[lvl]`) with `damage_multiplier` values, but NOT a dedicated `damage_effectiveness` field. The DPS calculator will need to infer damage effectiveness from skill type classification and static stats.

## 1. Skill Gem Entry Structure (from skill_gems.min.json)

```json
{
  "base_item": {
    "display_name": "Galvanic Shards",
    "id": "Metadata/Items/Gem/SkillGemGalvanicShards",
    "release_state": "released"
  },
  "color": "w",
  "crafting_level": 5,
  "crafting_types": ["Crossbow"],
  "gem_type": "active",
  "grants_skills": [
    "GalvanicShardsAmmoPlayer",
    "GalvanicShardsPlayer"
  ],
  "icon_dds_file": "Art/2DArt/SkillIcons/4k/BurstShotStormblast.dds",
  "recommended_supports": [
    "Metadata/Items/Gem/SupportGemDoubleBarrel",
    "Metadata/Items/Gems/SupportGemConduction"
  ],
  "requirement_weights": {
    "dexterity": 50,
    "intelligence": 0,
    "strength": 50
  },
  "tags": [
    "strength",
    "dexterity",
    "grants_active_skill",
    "attack",
    "ammunition",
    "projectile",
    "lightning",
    "chaining",
    "merging"
  ],
  "tutorial_video": "Art/Videos/SkillTutorials/GalvanicShards.bk2"
}
```

**Key point:** `grants_skills` is an array of string IDs (e.g. `"GalvanicShardsPlayer"`). These resolve to separate skill records in `skills.min.json`.

## 2. Skill Record Structure (from skills.min.json)

### Example 1: Galvanic Shards (Attack Gem)

Skill ID: `GalvanicShardsPlayer`

```json
{
  "active_skill": {
    "description": "Rapidly fire charged bolts that fragment in flight, releasing [Chain|Chaining] [Lightning] beams when they [HitDamage|Hit] enemies. Can fire a limited number of bursts before needing to reload. These fragments can [Merging|Merge].",
    "display_name": "Galvanic Shards",
    "id": "galvanic_shards",
    "is_manually_casted": false,
    "is_skill_totem": false,
    "stat_conversions": {
      "burst_shot_maximum_action_distance_+": "attack_maximum_action_distance_+"
    },
    "types": [
      "Attack",
      "RangedAttack",
      "Projectile",
      "ProjectilesFromUser",
      "CrossbowSkill",
      "Trappable",
      "Totemable",
      "Mineable",
      "Lightning",
      "Chains",
      "UsableWhileMoving"
    ],
    "weapon_restrictions": []
  },
  "cast_time": 1000,
  "is_support": false,
  "per_level": {
    "1": {},
    "2": {},
    "3": {}
  },
  "stat_sets": [
    {
      "id": "GalvanicShardsPlayer",
      "label": ["ProjectileHideDescription", "Projectile", true, true, false],
      "per_level": {
        "1": {
          "damage_multiplier": 15
        },
        "2": {
          "damage_multiplier": 16
        },
        "3": {
          "damage_multiplier": 18
        }
      },
      "static": {
        "quality_stats": [
          {
            "stat": "Fires {base_number_of_projectiles} [Projectile|Projectiles]",
            "stats": {
              "base_number_of_projectiles": 100
            }
          }
        ],
        "stat_text": {
          "active_skill_base_physical_damage_%_to_convert_to_lightning": "[Conversion|Converts] 60% of [Physical] damage to [Lightning] damage",
          "base_number_of_projectiles": "Fires 8 fragments per shot"
        },
        "stats": [
          {"id": "projectiles_normal_distribution_height_mean", "type": "constant", "value": 3},
          {"id": "projectiles_normal_distribution_height_standard_deviation", "type": "constant", "value": 20},
          {"id": "base_number_of_projectiles", "type": "constant", "value": 8}
        ],
        "tooltip_order": [...]
      }
    },
    {
      "id": "GalvanicShardsBeamPlayer",
      "label": ["Beam", "Beam", true, true, true],
      "per_level": {
        "1": {
          "damage_multiplier": 75
        },
        "2": {
          "damage_multiplier": 76
        },
        "3": {
          "damage_multiplier": 78
        }
      },
      "static": {...}
    }
  ],
  "static": {},
  "stats": []
}
```

### Example 2: Gas Grenade (Grenade Gem)

Skill ID: `ToxicGrenadePlayer`

```json
{
  "active_skill": {
    "description": "Fire a bouncing [Grenade] that causes a burst of [Poison|Poison] gas when its fuse expires, damaging enemies and leaving behind a growing [Poison|Poison] cloud. [Burning] effects or [Detonator|Detonator] skills will cause the cloud to explode in a fiery blast.",
    "display_name": "Gas Grenade",
    "id": "toxic_grenade",
    "is_manually_casted": true,
    "is_skill_totem": false,
    "stat_conversions": {
      "grenade_skill_area_of_effect_+%": "base_skill_area_of_effect_+%",
      "grenade_skill_cooldown_count_+": "base_added_cooldown_count",
      "grenade_skill_cooldown_speed_+%": "base_cooldown_speed_+%",
      "grenade_skill_damage_+%": "damage_+%",
      "grenade_skill_duration_+%": "skill_effect_duration_+%",
      "grenade_skill_number_of_additional_projectiles": "number_of_additional_projectiles"
    },
    "types": [
      "Attack",
      "RangedAttack",
      "Area",
      "ProjectileNumber",
      "ProjectileSpeed",
      "Cooldown",
      "Duration",
      "Grenade",
      "Chaos",
      "Fire",
      "UsableWhileMoving",
      "CreatesGroundEffect",
      "Limit",
      "Projectile",
      "DetonatesAfterTime"
    ],
    "weapon_restrictions": []
  },
  "cast_time": 1000,
  "is_support": false,
  "per_level": {
    "1": {"costs": {"Mana": 12}},
    "2": {"costs": {"Mana": 14}},
    "3": {"costs": {"Mana": 16}}
  },
  "stat_sets": [
    {
      "id": "ToxicGrenadePlayer",
      "label": ["Impact", "Impact", true, true, true],
      "per_level": {
        "1": {
          "damage_multiplier": 40,
          "stat_text": {
            "active_skill_base_area_of_effect_radius": "Impact radius is 1.4 metres"
          },
          "stats": [null, null, null, null, null, null, null, null, {"value": 14}, null]
        },
        "2": {
          "damage_multiplier": 44,
          "stat_text": {
            "active_skill_base_area_of_effect_radius": "Impact radius is 1.4 metres"
          },
          "stats": [null, null, null, null, null, null, null, null, {"value": 14}, null]
        }
      },
      "static": {...}
    },
    {
      "id": "ToxicGrenadeCloudPlayer",
      "label": ["PoisonCloud", "Poison Cloud", true, true, true],
      "per_level": {
        "1": {...},
        "2": {...}
      },
      "static": {...}
    },
    {
      "id": "ToxicGrenadeCloudExplosionPlayer",
      "label": ["Explosion", "Explosion", true, true, true],
      "per_level": {...},
      "static": {...}
    }
  ],
  "static": {
    "attack_speed_multiplier": 1.25,
    "cooldown": 3000,
    "stored_uses": 3
  }
}
```

## 3. Confirmed Field Paths

### Per-Level Structured Stats

**Path:** `stat_sets[i].per_level[lvl]`

Each level object may contain:
- `damage_multiplier` (number, e.g., 15, 16, 18, ...)
- `stat_text` (object with stat IDs as keys; values are human-readable strings)
- `stats` (sparse array or null; see gotchas below)
- `costs` (object with cost types; only present on top-level `per_level[lvl]` for skills like Ammo gems)

**Example:**
```json
{
  "1": {
    "damage_multiplier": 15
  },
  "2": {
    "damage_multiplier": 16
  },
  "3": {
    "damage_multiplier": 18
  }
}
```

### Damage Effectiveness

**Status:** NOT PRESENT as a dedicated field. The concept does not exist in RePoE2.

**Alternative:** Use skill classification from `active_skill.types` and static stats to infer scaling:
- `damage_multiplier` in `stat_sets[i].per_level[lvl]` serves as the per-level scaling multiplier
- `active_skill.types` includes tags like `"Attack"`, `"Spell"`, `"Area"`, etc.
- Damage type conversions are in `active_skill.stat_conversions` (e.g., physical-to-lightning)

### Skill Flags / Types Classification

**Path:** `active_skill.types` (array of strings)

Examples from Galvanic Shards:
```json
"types": [
  "Attack",
  "RangedAttack",
  "Projectile",
  "ProjectilesFromUser",
  "CrossbowSkill",
  "Trappable",
  "Totemable",
  "Mineable",
  "Lightning",
  "Chains",
  "UsableWhileMoving"
]
```

Examples from Gas Grenade:
```json
"types": [
  "Attack",
  "RangedAttack",
  "Area",
  "ProjectileNumber",
  "ProjectileSpeed",
  "Cooldown",
  "Duration",
  "Grenade",
  "Chaos",
  "Fire",
  "UsableWhileMoving",
  "CreatesGroundEffect",
  "Limit",
  "Projectile",
  "DetonatesAfterTime"
]
```

**Note:** `base_flags` (as an object with boolean keys) does NOT exist in RePoE2. The `types` array is the sole source of skill classification.

### Weapon Restrictions

**Path:** `active_skill.weapon_restrictions` (array)

- Empty array `[]` for most skills (Galvanic Shards, Gas Grenade)
- May contain restriction strings on other skills (not observed in examples)

### Cast Time / Attack Time

**Path:** `cast_time` (at skill root level, in milliseconds)

- Galvanic Shards: `1000` ms
- Gas Grenade: `1000` ms
- Fireball: `1200` ms

**Note:** No separate `attack_time` field exists. For attack skills, `cast_time` serves as the action time. For skills with `"Cooldown"` type, see `static.cooldown` (in milliseconds).

**Path (cooldown):** `static.cooldown` (optional, milliseconds)

Example from Gas Grenade:
```json
"static": {
  "attack_speed_multiplier": 1.25,
  "cooldown": 3000,
  "stored_uses": 3
}
```

### Stat Sets

**Path:** `stat_sets` (array of objects)

Each stat set represents a separate damage or effect instance:

```json
"stat_sets": [
  {
    "id": "GalvanicShardsPlayer",
    "label": ["ProjectileHideDescription", "Projectile", true, true, false],
    "per_level": { ... },
    "static": {
      "quality_stats": [...],
      "stat_text": {...},
      "stats": [...],
      "tooltip_order": [...]
    },
    "translation_file": "..." (optional)
  },
  {
    "id": "GalvanicShardsBeamPlayer",
    "label": ["Beam", "Beam", true, true, true],
    "per_level": { ... },
    "static": { ... }
  }
]
```

## 4. Gotchas Observed

### 1. Sparse `stats` Array in per_level

When `stat_sets[i].per_level[lvl].stats` exists, it is a sparse array (mostly `null` entries) where non-null slots are objects like `{"value": 14}`. The mapping of array indices to stat IDs is **not documented in RePoE2 dump** — likely depends on a global stat table.

Example from ToxicGrenadePlayer level 1:
```json
"stats": [null, null, null, null, null, null, null, null, {"value": 14}, null, ...]
```

**Implication:** Use `static.stats` (keyed by ID) for constant values; ignore per-level `stats` arrays unless we reverse-engineer the index mapping.

### 2. Multiple Stat Sets Per Skill

Galvanic Shards has 2 stat sets (primary projectile + beam). Gas Grenade has 3 (impact + cloud + cloud explosion). This is common.

**Implication:** DPS calculator must aggregate all stat sets when computing total damage.

### 3. Ammo Skills Have Dual Structure

Gem `grants_skills: ["GalvanicShardsAmmoPlayer", "GalvanicShardsPlayer"]` includes BOTH:
- `GalvanicShardsAmmoPlayer` (the ammo reserve skill; has costs in top-level `per_level[lvl].costs`)
- `GalvanicShardsPlayer` (the main attack; has stat_sets with damage multipliers)

**Implication:** When processing gem `grants_skills`, filter carefully; primary DPS skill is usually the one with more stat_sets.

### 4. No Damage Effectiveness Scaling

There is NO `damage_effectiveness` or similar field. Damage scaling is **only** via `damage_multiplier` in `stat_sets[i].per_level[lvl]`.

The `damage_multiplier` is a percentage (e.g., 15, 16, 18) representing damage scaling relative to a base (likely weapon damage or intrinsic base damage).

### 5. Attack Speed Multiplier is Static

`static.attack_speed_multiplier` (e.g., Gas Grenade: `1.25`) is constant across levels. It does **not** appear in per-level data.

### 6. Top-Level `per_level` vs `stat_sets[i].per_level`

- **Top-level:** `per_level[lvl]` often contains only `costs` (for gems that reserve resources) or is empty
- **Stat set level:** `stat_sets[i].per_level[lvl]` contains `damage_multiplier`, `stat_text`, and sparse `stats`

The actual scaling data lives in `stat_sets`.

## 5. Skills File Availability

RePoE2 serves multiple JSON files. Confirmed files:
- `skill_gems.min.json` (852 KB, 1103 gems)
- `skills.min.json` (13 MB, thousands of skill records)

Full list of available files:
```
active_skill_types.min.json, ascendancies.min.json, audio.min.json, augments.min.json,
base_items.min.json, buff_visuals.min.json, buffs.min.json, characters.min.json,
cost_types.min.json, default_monster_stats.min.json, flavour.min.json, gem_tags.min.json,
item_classes.min.json, keywords.min.json, mods.min.json, mods_by_base.min.json,
skill_gems.min.json, skills.min.json, stat_value_handlers.min.json, stats_by_file.min.json
```

## 6. Recommendations for Transform Script (Task 2)

1. **Preserve all fields in `active_skill`:**
   - `types`, `stat_conversions`, `weapon_restrictions`, `is_manually_casted`, `description`, `id`

2. **Extract per-level scaling from `stat_sets[i].per_level[lvl]`:**
   - Capture `damage_multiplier` for each level
   - Preserve `stat_text` (if present) for display

3. **Use `static.stats` (not sparse per-level arrays):**
   - These are keyed by stat ID (e.g., `"base_number_of_projectiles"`)
   - Already correctly handled by current transform (see `quality_stats`)

4. **Infer skill class from `active_skill.types`:**
   - Check for `"Attack"` vs `"Spell"` for damage model selection
   - Check for `"Area"`, `"Projectile"`, `"Cooldown"`, etc. for game mechanics

5. **Store attack/cast timing:**
   - Use `cast_time` (in milliseconds)
   - Use `static.cooldown` if present; otherwise derive from type
   - Use `static.attack_speed_multiplier` for attack speed scaling

## 7. Per-level sparse-array stat-id mapping — investigation 2

### Summary

The sparse array index in `stat_sets[i].per_level[lvl].stats` maps **directly by position** to `stat_sets[i].static.stats`. Each non-null entry at position N in the per-level sparse array corresponds to the stat at position N in the static stats array.

### Hunting Results

- **Step 1:** Fetched `stats_by_file.min.json` — this file maps stat *text strings* to metadata (files, tokens), not skill IDs. Not the mapping we need.
- **Step 2:** Confirmed the lookup is local to each stat set, not in a global file.
- **Step 4:** Found the mapping lives on the `static.stats` array itself.

### The Concrete Lookup Rule

```javascript
/**
 * Given a skill ID, stat set ID, level number, and sparse array index,
 * resolve the stat ID and per-level value.
 * 
 * @param {string} skillId - e.g., "ToxicGrenadePlayer"
 * @param {string} statSetId - e.g., "ToxicGrenadePlayer" (stat_sets[i].id)
 * @param {string|number} level - e.g., "1"
 * @param {number} sparseIndex - e.g., 8
 * @returns {{statId: string, value: number, type: string}} The resolved stat
 */
function resolvePerLevelStat(skillId, statSetId, level, sparseIndex) {
  const skill = SKILLS_DATA[skillId];
  const statSet = skill.stat_sets.find(ss => ss.id === statSetId);
  
  // The mapping is positional: sparse array index N → static.stats[N]
  const staticStat = statSet.static.stats[sparseIndex];
  const perLevelValue = statSet.per_level[level]?.stats?.[sparseIndex];
  
  return {
    statId: staticStat.id,
    type: staticStat.type,       // e.g., "constant", "additional"
    value: perLevelValue?.value, // null if not present in per-level sparse array
  };
}
```

### Worked Example: Gas Grenade Level 1 Index 8

**Input:**
- Skill ID: `ToxicGrenadePlayer`
- Stat Set ID: `ToxicGrenadePlayer` (stat_sets[0])
- Level: `"1"`
- Sparse array index: `8`

**Lookup:**
```javascript
const skill = SKILLS_DATA["ToxicGrenadePlayer"];
const statSet = skill.stat_sets[0]; // id === "ToxicGrenadePlayer"

// Get the per-level sparse array entry
const perLevelEntry = statSet.per_level["1"].stats[8];
// → {"value": 14}

// Get the corresponding static stat definition
const staticStat = statSet.static.stats[8];
// → {
//     "id": "active_skill_base_area_of_effect_radius",
//     "type": "additional"
//   }
```

**Result:**
| Field | Value |
|-------|-------|
| **Stat ID** | `active_skill_base_area_of_effect_radius` |
| **Per-level value** | `14` |
| **Type** | `additional` |
| **Display text** | From `stat_text`: `"Impact radius is 1.4 metres"` |

The sparse array value `14` represents a **per-level override** or **addition** to the base stat (defined in `static.stats[8]`). The `type: "additional"` suggests this value gets added to skill calculations.

### Caveats

1. **Only applies when sparse array exists:** Not all skills have per-level sparse arrays. Simpler skills (e.g., Galvanic Shards) have `static.stats` only and no per-level `stats` field.

2. **Array length must match:** The sparse array length must equal or be less than the length of `static.stats`. If index is out of bounds, the stat is not defined.

3. **Null entries are intentional:** A `null` at position N means that stat has no per-level override; use the static definition only.

4. **Only in RePoE2:** This mapping is sourced from RePoE2 JSON. No additional transformation needed; the data is already structured correctly.

### Key Files

- **RePoE2 source:** https://repoe-fork.github.io/poe2/skills.min.json (13 MB)
- **Example data:** `ToxicGrenadePlayer` (Gas Grenade) at stat_sets[0] (Impact damage stage)
