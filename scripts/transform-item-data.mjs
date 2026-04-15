#!/usr/bin/env node
/**
 * transform-item-data.mjs
 *
 * Downloads PoE2 item data from RePoE (https://repoe-fork.github.io/poe2/)
 * and transforms it into lean JSON files matching our TypeScript interfaces.
 *
 * Usage:
 *   node scripts/transform-item-data.mjs             # full run with art downloads
 *   node scripts/transform-item-data.mjs --skip-art  # skip art asset downloads
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RAW_DIR = join(ROOT, "src", "data", "raw");
const ITEMS_ART_DIR = join(ROOT, "public", "assets", "items");
const GEMS_ART_DIR = join(ROOT, "public", "assets", "gems");

const REPOE_BASE = "https://repoe-fork.github.io/poe2";
const REPOE_SOURCES = {
  base_items: `${REPOE_BASE}/base_items.min.json`,
  mods: `${REPOE_BASE}/mods.min.json`,
  uniques: `${REPOE_BASE}/uniques.min.json`,
  skill_gems: `${REPOE_BASE}/skill_gems.min.json`,
  skills: `${REPOE_BASE}/skills.min.json`,
  augments: `${REPOE_BASE}/augments.min.json`,
};

const SKIP_ART = process.argv.includes("--skip-art");

const EQUIPMENT_CLASSES = new Set([
  "Claw", "Dagger", "Wand",
  "One Hand Sword", "Two Hand Sword",
  "One Hand Axe", "Two Hand Axe",
  "One Hand Mace", "Two Hand Mace",
  "Sceptre", "Staff", "Warstaff",
  "Spear", "Flail", "Bow", "Crossbow",
  "Focus", "TrapTool",
  "Body Armour", "Helmet", "Gloves", "Boots", "Shield", "Buckler",
  "Amulet", "Ring", "Belt", "Quiver",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJSON(url) {
  console.log(`  Fetching ${url} ...`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

async function fetchHTML(url) {
  console.log(`  Fetching ${url} ...`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.text();
}

function iconPathFromDds(ddsFile, prefix) {
  if (!ddsFile) return "";
  const filename = basename(ddsFile).replace(/\.dds$/i, ".webp");
  return `${prefix}/${filename}`;
}

function artUrlFromDds(ddsFile) {
  if (!ddsFile) return null;
  return `${REPOE_BASE}/${ddsFile.replace(/\.dds$/i, ".webp")}`;
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download files in parallel with a concurrency limit.
 * Skips files that already exist on disk.
 */
async function downloadArt(items, destDir, concurrency = 15) {
  await mkdir(destDir, { recursive: true });

  let completed = 0;
  let skipped = 0;
  let failed = 0;
  const total = items.length;

  const queue = [...items];

  async function worker() {
    while (queue.length > 0) {
      const { url, filename } = queue.shift();
      const dest = join(destDir, filename);

      if (await fileExists(dest)) {
        skipped++;
        completed++;
        if (completed % 50 === 0) {
          console.log(`    Art progress: ${completed}/${total} (${skipped} skipped, ${failed} failed)`);
        }
        continue;
      }

      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          failed++;
          completed++;
          continue;
        }
        const buffer = Buffer.from(await resp.arrayBuffer());
        await writeFile(dest, buffer);
      } catch {
        failed++;
      }
      completed++;
      if (completed % 50 === 0) {
        console.log(`    Art progress: ${completed}/${total} (${skipped} skipped, ${failed} failed)`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  console.log(`    Art done: ${completed} total, ${skipped} skipped, ${failed} failed`);
}

// ---------------------------------------------------------------------------
// Transform: Base Items
// ---------------------------------------------------------------------------

/** Strip RePoE stat markup like [InternalName|Display Text] → Display Text */
function cleanModText(text) {
  return text
    .replace(/\[([^|\]]*)\|([^\]]*)\]/g, "$2")
    .replace(/\[([^\]]*)\]/g, "$1")
    .replace(/\{[^}]+\}/g, "");  // strip {stat_id} placeholders like {base_cooldown_speed_+%}
}

function transformBaseItems(raw, rawMods) {
  const results = [];

  for (const [key, item] of Object.entries(raw)) {
    if (item.release_state !== "released") continue;
    if (!EQUIPMENT_CLASSES.has(item.item_class)) continue;
    if (item.name?.includes("[DNT")) continue;

    const props = item.properties || {};

    // Skip armour pieces with no defence stats (demigods/race rewards)
    const ARMOUR_CLASSES = new Set(["Body Armour", "Helmet", "Gloves", "Boots", "Shield", "Buckler"]);
    if (ARMOUR_CLASSES.has(item.item_class) && !props.armour && !props.evasion && !props.energy_shield) continue;
    const reqs = item.requirements || {};

    // Resolve implicit mod IDs to display text
    const implicits = (item.implicits ?? [])
      .map((modId) => {
        const mod = rawMods[modId];
        if (mod?.text) return cleanModText(mod.text);
        return null;
      })
      .filter(Boolean);

    results.push({
      id: key,
      name: item.name,
      itemClass: item.item_class,
      dropLevel: item.drop_level ?? 0,
      requirements: {
        level: reqs.level ?? 0,
        strength: reqs.strength ?? 0,
        dexterity: reqs.dexterity ?? 0,
        intelligence: reqs.intelligence ?? 0,
      },
      properties: {
        ...(props.physical_damage_min != null && { physicalDamageMin: props.physical_damage_min }),
        ...(props.physical_damage_max != null && { physicalDamageMax: props.physical_damage_max }),
        ...(props.attack_time != null && { attackTime: props.attack_time }),
        ...(props.critical_strike_chance != null && { criticalStrikeChance: props.critical_strike_chance }),
        ...(props.range != null && { range: props.range }),
        ...(props.armour && { armour: { min: props.armour.min, max: props.armour.max } }),
        ...(props.evasion && { evasion: { min: props.evasion.min, max: props.evasion.max } }),
        ...(props.energy_shield && { energyShield: { min: props.energy_shield.min, max: props.energy_shield.max } }),
      },
      implicits,
      tags: item.tags ?? [],
      iconPath: iconPathFromDds(item.visual_identity?.dds_file, "items"),
    });
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

// ---------------------------------------------------------------------------
// Transform: Mods
// ---------------------------------------------------------------------------

function transformMods(raw) {
  const results = [];

  for (const [key, mod] of Object.entries(raw)) {
    if (mod.domain !== "item") continue;
    if (mod.generation_type !== "prefix" && mod.generation_type !== "suffix") continue;
    if (!mod.text) continue;

    const spawnWeights = (mod.spawn_weights || [])
      .map((w) => ({ tag: w.tag, weight: w.weight }));

    // Must have at least one positive weight to be rollable
    if (!spawnWeights.some((w) => w.weight > 0)) continue;

    const groups = mod.groups || [];

    results.push({
      id: key,
      name: mod.name || "",
      text: mod.text,
      type: mod.type || "",
      generationType: mod.generation_type,
      group: groups[0] || mod.type || "",
      requiredLevel: mod.required_level ?? 0,
      stats: (mod.stats || []).map((s) => ({
        id: s.id,
        min: s.min,
        max: s.max,
      })),
      spawnWeights,
      tags: mod.implicit_tags || [],
    });
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

// ---------------------------------------------------------------------------
// Transform: Uniques
// ---------------------------------------------------------------------------

/**
 * Scrape unique item mods from poe2db.tw.
 * Returns a Map<string, string[]> of item name → mod text array.
 *
 * The HTML structure per unique is:
 *   <span class="uniqueName">Name</span>
 *   ... followed by <div class="explicitMod">mod text</div> siblings
 */
function parseUniqueMods(html) {
  const modsByName = new Map();

  // Match each unique item block: uniqueName followed by explicitMod divs
  // Each item is in a flex container: <div class="flex-grow-1 ms-2">
  const blockRe = /<div class="flex-grow-1 ms-2">([\s\S]*?)(?=<div class="flex-grow-1 ms-2">|<\/div>\s*<\/div>\s*<\/div>\s*<div class="col">|$)/g;

  // Simpler approach: find all uniqueName spans and their following explicitMod divs
  const nameRe = /<span class="uniqueName">(.*?)<\/span>/g;
  const names = [];
  let m;
  while ((m = nameRe.exec(html)) !== null) {
    names.push({ name: m[1], index: m.index });
  }

  for (let i = 0; i < names.length; i++) {
    const start = names[i].index;
    const end = i + 1 < names.length ? names[i + 1].index : html.length;
    const chunk = html.slice(start, end);

    const mods = [];
    const modRe = /<div class="explicitMod">([\s\S]*?)<\/div>/g;
    let mm;
    while ((mm = modRe.exec(chunk)) !== null) {
      // Strip HTML tags but keep the text content, normalize dashes
      let text = mm[1]
        .replace(/<span class="ndash">.*?<\/span>/g, "-")        // regular dash for ranges
        .replace(/<[^>]+>/g, "")                                   // strip all tags
        .replace(/\s+/g, " ")                                     // normalize whitespace
        .trim();
      // Skip internal/visual mods (real mods start with uppercase, +, (, or digit)
      if (text && /^[A-Z+(0-9\-"]/.test(text)) mods.push(text);
    }

    if (mods.length > 0) {
      modsByName.set(names[i].name, mods);
    }
  }

  return modsByName;
}

function transformUniques(raw, uniqueModsMap) {
  const results = [];

  for (const [key, item] of Object.entries(raw)) {
    if (!EQUIPMENT_CLASSES.has(item.item_class)) continue;

    results.push({
      id: key,
      name: item.name,
      itemClass: item.item_class,
      iconPath: iconPathFromDds(item.visual_identity?.dds_file, "items"),
      mods: uniqueModsMap.get(item.name) ?? [],
    });
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

// ---------------------------------------------------------------------------
// Transform: Augments (Runes, Soul Cores, Idols, Abyssal Eyes)
// ---------------------------------------------------------------------------

function nameFromKey(metaKey) {
  // "Metadata/Items/SoulCores/RuneAccuracy" → "Accuracy Rune"
  const last = metaKey.split("/").pop();
  // Split camelCase/PascalCase
  const words = last.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  // Move prefix type to end: "Rune Accuracy" → "Accuracy Rune", "Soul Core Bleed" → "Bleed Soul Core"
  const parts = words.split(" ");
  if (parts[0] === "Rune" && parts.length > 1) return parts.slice(1).join(" ") + " Rune";
  if (parts[0] === "Soul" && parts[1] === "Core" && parts.length > 2) return parts.slice(2).join(" ") + " Soul Core";
  if (parts[0] === "Talisman" && parts.length > 1) return parts.slice(1).join(" ") + " Idol";
  return words;
}

function transformAugments(raw) {
  const results = [];

  for (const [key, aug] of Object.entries(raw)) {
    const name = nameFromKey(key);
    const typeId = aug.type_id;
    const typeName = aug.type_name
      ? aug.type_name.replace(/\[([^|]*)\|?([^\]]*)\]/g, (_, a, b) => b || a)
      : typeId;

    // Build effects per equipment category
    const effects = {};
    for (const [catKey, cat] of Object.entries(aug.categories || {})) {
      effects[catKey] = {
        target: cat.target,
        statText: (cat.stat_text || []).map(cleanModText),
        bondedStatText: (cat.bonded_stat_text || []).map(cleanModText),
      };
    }

    results.push({
      id: key,
      name,
      typeId,
      typeName,
      requiredLevel: aug.required_level ?? 0,
      limit: aug.limit ?? null,
      effects,
    });
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

// ---------------------------------------------------------------------------
// Transform: Gems
// ---------------------------------------------------------------------------

function transformGems(raw, rawSkills) {
  const results = [];

  for (const [key, gem] of Object.entries(raw)) {
    if (gem.base_item?.release_state !== "released") continue;
    if (gem.base_item.display_name?.includes("[DNT")) continue;
    if (gem.base_item.display_name === "Coming Soon") continue;
    const isLineage = (gem.tags || []).includes("lineage");
    if ((gem.crafting_level ?? 0) === 0 && !isLineage) continue;

    // Look up skill details from all grants_skills
    const grantedSkills = (gem.grants_skills || [])
      .map((id) => rawSkills[id])
      .filter(Boolean);

    let skillDetail = undefined;
    if (grantedSkills.length > 0) {
      // Use the primary skill (most stat_sets) for top-level info
      const primary = [...grantedSkills].sort((a, b) => (b.stat_sets?.length ?? 0) - (a.stat_sets?.length ?? 0))[0];
      const perLevelKeys = Object.keys(primary.per_level || {}).map(Number);
      const maxLevel = perLevelKeys.length > 0 ? Math.max(...perLevelKeys) : 0;

      // Helper to extract stat sets from a skill
      function extractStatSets(skill, fallbackName) {
        return (skill.stat_sets || []).map((ss) => {
          const levels = {};
          for (const [lvl, data] of Object.entries(skill.per_level || {})) {
            const ssLevel = ss.per_level?.[lvl];
            levels[lvl] = {
              costs: data.costs || {},
              damageMultiplier: ssLevel?.damage_multiplier,
              statText: ssLevel?.stat_text
                ? Object.values(ssLevel.stat_text).map((t) => cleanModText(t))
                : [],
            };
          }
          const staticStatText = ss.static?.stat_text
            ? Object.values(ss.static.stat_text).map((t) => cleanModText(t))
            : [];
          const qualityStats = (ss.static?.quality_stats || [])
            .map((qs) => {
              const template = qs.stat
                .replace(/\[([^|\]]*)\|([^\]]*)\]/g, "$2")
                .replace(/\[([^\]]*)\]/g, "$1");
              const values = {};
              for (const [statId, v] of Object.entries(qs.stats || {})) {
                values[statId] = v;
              }
              return { template, values };
            })
            .filter((qs) => qs.template && qs.template.trim());

          const labelName = Array.isArray(ss.label) ? ss.label[1] : null;
          const skillName = rawSkills[ss.id]?.active_skill?.display_name;
          const rawName = labelName || skillName || fallbackName;
          const isHidden = Array.isArray(ss.label) && ss.label[0] === "Hidden";
          return { name: rawName, levels, staticStatText, qualityStats, isHidden };
        }).filter((ss) => !ss.isHidden);
      }

      // Collect stat sets from ALL granted skills
      const allStatSets = [];
      for (const skill of grantedSkills) {
        const name = skill.active_skill?.display_name || "Unknown";
        const sets = extractStatSets(skill, name);
        allStatSets.push(...sets);
      }

      // Primary stat sets (from the main skill)
      const primarySets = extractStatSets(primary, primary.active_skill?.display_name || gem.base_item.display_name);

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
    }

    results.push({
      id: key,
      name: gem.base_item.display_name,
      gemType: gem.gem_type,
      color: gem.color || "w",
      craftingLevel: gem.crafting_level ?? 0,
      craftingTypes: gem.crafting_types ?? [],
      tags: gem.tags ?? [],
      ...(gem.support_text && { supportText: gem.support_text }),
      recommendedSupports: gem.recommended_supports ?? [],
      requirementWeights: {
        strength: gem.requirement_weights?.strength ?? 0,
        dexterity: gem.requirement_weights?.dexterity ?? 0,
        intelligence: gem.requirement_weights?.intelligence ?? 0,
      },
      iconPath: iconPathFromDds(gem.icon_dds_file, "gems"),
      ...(skillDetail && { skillDetail }),
    });
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

// ---------------------------------------------------------------------------
// Art collection
// ---------------------------------------------------------------------------

function collectItemArt(rawBaseItems, rawUniques) {
  const seen = new Set();
  const items = [];

  // Base items
  for (const [, item] of Object.entries(rawBaseItems)) {
    if (item.release_state !== "released") continue;
    if (!EQUIPMENT_CLASSES.has(item.item_class)) continue;
    const dds = item.visual_identity?.dds_file;
    if (!dds) continue;
    const filename = basename(dds).replace(/\.dds$/i, ".webp");
    if (seen.has(filename)) continue;
    seen.add(filename);
    items.push({ url: artUrlFromDds(dds), filename });
  }

  // Uniques
  for (const [, item] of Object.entries(rawUniques)) {
    if (!EQUIPMENT_CLASSES.has(item.item_class)) continue;
    const dds = item.visual_identity?.dds_file;
    if (!dds) continue;
    const filename = basename(dds).replace(/\.dds$/i, ".webp");
    if (seen.has(filename)) continue;
    seen.add(filename);
    items.push({ url: artUrlFromDds(dds), filename });
  }

  return items;
}

function collectGemArt(rawGems) {
  const seen = new Set();
  const items = [];

  for (const [, gem] of Object.entries(rawGems)) {
    if (gem.base_item?.release_state !== "released") continue;
    const dds = gem.icon_dds_file;
    if (!dds) continue;
    const filename = basename(dds).replace(/\.dds$/i, ".webp");
    if (seen.has(filename)) continue;
    seen.add(filename);
    items.push({ url: artUrlFromDds(dds), filename });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== RePoE Item Data Transform ===\n");

  // Ensure output directories
  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(ITEMS_ART_DIR, { recursive: true });
  await mkdir(GEMS_ART_DIR, { recursive: true });

  // 1. Download source data
  console.log("1. Downloading source data...");
  const [rawBaseItems, rawMods, rawUniques, rawGems, rawSkills, rawAugments, poe2dbHtml] = await Promise.all([
    fetchJSON(REPOE_SOURCES.base_items),
    fetchJSON(REPOE_SOURCES.mods),
    fetchJSON(REPOE_SOURCES.uniques),
    fetchJSON(REPOE_SOURCES.skill_gems),
    fetchJSON(REPOE_SOURCES.skills),
    fetchJSON(REPOE_SOURCES.augments),
    fetchHTML("https://poe2db.tw/us/Unique_item").catch((err) => {
      console.warn(`   Warning: Could not fetch poe2db unique mods: ${err.message}`);
      return "";
    }),
  ]);
  console.log("   Downloads complete.\n");

  // 2. Transform data
  console.log("2. Transforming data...");
  const uniqueModsMap = parseUniqueMods(poe2dbHtml);
  console.log(`   Unique mods scraped: ${uniqueModsMap.size} items with mods`);
  const baseItems = transformBaseItems(rawBaseItems, rawMods);
  const mods = transformMods(rawMods);
  const uniques = transformUniques(rawUniques, uniqueModsMap);
  const gems = transformGems(rawGems, rawSkills);
  const augments = transformAugments(rawAugments);

  console.log(`   Base items: ${baseItems.length}`);
  console.log(`   Mods:       ${mods.length}`);
  console.log(`   Uniques:    ${uniques.length}`);
  console.log(`   Gems:       ${gems.length}`);
  console.log(`   Augments:   ${augments.length}`);
  console.log();

  // 3. Write JSON files
  console.log("3. Writing JSON files...");
  await Promise.all([
    writeFile(join(RAW_DIR, "base_items.json"), JSON.stringify(baseItems, null, 2)),
    writeFile(join(RAW_DIR, "item_mods.json"), JSON.stringify(mods, null, 2)),
    writeFile(join(RAW_DIR, "uniques.json"), JSON.stringify(uniques, null, 2)),
    writeFile(join(RAW_DIR, "skill_gems.json"), JSON.stringify(gems, null, 2)),
    writeFile(join(RAW_DIR, "augments.json"), JSON.stringify(augments, null, 2)),
  ]);
  console.log("   JSON files written to src/data/raw/\n");

  // 4. Download art assets
  if (SKIP_ART) {
    console.log("4. Skipping art downloads (--skip-art flag)\n");
  } else {
    console.log("4. Downloading art assets...");

    const itemArt = collectItemArt(rawBaseItems, rawUniques);
    const gemArt = collectGemArt(rawGems);

    console.log(`   Items to download: ${itemArt.length}`);
    console.log(`   Gems to download:  ${gemArt.length}`);

    console.log("\n   Downloading item art...");
    await downloadArt(itemArt, ITEMS_ART_DIR, 15);

    console.log("   Downloading gem art...");
    await downloadArt(gemArt, GEMS_ART_DIR, 15);

    console.log();
  }

  console.log("=== Done ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
