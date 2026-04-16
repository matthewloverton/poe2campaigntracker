#!/usr/bin/env node
/**
 * download-augment-images.mjs
 *
 * Downloads augment images from poe2db CDN and saves them to public/assets/augments/.
 * Also generates a name→iconPath mapping for the data pipeline.
 */

import { mkdir, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const AUG_DIR = join(ROOT, "public", "assets", "augments");

const CDN = "https://cdn.poe2db.tw/image/Art/2DItems/Currency";

/** name → CDN path (relative to CDN base) */
const IMAGE_MAP = {
  // Runes — Lesser
  "Lesser Desert Rune": "Runes/FireRuneTier1.webp",
  "Lesser Glacial Rune": "Runes/ColdRuneTier1.webp",
  "Lesser Storm Rune": "Runes/LightningRuneTier1.webp",
  "Lesser Iron Rune": "Runes/EnhanceRuneTier1.webp",
  "Lesser Body Rune": "Runes/LifeRuneTier1.webp",
  "Lesser Mind Rune": "Runes/ManaRuneTier1.webp",
  "Lesser Rebirth Rune": "Runes/LifeRecoveryRuneTier1.webp",
  "Lesser Inspiration Rune": "Runes/ManaRecoveryRuneTier1.webp",
  "Lesser Stone Rune": "Runes/StunRuneTier1.webp",
  "Lesser Vision Rune": "Runes/AccuracyRuneTier1.webp",
  "Lesser Robust Rune": "Runes/StrengthRuneTier1.webp",
  "Lesser Adept Rune": "Runes/DexRuneTier1.webp",
  "Lesser Resolve Rune": "Runes/IntRuneTier1.webp",
  "Lesser Tempered Rune": "Runes/PhyDmgRuneTier1.webp",
  // Runes — Regular
  "Desert Rune": "Runes/FireRune.webp",
  "Glacial Rune": "Runes/ColdRune.webp",
  "Storm Rune": "Runes/LightningRune.webp",
  "Iron Rune": "Runes/EnhanceRune.webp",
  "Body Rune": "Runes/LifeRune.webp",
  "Mind Rune": "Runes/ManaRune.webp",
  "Rebirth Rune": "Runes/LifeRecoveryRune.webp",
  "Inspiration Rune": "Runes/ManaRecoveryRune.webp",
  "Stone Rune": "Runes/StunRune.webp",
  "Vision Rune": "Runes/AccuracyRune.webp",
  "Robust Rune": "Runes/StrengthRune.webp",
  "Adept Rune": "Runes/DexRune.webp",
  "Resolve Rune": "Runes/IntRune.webp",
  "Tempered Rune": "Runes/PhyDmgRune.webp",
  // Runes — Greater
  "Greater Desert Rune": "Runes/FireRuneTier2.webp",
  "Greater Glacial Rune": "Runes/ColdRuneTier2.webp",
  "Greater Storm Rune": "Runes/LightningRuneTier2.webp",
  "Greater Iron Rune": "Runes/EnhanceRuneTier2.webp",
  "Greater Body Rune": "Runes/LifeRuneTier2.webp",
  "Greater Mind Rune": "Runes/ManaRuneTier2.webp",
  "Greater Rebirth Rune": "Runes/LifeRecoveryRuneTier2.webp",
  "Greater Inspiration Rune": "Runes/ManaRecoveryRuneTier2.webp",
  "Greater Stone Rune": "Runes/StunRuneTier2.webp",
  "Greater Vision Rune": "Runes/AccuracyRuneTier2.webp",
  "Greater Robust Rune": "Runes/StrengthRuneTier3.webp",
  "Greater Adept Rune": "Runes/DexRuneTier3.webp",
  "Greater Resolve Rune": "Runes/IntRuneTier3.webp",
  "Greater Tempered Rune": "Runes/PhyDmgRuneTier3.webp",
  // Special runes
  "Greater Rune of Leadership": "Runes/LightningRuneSpecial1.webp",
  "Greater Rune of Tithing": "Runes/LightningRuneSpecial2.webp",
  "Greater Rune of Alacrity": "Runes/LightningRuneSpecial3.webp",
  "Greater Rune of Nobility": "Runes/LightningRuneSpecial4.webp",
  // Named runes
  "Hedgewitch Assandra's Rune of Wisdom": "Runes/NewRune1.webp",
  "Saqawal's Rune of the Sky": "Runes/NewRune2.webp",
  "Fenumus' Rune of Agony": "Runes/NewRune3.webp",
  "Farrul's Rune of Grace": "Runes/NewRune4.webp",
  "Farrul's Rune of the Chase": "Runes/NewRune5.webp",
  "Craiceann's Rune of Warding": "Runes/NewRune6.webp",
  "Saqawal's Rune of Memory": "Runes/NewRune7.webp",
  "Saqawal's Rune of Erosion": "Runes/NewRune8.webp",
  "Farrul's Rune of the Hunt": "Runes/NewRune9.webp",
  "Craiceann's Rune of Recovery": "Runes/NewRune10.webp",
  "Courtesan Mannan's Rune of Cruelty": "Runes/NewRune11.webp",
  "Thane Grannell's Rune of Mastery": "Runes/NewRune12.webp",
  "Fenumus' Rune of Spinning": "Runes/NewRune13.webp",
  "Countess Seske's Rune of Archery": "Runes/NewRune14.webp",
  "Thane Girt's Rune of Wildness": "Runes/NewRune15.webp",
  "Fenumus' Rune of Draining": "Runes/NewRune16.webp",
  "Thane Myrk's Rune of Summer": "Runes/NewRune17.webp",
  "Lady Hestra's Rune of Winter": "Runes/NewRune18.webp",
  "Thane Leld's Rune of Spring": "Runes/NewRune19.webp",
  "The Greatwolf's Rune of Claws": "Runes/NewRune20.webp",
  "The Greatwolf's Rune of Willpower": "Runes/NewRune21.webp",
  // Soul Cores — named (new)
  "Hayoxi's Soul Core of Heatproofing": "SoulCores/NewSoulCoreIce.webp",
  "Zalatl's Soul Core of Insulation": "SoulCores/NewSoulCoreLightning.webp",
  "Topotante's Soul Core of Dampening": "SoulCores/NewSoulCoreFire.webp",
  "Atmohua's Soul Core of Retreat": "SoulCores/NewSoulCoreEnergyShield.webp",
  "Quipolatl's Soul Core of Flow": "SoulCores/NewSoulCoreTimeCooldown.webp",
  "Tzamoto's Soul Core of Ferocity": "SoulCores/NewSoulCoreRage.webp",
  "Uromoti's Soul Core of Attenuation": "SoulCores/NewSoulCoreCurses2.webp",
  "Opiloti's Soul Core of Assault": "SoulCores/NewSoulCoreFrenzyCharge.webp",
  "Guatelitzi's Soul Core of Endurance": "SoulCores/NewSoulCoreEnduranceCharge.webp",
  "Xopec's Soul Core of Power": "SoulCores/NewSoulCorePowerCharge.webp",
  "Estazunti's Soul Core of Convalescence": "SoulCores/NewSoulCoreTimeSlow.webp",
  "Tacati's Soul Core of Affliction": "SoulCores/NewSoulCoreChaos1.webp",
  "Cholotl's Soul Core of War": "SoulCores/NewSoulCoreProjectile.webp",
  "Citaqualotl's Soul Core of Foulness": "SoulCores/NewSoulCoreChaos2.webp",
  "Xipocado's Soul Core of Dominion": "SoulCores/NewSoulCoreMinion.webp",
  // Soul Cores — "of X" (standard)
  "Soul Core of Tacati": "SoulCores/GreaterSoulCoreChaos.webp",
  "Soul Core of Opiloti": "SoulCores/GreaterSoulCorePhysical.webp",
  "Soul Core of Jiquani": "SoulCores/GreaterSoulCoreLife.webp",
  "Soul Core of Zalatl": "SoulCores/GreaterSoulCoreMana.webp",
  "Soul Core of Citaqualotl": "SoulCores/GreaterSoulCoreElementalResist.webp",
  "Soul Core of Puhuarte": "SoulCores/GreaterSoulCoreFire.webp",
  "Soul Core of Tzamoto": "SoulCores/GreaterSoulCoreCold.webp",
  "Soul Core of Xopec": "SoulCores/GreaterSoulCoreLightning.webp",
  "Soul Core of Azcapa": "SoulCores/GreaterSoulCoreWealthRarity.webp",
  "Soul Core of Topotante": "SoulCores/GreaterSoulCoreTriElement.webp",
  "Soul Core of Quipolatl": "SoulCores/GreaterSoulCoreSpeed.webp",
  "Soul Core of Ticaba": "SoulCores/GreaterSoulCoreCrit.webp",
  "Soul Core of Atmohua": "SoulCores/GreaterSoulCoreStrength.webp",
  "Soul Core of Cholotl": "SoulCores/GreaterSoulCoreDex.webp",
  "Soul Core of Zantipi": "SoulCores/GreaterSoulCoreint.webp",
  // Theses
  "Guatelitzi's Thesis": "PerfectSoulCores/SoulCoreBlood.webp",
  "Citaqualotl's Thesis": "PerfectSoulCores/SoulCoreSacrifice.webp",
  "Jiquani's Thesis": "PerfectSoulCores/SoulCoreSoul.webp",
  "Quipolatl's Thesis": "PerfectSoulCores/SoulCoreScience.webp",
  // Idols — standard
  "Snake Idol": "TormentedSpiritSocketables/AzmeriSocketableSnake.webp",
  "Primate Idol": "TormentedSpiritSocketables/AzmeriSocketableMonkey.webp",
  "Monkey Idol": "TormentedSpiritSocketables/AzmeriSocketableMonkey.webp",
  "Owl Idol": "TormentedSpiritSocketables/AzmeriSocketableOwl.webp",
  "Cat Idol": "TormentedSpiritSocketables/AzmeriSocketableCat.webp",
  "Wolf Idol": "TormentedSpiritSocketables/AzmeriSocketableWolf.webp",
  "Stag Idol": "TormentedSpiritSocketables/AzmeriSocketableStag.webp",
  "Boar Idol": "TormentedSpiritSocketables/AzmeriSocketableBoar.webp",
  "Bear Idol": "TormentedSpiritSocketables/AzmeriSocketableBear.webp",
  "Ox Idol": "TormentedSpiritSocketables/AzmeriSocketableOx.webp",
  "Rabbit Idol": "TormentedSpiritSocketables/AzmeriSocketableRabbit.webp",
  "Fox Idol": "TormentedSpiritSocketables/AzmeriSocketableFox.webp",
  // Idols — special
  "Idol of Sirrius": "TormentedSpiritSocketables/AzmeriSocketableWolfSpecial.webp",
  "Idol of Thruldana": "TormentedSpiritSocketables/AzmeriSocketableSnakeSpecial.webp",
  "Idol of Grold": "TormentedSpiritSocketables/AzmeriSocketableBearSpecial.webp",
  "Idol of Eeshta": "TormentedSpiritSocketables/AzmeriSocketableOwlSpecial.webp",
  "Idol of Egrin": "TormentedSpiritSocketables/AzmeriSocketableCatSpecial.webp",
  "Idol of Maxarius": "TormentedSpiritSocketables/AzmeriSocketableStagSpecial.webp",
  "Idol of Ralakesh": "TormentedSpiritSocketables/AzmeriSocketableMonkeySpecial.webp",
  // Abyssal Eyes
  "Amanamu's Gaze": "AbyssalEyeSocketables/AmanamusGaze.webp",
  "Tecrod's Gaze": "AbyssalEyeSocketables/TecrodsGaze.webp",
  "Kurgal's Gaze": "AbyssalEyeSocketables/KurgalsGaze.webp",
  "Ulaman's Gaze": "AbyssalEyeSocketables/UlamansGaze.webp",
};

async function fileExists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function downloadImage(url, dest) {
  const res = await fetch(url, {
    headers: {
      "Referer": "https://poe2db.tw/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
}

async function main() {
  await mkdir(AUG_DIR, { recursive: true });

  const entries = Object.entries(IMAGE_MAP);
  let downloaded = 0, skipped = 0, failed = 0;

  for (const [name, cdnPath] of entries) {
    const filename = cdnPath.replace(/\//g, "_");
    const dest = join(AUG_DIR, filename);

    if (await fileExists(dest)) {
      skipped++;
      continue;
    }

    const url = `${CDN}/${cdnPath}`;
    try {
      await downloadImage(url, dest);
      downloaded++;
      process.stdout.write(`  Downloaded: ${name}\n`);
    } catch (e) {
      failed++;
      process.stderr.write(`  FAILED: ${name} — ${e.message}\n`);
    }
  }

  console.log(`\nDone: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);

  // Write the mapping file for use in the data pipeline
  const mapping = {};
  for (const [name, cdnPath] of entries) {
    mapping[name] = `augments/${cdnPath.replace(/\//g, "_")}`;
  }
  await writeFile(
    join(ROOT, "src", "data", "raw", "augment-images.json"),
    JSON.stringify(mapping, null, 2)
  );
  console.log("Wrote augment-images.json mapping");
}

main().catch((e) => { console.error(e); process.exit(1); });
