#!/usr/bin/env node
/**
 * fetch-essences.mjs
 *
 * Scrapes PoE2 Wiki essence pages and produces src/data/raw/essences.json,
 * a catalogue of essence variants keyed by essence → tier → item-category
 * with the forced modifier each applies.
 *
 * Shape:
 *   {
 *     "flames": {
 *       "slug": "flames",
 *       "name": "Flames",
 *       "icon": "essences/flames.webp",      // downloaded asset
 *       "tiers": {
 *         "lesser":  { "page": "Lesser_Essence_of_Flames", "entries": [...], "iconPath": "..." },
 *         "normal":  { ... },
 *         "greater": { ... },
 *         "perfect"?: { ... }                  // corrupted-only essences end up here
 *       }
 *     },
 *     "hysteria": { ... }    // corrupted-only: only a `perfect` tier
 *   }
 *
 * Each tier's entries are `{ category: "One Handed Melee Weapon or Bow", text: "Adds (20-24)…" }`.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_JSON = join(ROOT, "src", "data", "raw", "essences.json");
const OUT_ICONS = join(ROOT, "public", "assets", "essences");

const WIKI = "https://www.poe2wiki.net";

// 20 regular essences (Lesser/Normal/Greater) + 5 corrupted-only (Perfect)
const REGULAR = [
  "Abrasion", "Alacrity", "Battle", "Command", "Electricity",
  "Enhancement", "Flames", "Grounding", "Haste", "Ice",
  "Insulation", "Opulence", "Ruin", "Seeking", "Sorcery", "Thawing",
];
const CORRUPTED = ["Delirium", "Horror", "Hysteria", "Insanity", "Abyss"];

function pageForTier(tier, name) {
  switch (tier) {
    case "lesser":  return `Lesser_Essence_of_${name}`;
    case "normal":  return `Essence_of_${name}`;
    case "greater": return `Greater_Essence_of_${name}`;
    case "perfect": return `Perfect_Essence_of_${name}`;
    case "corrupted": return name === "Abyss" ? `Essence_of_the_Abyss` : `Essence_of_${name}`;
  }
}

async function fetchText(url) {
  const resp = await fetch(url);
  if (!resp.ok) return null;
  return resp.text();
}

async function download(url, dest) {
  try {
    await access(dest);
    return { skipped: true };
  } catch { /* not there */ }
  const resp = await fetch(url);
  if (!resp.ok) return { failed: resp.status };
  const buf = Buffer.from(await resp.arrayBuffer());
  await writeFile(dest, buf);
  return { downloaded: true };
}

/** Find every header → item-stats block and parse the essence mod table. */
function parseEssencePage(html, expectedName) {
  const headerRe = /<span class="header -single">\s*<span class="symbol"><\/span>(.*?)<span class="symbol"><\/span>/g;
  let nameMatch;
  while ((nameMatch = headerRe.exec(html)) !== null) {
    const name = nameMatch[1].replace(/<[^>]+>/g, "").trim();
    if (name !== expectedName) continue;
    const after = html.slice(nameMatch.index + nameMatch[0].length);
    // Take the first -mod block that follows
    const modBlock = after.match(/<span class="group tc -mod">([\s\S]*?)<\/span>\s*<span class="group/);
    if (!modBlock) continue;
    const rawLines = modBlock[1]
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ");
    const lines = rawLines.split("\n").map((s) => s.trim()).filter(Boolean);
    const description = lines[0] ?? "";
    const entries = [];
    for (const line of lines.slice(1)) {
      // Accept "Category : Mod text" or "Category: Mod text"
      const m = line.match(/^([^:]+?)\s*:\s+(.+)$/);
      if (!m) continue;
      entries.push({ category: m[1].trim(), text: m[2].trim() });
    }
    return { name, description, entries };
  }
  return null;
}

/** Find the first essence-inventory-icon URL on the page. */
function findIconUrl(html) {
  // Priority: a div named `item-box-currency` that holds an `<img>` with .png in /images/<hash>/<file>_inventory_icon
  const m = html.match(/src="([^"]*Essence[^"]*_inventory_icon\.png[^"]*)"/);
  if (m) {
    // Strip any thumb path — we want the original
    const url = m[1];
    const full = url.replace(/\/thumb\/([^/]+\/[^/]+\/[^/]+\.png)\/[^"]+/, "/$1");
    return full.startsWith("http") ? full : `${WIKI}${full}`;
  }
  return null;
}

function slug(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

async function main() {
  await mkdir(OUT_ICONS, { recursive: true });
  await mkdir(dirname(OUT_JSON), { recursive: true });

  const output = {};

  const jobs = [];
  for (const name of REGULAR) {
    for (const tier of ["lesser", "normal", "greater"]) {
      jobs.push({ name, tier });
    }
  }
  for (const name of CORRUPTED) {
    jobs.push({ name, tier: "corrupted" });
  }

  let ok = 0, miss = 0;
  for (const job of jobs) {
    const slugName = slug(job.name);
    const page = pageForTier(job.tier, job.name);
    const url = `${WIKI}/wiki/${page}`;
    const html = await fetchText(url);
    if (!html) { console.log(`  MISS ${page}`); miss++; continue; }

    const expectedName = (() => {
      const base = job.name === "Abyss" ? "Essence of the Abyss" : `Essence of ${job.name}`;
      if (job.tier === "lesser") return `Lesser Essence of ${job.name}`;
      if (job.tier === "greater") return `Greater Essence of ${job.name}`;
      if (job.tier === "perfect") return `Perfect Essence of ${job.name}`;
      return base;
    })();

    const parsed = parseEssencePage(html, expectedName);
    if (!parsed) { console.log(`  PARSE-FAIL ${expectedName}`); miss++; continue; }

    const iconUrl = findIconUrl(html);
    let iconPath = null;
    if (iconUrl) {
      const ext = iconUrl.match(/\.(png|webp|jpg)(?:\?|$)/i)?.[1] ?? "png";
      const fname = `${slugName}-${job.tier}.${ext}`;
      const dest = join(OUT_ICONS, fname);
      const r = await download(iconUrl, dest);
      if (!r.failed) iconPath = `essences/${fname}`;
    }

    if (!output[slugName]) {
      output[slugName] = { slug: slugName, name: job.name, tiers: {} };
    }
    // Corrupted-only essences live in a `perfect` tier slot so the UI can
    // treat them uniformly.
    const tierKey = job.tier === "corrupted" ? "perfect" : job.tier;
    output[slugName].tiers[tierKey] = {
      page,
      name: parsed.name,
      description: parsed.description,
      entries: parsed.entries,
      iconPath,
    };
    ok++;
    console.log(`  OK  ${page} → ${parsed.entries.length} category entries`);
  }

  await writeFile(OUT_JSON, JSON.stringify(output, null, 2));
  console.log(`\nFetched ${ok} variants, missed ${miss}.`);
  console.log(`Wrote → ${OUT_JSON}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
