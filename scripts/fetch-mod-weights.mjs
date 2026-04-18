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

// The sheet's BASE labels (e.g. "HELMET (INT)", "BOOTS (DEX/INT)") define a
// granularity RePoE's tag system can't represent — an "int_armour" tag is
// shared across helmet/boots/gloves/body, so a helmet-only mod would leak
// onto boots if we overlaid by tag. We keep the sheet label as the key and
// resolve to it at runtime from (itemClass + attribute tag).

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

  const weights = {}; // { [modId]: { [sheetBase]: weight } }
  let matched = 0, skippedNoWeights = 0;

  for (const [key, idEntry] of idsByKey.entries()) {
    const weightEntry = weightsByKey.get(key);
    if (!weightEntry) { skippedNoWeights++; continue; }
    for (let t = 0; t < TIER_COLS; t++) {
      const id = idEntry.tiers[t];
      const wStr = weightEntry.tiers[t];
      if (!id || !wStr) continue;
      const w = Number(wStr);
      if (!Number.isFinite(w) || w <= 0) continue;
      if (!weights[id]) weights[id] = {};
      weights[id][idEntry.base] = w;
      matched++;
    }
  }

  await writeFile(OUT, JSON.stringify(weights, null, 2));
  const uniqueMods = Object.keys(weights).length;
  console.log(`\n  Wrote weights for ${uniqueMods} mods → ${OUT}`);
  console.log(`  matched tier cells: ${matched}, skipped (no weight row): ${skippedNoWeights}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
