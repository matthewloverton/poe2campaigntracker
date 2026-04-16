import { itemById } from "../../data/items";
import { modById, cleanModText } from "../../data/mods";
import type { BuildGearEntry } from "../../types/buildPlan";
import type { ItemMod } from "../../types/itemDatabase";

/** Resolve a single mod's text with rolled values substituted in. */
function resolveModRoll(mod: ItemMod, pct: number | undefined): string {
  const text = cleanModText(mod.text);
  return text.replace(/\((-?\d+)[–—-](-?\d+)\)/g, (_m, a, b) => {
    const min = Number(a), max = Number(b);
    if (pct != null) return String(Math.round(min + ((max - min) * pct) / 100));
    return String(Math.round((min + max) / 2));
  });
}

const DIVIDER = "--------";

/**
 * Render a BuildGearEntry as a PoE "Ctrl+C" item text block, which PoB accepts
 * directly in its "Create custom / Import item" flow.
 */
export function encodeItem(entry: BuildGearEntry): string {
  const base = entry.baseItemId ? itemById.get(entry.baseItemId) : undefined;
  const isUnique = !!entry.uniqueId;

  const header: string[] = [];
  header.push(`Item Class: ${base?.itemClass ?? "Unknown"}`);
  header.push(`Rarity: ${isUnique ? "Unique" : "Rare"}`);
  // Rare needs a name + base type on separate lines. For uniques we use the
  // unique's name (stored in entry.base after the unique picker).
  header.push(entry.base || "Crafted Item");
  if (base?.name && base.name !== entry.base) header.push(base.name);
  else if (base?.name) header.push(base.name);

  const stats: string[] = [];
  if ((entry.quality ?? 0) > 0) {
    stats.push(`Quality: +${entry.quality}% (augmented)`);
  }
  if (base) {
    const p = base.properties;
    if (p.physicalDamageMin != null && p.physicalDamageMax != null) {
      stats.push(`Physical Damage: ${p.physicalDamageMin}-${p.physicalDamageMax}`);
    }
    if (p.criticalStrikeChance != null) {
      stats.push(`Critical Hit Chance: ${(p.criticalStrikeChance / 100).toFixed(2)}%`);
    }
    if (p.attackTime != null) {
      stats.push(`Attacks per Second: ${(1000 / p.attackTime).toFixed(2)}`);
    }
    if (p.armour) stats.push(`Armour: ${Math.round((p.armour.min + p.armour.max) / 2)}`);
    if (p.evasion) stats.push(`Evasion Rating: ${Math.round((p.evasion.min + p.evasion.max) / 2)}`);
    if (p.energyShield) stats.push(`Energy Shield: ${Math.round((p.energyShield.min + p.energyShield.max) / 2)}`);
  }

  const reqs: string[] = [];
  if (base) {
    const parts: string[] = [];
    if (base.requirements.level) parts.push(`Level ${base.requirements.level}`);
    if (base.requirements.strength) parts.push(`${base.requirements.strength} Str`);
    if (base.requirements.dexterity) parts.push(`${base.requirements.dexterity} Dex`);
    if (base.requirements.intelligence) parts.push(`${base.requirements.intelligence} Int`);
    if (parts.length > 0) reqs.push(`Requires: ${parts.join(", ")}`);
  }

  const ilvl = ["Item Level: 82"];

  const implicits = (base?.implicits ?? []).map((t) => `${cleanModText(t)} (implicit)`);

  const explicits: string[] = [];
  const ids = entry.desiredModIds ?? [];
  entry.desiredMods.forEach((line, i) => {
    const modId = ids[i];
    const mod = modId ? modById.get(modId) : undefined;
    if (mod) {
      explicits.push(resolveModRoll(mod, entry.modRolls?.[mod.id]));
    } else {
      // free text — pass through, just strip markup
      explicits.push(cleanModText(line));
    }
  });

  const note = ["Note: Crafted in PoE2 Campaign Tracker"];

  const sections: string[][] = [header];
  if (stats.length > 0) sections.push(stats);
  if (reqs.length > 0) sections.push(reqs);
  sections.push(ilvl);
  if (implicits.length > 0) sections.push(implicits);
  if (explicits.length > 0) sections.push(explicits);
  sections.push(note);

  return sections.map((s) => s.join("\n")).join(`\n${DIVIDER}\n`);
}
