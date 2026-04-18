#!/usr/bin/env node
/**
 * Downloads zone layout images from Mobalytics CDN.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST = join(__dirname, "..", "public", "assets", "layouts");

const IMAGES = [
  // Act 1
  ["Clearfell-Seed-1-Pilot.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Clearfell-Seed-1-Pilot.png"],
  ["Clearfell-Seed-2-Pilot.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Clearfell-Seed-2-Pilot.png"],
  ["Grelwood-Pilot.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Grelwood-Pilot.png"],
  ["Red-Vale-Pilot.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Red-Vale-Pilot.png"],
  ["Grim-Tangle-Pilot.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Grim-Tangle-Pilot.png"],
  ["Cemetery-Pilot.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Cemetery-Pilot.png"],
  ["Praetor-Pilot.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Praetor-Pilot.png"],
  ["Consort-Pilot.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Consort-Pilot.png"],
  ["Hunting-Grounds-Pilot.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Hunting-Grounds-Pilot.png"],
  ["Hunting-Grounds-Boss.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Hunting-Grounds-Boss.png"],
  ["Freythorn-Pilot.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Freythorn-Pilot.png"],
  ["Ogham-Farmlands-Pilot.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Ogham-Farmlands-Pilot.png"],
  ["Ogham-Clue.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Ogham-Clue.png"],
  ["Ogham-Village-Pilot.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Ogham-Village-Pilot.png"],
  ["Manor-Ramparts-Pilot.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Manor-Ramparts-Pilot.png"],
  ["Ogham-Manor-First.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Ogham-Manor-First.png"],
  ["Ogham-Manor-Second.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Ogham-Manor-Second.png"],
  ["Ogham-Manor-Third.png", "https://cdn.mobalytics.gg/assets/poe-2/images/layouts/Ogham-Manor-Third.png"],
  // Act 2
  ["A2-01-Vastiri-Outskirts-No-Text.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-01-Vastiri-Outskirts-No-Text.png"],
  ["A2-02-Mawdun-Quarry.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-02-Mawdun-Quarry.png"],
  ["A2-03-Mawdun-Mine.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-03-Mawdun-Mine.png"],
  ["A2-04-Traitors-Passage.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-04-Traitors-Passage.png"],
  ["A2-04-Traitors-Passage-ESS.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-04-Traitors-Passage-ESS.png"],
  ["A2-05-Halani-Gates.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-05-Halani-Gates.png"],
  ["A2-06-Keth.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-06-Keth.png"],
  ["A2-07-Lost-City.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-07-Lost-City.png"],
  ["A2-08-Buried-Shrines.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-08-Buried-Shrines.png"],
  ["A2-09-Valley-Of-The-Titans.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-09-Valley-Of-The-Titans.png"],
  ["A2-10-Titan-Grotto.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-10-Titan-Grotto.png"],
  ["A2-11-Deshar.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-11-Deshar.png"],
  ["A2-12-Path-Of-Mourning.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-12-Path-Of-Mourning.png"],
  ["A2-13-Mastodon-Badlands.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-13-Mastodon-Badlands.png"],
  ["A2-14-Bone-Pits.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-14-Bone-Pits.png"],
  ["A2-15-Spires-of-Deshar.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-15-Spires-of-Deshar.png"],
  ["A2-16-Dreadnought.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a2-layouts/A2-16-Dreadnought.png"],
  // Act 3
  ["A3-01-Sandswept-Marsh.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-01-Sandswept-Marsh.png"],
  ["A3-02-Jungle-Ruins-2.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-02-Jungle-Ruins-2.png"],
  ["A3-03-Infested-Barrens.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-03-Infested-Barrens.png"],
  ["A3-14-Azak-Bog.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-14-Azak-Bog.png"],
  ["A3-04-Chimeral-Wetlands.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-04-Chimeral Wetlands.png"],
  ["A3-05-Jinquanis-Machinarium.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-05-Jinquanis-Machinarium.png"],
  ["A3-06-Jinquanis-Sanctum.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-06-Jinquanis-Sanctum.png"],
  ["A3-07-Matlan-Waterways.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-07-Matlan-Waterways.png"],
  ["A3-Drowned-City-Update.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A3-Drowned-City-Update.png"],
  ["A3-Apex-of-Filth-Updated.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A3-Apex-of-Filth-Updated.png"],
  ["A3-10-Temple-of-Kopec.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-10-Temple-of-Kopec.png"],
  ["A3-Utzaal.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/a3-utzaal.png"],
  ["A3-12-Aggorat.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-12-Aggorat.png"],
  ["A3-13-Black-Chambers.png", "https://cdn.mobalytics.gg/assets/poe-2/images/guides/a3-layouts/A3-13-Black-Chambers.png"],
  // Act 4
  ["A4-01-Isle_of_Kin.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-01-Isle_of_Kin.png"],
  ["A4-02-Volcanic-Warrens.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-02-Volcanic-Warrens.png"],
  ["A4-03-Kedge-Bay.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-03-Kedge%20Bay.png"],
  ["A4-04-Journeys_End.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-04-Journeys_End.png"],
  ["A4-05-Shrike-Island.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-05-Shrike%20Island.png"],
  ["A4-06-Whakapanu_Island.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-06-Whakapanu_Island.png"],
  ["A4-07-Singing-Caverns.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-07-Singing-Caverns.png"],
  ["A4-09-Solitary-Confinement.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-09-Solitary-Confinement.png"],
  ["A4-10-Eye-of-Hinekora.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-10-Eye%20of%20Hinekora.png"],
  ["A4-11-Halls-of-the-Dead.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-11-Halls-of-the-Dead.png"],
  ["A4-12-Arastas.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-12-Arastas.png"],
  ["A4-13-Excavation.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-13-Excavation.png"],
  ["A4-14-Ngakanu.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-14-Ngakanu.png"],
  ["A4-15-Heart-of-the-tribe.png", "https://cdn.mobalytics.gg/uploads/images/poe-2/A4-15-Heart-of-the-tribe.png"],
];

async function fileExists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function main() {
  await mkdir(DEST, { recursive: true });
  console.log(`Downloading ${IMAGES.length} layout images to ${DEST}...\n`);

  let downloaded = 0, skipped = 0, failed = 0;

  for (const [filename, url] of IMAGES) {
    const dest = join(DEST, filename);
    if (await fileExists(dest)) { skipped++; continue; }
    try {
      const resp = await fetch(url);
      if (!resp.ok) { console.log(`  FAIL ${resp.status}: ${filename}`); failed++; continue; }
      const buffer = Buffer.from(await resp.arrayBuffer());
      await writeFile(dest, buffer);
      downloaded++;
      console.log(`  OK: ${filename}`);
    } catch (err) {
      console.log(`  ERR: ${filename} - ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
}

main();
