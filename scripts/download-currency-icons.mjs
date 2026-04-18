#!/usr/bin/env node
/**
 * Downloads PoE2 currency icons from the RePoE-fork CDN as .webp into
 * public/assets/currency/ so the craft emulator can render them.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST = join(__dirname, "..", "public", "assets", "currency");
const CDN = "https://repoe-fork.github.io/poe2";

const ICONS = [
  ["transmute.webp", "Art/2DItems/Currency/CurrencyUpgradeToMagic.webp"],
  ["augment.webp",   "Art/2DItems/Currency/CurrencyAddModToMagic.webp"],
  ["regal.webp",     "Art/2DItems/Currency/CurrencyUpgradeMagicToRare.webp"],
  ["alchemy.webp",   "Art/2DItems/Currency/CurrencyUpgradeToRare.webp"],
  ["exalt.webp",     "Art/2DItems/Currency/CurrencyAddModToRare.webp"],
  ["chaos.webp",     "Art/2DItems/Currency/CurrencyRerollRare.webp"],
  ["annul.webp",     "Art/2DItems/Currency/AnnullOrb.webp"],
  ["divine.webp",    "Art/2DItems/Currency/CurrencyModValues.webp"],
  ["vaal.webp",      "Art/2DItems/Currency/CurrencyVaal.webp"],
];

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function main() {
  await mkdir(DEST, { recursive: true });
  console.log(`Downloading ${ICONS.length} currency icons to ${DEST}...`);
  let ok = 0, skip = 0, fail = 0;
  for (const [filename, path] of ICONS) {
    const dest = join(DEST, filename);
    if (await exists(dest)) { skip++; continue; }
    try {
      const resp = await fetch(`${CDN}/${path}`);
      if (!resp.ok) { console.log(`  FAIL ${resp.status}: ${filename}`); fail++; continue; }
      const buf = Buffer.from(await resp.arrayBuffer());
      await writeFile(dest, buf);
      ok++;
      console.log(`  OK: ${filename}`);
    } catch (e) {
      console.log(`  ERR: ${filename} — ${e.message}`);
      fail++;
    }
  }
  console.log(`\nDone: ${ok} downloaded, ${skip} skipped, ${fail} failed`);
}

main();
