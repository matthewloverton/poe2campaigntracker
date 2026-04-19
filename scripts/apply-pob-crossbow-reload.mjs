#!/usr/bin/env node
// One-off: port crossbow ReloadTime values from PoB2 into base_items.json.
// Run after re-transforming RePoE2 data until RePoE2 exposes reload_time natively.

import { readFile, writeFile } from "node:fs/promises";

// Map of base-item name → reload time in ms, sourced from:
// https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2 (dev branch),
// src/Data/Bases/crossbow.lua, ReloadTimeBase * 1000.
const RELOAD_MS_BY_NAME = {
  "Makeshift Crossbow": 800,
  "Tense Crossbow": 850,
  "Sturdy Crossbow": 750,
  "Varnished Crossbow": 800,
  "Dyad Crossbow": 1100,
  "Alloy Crossbow": 700,
  "Bombard Crossbow": 750,
  "Construct Crossbow": 800,
  "Blackfire Crossbow": 850,
  "Piercing Crossbow": 850,
  "Cumbrous Crossbow": 900,
  "Dedalian Crossbow": 850,
  "Esoteric Crossbow": 800,
  "Taut Crossbow": 850,
  "Robust Crossbow": 750,
  "Painted Crossbow": 800,
  "Twin Crossbow": 1100,
  "Cannonade Crossbow": 750,
  "Bleak Crossbow": 800,
  "Stout Crossbow": 750,
  "Engraved Crossbow": 800,
  "Flexed Crossbow": 850,
  "Gemini Crossbow": 1100,
  "Siege Crossbow": 750,
  "Desolate Crossbow": 800,
  "Elegant Crossbow": 850,
};

const BASES_PATH = "src/data/raw/base_items.json";

async function main() {
  const items = JSON.parse(await readFile(BASES_PATH, "utf8"));
  let updated = 0;
  const missing = [];
  for (const item of items) {
    if (item.itemClass !== "Crossbow") continue;
    const reload = RELOAD_MS_BY_NAME[item.name];
    if (reload == null) {
      missing.push(item.name);
      continue;
    }
    item.properties = { ...item.properties, reloadTime: reload };
    updated++;
  }
  await writeFile(BASES_PATH, JSON.stringify(items, null, 2));
  console.log(`Updated ${updated} crossbow entries.`);
  if (missing.length) console.warn(`Missing PoB data for:`, missing);
}

main();
