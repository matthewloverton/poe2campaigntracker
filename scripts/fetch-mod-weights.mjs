#!/usr/bin/env node
/**
 * fetch-mod-weights.mjs
 *
 * Pulls spawn-weight data from the PoE2 mods Google Sheet and joins it to our
 * mod pool (via the ID column in a separate sheet tab), producing
 * src/data/raw/mod_weights.json as { [repoeModId]: { [tag]: weight } }.
 *
 * RePoE only carries binary 0/1 per tag. The sheet has the real in-game
 * weights (1000, 800, 500, 250, …) that actually bias mod rolls. Weights
 * vary by base subtype (e.g. Dexterity mod is 500 on dex/int hybrid boots
 * but 1000 on pure dex boots), so storage is per-mod-per-tag.
 */

import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "src", "data", "raw", "mod_weights.json");

const SHEET_ID = "1QSAu0A-ZKcHFlQ5QCcUJSMb0ebXq1nxpGRUVgHXVjW8";
const WEIGHTS_GID = "1418797281";
const IDS_GID = "1257586048";
const TIER_COLS = 13;

/**
 * Sheet BASE label → specific RePoE tag that should carry the weight.
 * We deliberately target the subtype-specific tag (e.g. str_armour) rather
 * than the slot tag (e.g. boots), so the game's spawn-weight walk finds the
 * precise entry before falling back to broader ones.
 */
const BASE_TAG_MAP = {
  "AMULET": "amulet",
  "BELT": "belt",
  "RING": "ring",
  "QUIVER": "quiver",
  "BUCKLER": "buckler",
  "FOCUS": "focus",
  "BOW": "bow",
  "CROSSBOW": "crossbow",
  "SPEAR": "spear",
  "STAFF": "staff",
  "WARSTAFF": "warstaff",
  "WAND": "wand",
  "SCEPTRE": "sceptre",
  "TALISMAN": "talisman",
  "ONE HAND MACE": "one_hand_mace",
  "TWO HAND MACE": "two_hand_mace",
  // Elemental staves/wands all share their base tag — negative tags
  // (no_fire_spell_mods etc.) handle cross-element exclusion.
  "FIRE STAFF": "staff",
  "ICE STAFF": "staff",
  "LIGHTNING STAFF": "staff",
  "CHAOS STAFF": "staff",
  "PHYSICAL STAFF": "staff",
  "FIRE WAND": "wand",
  "ICE WAND": "wand",
  "LIGHTNING WAND": "wand",
  "CHAOS WAND": "wand",
  "PHYSICAL WAND": "wand",
  // Attribute-variant armours
  "BODY ARMOUR (STR)": "str_armour",
  "BODY ARMOUR (DEX)": "dex_armour",
  "BODY ARMOUR (INT)": "int_armour",
  "BODY ARMOUR (STR/DEX)": "str_dex_armour",
  "BODY ARMOUR (STR/INT)": "str_int_armour",
  "BODY ARMOUR (DEX/INT)": "dex_int_armour",
  "BOOTS (STR)": "str_armour",
  "BOOTS (DEX)": "dex_armour",
  "BOOTS (INT)": "int_armour",
  "BOOTS (STR/DEX)": "str_dex_armour",
  "BOOTS (STR/INT)": "str_int_armour",
  "BOOTS (DEX/INT)": "dex_int_armour",
  "GLOVES (STR)": "str_armour",
  "GLOVES (DEX)": "dex_armour",
  "GLOVES (INT)": "int_armour",
  "GLOVES (STR/DEX)": "str_dex_armour",
  "GLOVES (STR/INT)": "str_int_armour",
  "GLOVES (DEX/INT)": "dex_int_armour",
  "HELMET (STR)": "str_armour",
  "HELMET (DEX)": "dex_armour",
  "HELMET (INT)": "int_armour",
  "HELMET (STR/DEX)": "str_dex_armour",
  "HELMET (STR/INT)": "str_int_armour",
  "HELMET (DEX/INT)": "dex_int_armour",
  "SHIELD (STR)": "str_armour",
  "SHIELD (STR/DEX)": "str_dex_armour",
  "SHIELD (STR/INT)": "str_int_armour",
};

function csvUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else { field += c; }
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function fetchSheet(gid) {
  console.log(`  Fetching sheet gid=${gid}…`);
  const resp = await fetch(csvUrl(gid));
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching gid=${gid}`);
  return parseCsv(await resp.text());
}

function indexByRow(rows) {
  const out = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const base = (r[0] ?? "").trim();
    const type = (r[1] ?? "").trim();
    const name = (r[2] ?? "").trim();
    if (!base || !type || !name) continue;
    const key = `${base}||${type}||${name}`;
    const tiers = [];
    for (let t = 0; t < TIER_COLS; t++) tiers.push((r[3 + t] ?? "").trim());
    out.set(key, { base, type, name, tiers });
  }
  return out;
}

async function main() {
  const [weightsRows, idsRows] = await Promise.all([
    fetchSheet(WEIGHTS_GID),
    fetchSheet(IDS_GID),
  ]);

  const weightsByKey = indexByRow(weightsRows);
  const idsByKey = indexByRow(idsRows);

  const weights = {}; // { [modId]: { [tag]: weight } }
  const unmappedBases = new Set();
  const conflicts = [];
  let matched = 0, skippedNoWeights = 0, skippedNoTag = 0;

  for (const [key, idEntry] of idsByKey.entries()) {
    const weightEntry = weightsByKey.get(key);
    if (!weightEntry) { skippedNoWeights++; continue; }
    const tag = BASE_TAG_MAP[idEntry.base];
    if (!tag) { unmappedBases.add(idEntry.base); skippedNoTag++; continue; }
    for (let t = 0; t < TIER_COLS; t++) {
      const id = idEntry.tiers[t];
      const wStr = weightEntry.tiers[t];
      if (!id || !wStr) continue;
      const w = Number(wStr);
      if (!Number.isFinite(w) || w <= 0) continue;
      if (!weights[id]) weights[id] = {};
      const existing = weights[id][tag];
      if (existing != null && existing !== w) {
        conflicts.push({ id, tag, existing, incoming: w, base: idEntry.base });
        // Keep the smaller weight — the sheet often has stricter values on
        // hybrid bases, and biasing pessimistic is safer for rarity display.
        weights[id][tag] = Math.min(existing, w);
      } else {
        weights[id][tag] = w;
      }
      matched++;
    }
  }

  if (unmappedBases.size > 0) {
    console.log(`\n  Unmapped base labels (add to BASE_TAG_MAP):`);
    for (const b of [...unmappedBases].sort()) console.log(`    ${b}`);
  }

  if (conflicts.length > 0) {
    console.log(`\n  ${conflicts.length} per-tag conflicts (a mod + same tag appeared with different weights across base slots — kept the smaller):`);
    for (const c of conflicts.slice(0, 10)) {
      console.log(`    ${c.id} on ${c.tag}: ${c.existing} vs ${c.incoming} (${c.base})`);
    }
    if (conflicts.length > 10) console.log(`    … +${conflicts.length - 10} more`);
  }

  await writeFile(OUT, JSON.stringify(weights, null, 2));
  const uniqueMods = Object.keys(weights).length;
  console.log(`\n  Wrote weights for ${uniqueMods} mods → ${OUT}`);
  console.log(`  matched tier cells: ${matched}, skipped (no weight row): ${skippedNoWeights}, skipped (unmapped base): ${skippedNoTag}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
