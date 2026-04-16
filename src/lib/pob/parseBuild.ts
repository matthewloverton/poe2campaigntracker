import type {
  ParsedBuild,
  PoBGem,
  PoBItem,
  PoBItemSet,
  PoBSkill,
  PoBSkillSet,
} from "./types";

/**
 * Parse a PoB XML document into our normalized shape.
 * Tolerant of missing sections — returns empty arrays rather than throwing.
 * Throws only if the root element isn't <PathOfBuilding> or <PathOfBuilding2>.
 */
export function parseBuildXml(xml: string): ParsedBuild {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const err = doc.querySelector("parsererror");
  if (err) throw new Error(`Malformed PoB XML: ${err.textContent ?? "unknown"}`);
  const root = doc.documentElement;
  if (!root || (root.tagName !== "PathOfBuilding" && root.tagName !== "PathOfBuilding2")) {
    throw new Error("Not a PoB build (root element is not <PathOfBuilding>)");
  }

  const buildEl = root.querySelector("Build");
  const buildName =
    buildEl?.getAttribute("className") ||
    buildEl?.getAttribute("ascendClassName") ||
    "Imported Build";

  const itemsRoot = root.querySelector("Items");
  const items: PoBItem[] = [];
  const itemSets: PoBItemSet[] = [];
  let activeItemSetId = 0;
  if (itemsRoot) {
    activeItemSetId = Number(itemsRoot.getAttribute("activeItemSet") ?? "0");
    for (const el of Array.from(itemsRoot.querySelectorAll("Item"))) {
      items.push(parseItem(el));
    }
    for (const el of Array.from(itemsRoot.querySelectorAll("ItemSet"))) {
      itemSets.push(parseItemSet(el));
    }
  }

  const skillsRoot = root.querySelector("Skills");
  const skillSets: PoBSkillSet[] = [];
  let activeSkillSetId = 0;
  if (skillsRoot) {
    activeSkillSetId = Number(skillsRoot.getAttribute("activeSkillSet") ?? "0");
    for (const el of Array.from(skillsRoot.querySelectorAll("SkillSet"))) {
      skillSets.push(parseSkillSet(el));
    }
  }

  return {
    buildName,
    items,
    itemSets,
    activeItemSetId,
    skillSets,
    activeSkillSetId,
  };
}

const METADATA_LINE_PREFIX = /^(Crafted|Prefix|Suffix|Sockets|Rune|Soul ?Core|LevelReq|Requires|Limited to|Corrupted|Unidentified|Item Level):/i;

function parseItem(el: Element): PoBItem {
  const id = Number(el.getAttribute("id") ?? "0");
  // Only take direct text content (not nested element text like <ModRange>).
  let raw = "";
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3 /* TEXT_NODE */) raw += child.textContent ?? "";
  }
  raw = raw.trim();
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  // Detect format: "game Ctrl+C" uses "--------" dividers; "PoB internal" has none.
  const hasDividers = lines.includes("--------");

  // Header: Rarity + name + baseType (first 3 non-empty non-divider lines before any metadata line)
  const headerLines: string[] = [];
  for (const line of lines) {
    if (line === "--------") break;
    if (METADATA_LINE_PREFIX.test(line)) break;
    headerLines.push(line);
    if (headerLines.length >= 3) break;
  }

  const rarityLine = headerLines.find((l) => /^Rarity:/i.test(l)) ?? "";
  const rarity = (rarityLine.split(":")[1] ?? "").trim().toUpperCase() as PoBItem["rarity"];
  const headerNonRarity = headerLines.filter((l) => !/^Rarity:/i.test(l));
  const name = headerNonRarity[0] ?? "";
  const baseType = headerNonRarity[1] ?? name;

  // Property lines scattered anywhere.
  let quality: number | undefined;
  let itemLevel: number | undefined;
  for (const line of lines) {
    const q = /^Quality:\s*\+?(\d+)/.exec(line);
    if (q) quality = Number(q[1]);
    const il = /^Item Level:\s*(\d+)/.exec(line);
    if (il) itemLevel = Number(il[1]);
  }

  // PoB's "Prefix: {range:X}Name" / "Suffix: {range:X}Name" lines contain
  // roll fractions in explicit-mod order (skipping "None" entries).
  const rollFractions: number[] = [];
  for (const line of lines) {
    const m = /^(Prefix|Suffix):\s*(?:\{range:([0-9.]+)\})?(.+)$/i.exec(line);
    if (!m) continue;
    const body = m[3].trim();
    if (!body || /^none$/i.test(body)) continue;
    rollFractions.push(m[2] ? Number(m[2]) : NaN);
  }

  const implicits: string[] = [];
  const explicits: string[] = [];

  if (hasDividers) {
    // Game Ctrl+C format: sections split by "--------".
    const sections: string[][] = [[]];
    for (const line of lines) {
      if (line === "--------") sections.push([]);
      else sections[sections.length - 1].push(line);
    }
    for (const section of sections.slice(1)) {
      const isPropertySection = section.some((l) =>
        /^(Item Level|Quality|Requires|Sockets|Limited to|LevelReq|Corrupted|Implicits):/i.test(l),
      );
      if (isPropertySection) continue;
      for (const line of section) {
        if (/\(implicit\)\s*$/.test(line)) {
          implicits.push(line.replace(/\s*\(implicit\)\s*$/, ""));
        } else {
          explicits.push(line);
        }
      }
    }
  } else {
    // PoB-internal format: mods come after "Implicits: N" (or, if missing, after all metadata lines).
    const implicitsLineIdx = lines.findIndex((l) => /^Implicits:\s*\d+/i.test(l));
    let modStart: number;
    let implicitCount = 0;
    if (implicitsLineIdx >= 0) {
      implicitCount = Number(/^Implicits:\s*(\d+)/i.exec(lines[implicitsLineIdx])![1]);
      modStart = implicitsLineIdx + 1;
    } else {
      // Fall back: find the last metadata line, mods follow from there.
      let lastMeta = headerLines.length - 1;
      for (let i = headerLines.length; i < lines.length; i++) {
        if (METADATA_LINE_PREFIX.test(lines[i])) lastMeta = i;
        else break;
      }
      // Skip over any run of contiguous metadata lines starting after header.
      for (let i = headerLines.length; i < lines.length; i++) {
        if (METADATA_LINE_PREFIX.test(lines[i]) || /^(Quality|Implicits):/i.test(lines[i])) lastMeta = i;
        else break;
      }
      modStart = lastMeta + 1;
    }
    const modLines = lines.slice(modStart);
    for (let i = 0; i < modLines.length; i++) {
      const line = modLines[i];
      if (/\(implicit\)\s*$/.test(line)) {
        implicits.push(line.replace(/\s*\(implicit\)\s*$/, ""));
      } else if (i < implicitCount) {
        implicits.push(line);
      } else {
        explicits.push(line);
      }
    }
  }

  // Align roll fractions to explicit mods by position. If we got fewer rolls
  // than explicits (e.g. implicits snuck in), pad the tail with undefined.
  const explicitRolls: (number | undefined)[] = explicits.map((_, i) => {
    const v = rollFractions[i];
    return Number.isFinite(v) ? v : undefined;
  });

  return {
    id,
    rarity: (["NORMAL", "MAGIC", "RARE", "UNIQUE"] as const).includes(rarity)
      ? rarity
      : "RARE",
    name,
    baseType,
    quality,
    itemLevel,
    implicits,
    explicits,
    explicitRolls,
    raw,
  };
}

function parseItemSet(el: Element): PoBItemSet {
  const id = Number(el.getAttribute("id") ?? "0");
  const title = (el.getAttribute("title") ?? "").trim();
  const slots: Record<string, number> = {};
  for (const slot of Array.from(el.querySelectorAll("Slot"))) {
    const name = slot.getAttribute("name") ?? "";
    const itemId = Number(slot.getAttribute("itemId") ?? "0");
    if (name && itemId) slots[name] = itemId;
  }
  return { id, title, slots };
}

function parseSkillSet(el: Element): PoBSkillSet {
  const id = Number(el.getAttribute("id") ?? "0");
  const title = (el.getAttribute("title") ?? "").trim();
  const skills: PoBSkill[] = [];
  for (const skillEl of Array.from(el.querySelectorAll("Skill"))) {
    skills.push(parseSkill(skillEl));
  }
  return { id, title, skills };
}

function parseSkill(el: Element): PoBSkill {
  const enabled = (el.getAttribute("enabled") ?? "true") !== "false";
  const label = (el.getAttribute("label") ?? "").trim();
  const mainActiveSkill = Number(el.getAttribute("mainActiveSkill") ?? "1");
  const gems: PoBGem[] = [];
  for (const g of Array.from(el.querySelectorAll("Gem"))) {
    gems.push({
      skillId: g.getAttribute("skillId") ?? "",
      gemId: g.getAttribute("gemId") ?? "",
      nameSpec: g.getAttribute("nameSpec") ?? "",
      enabled: (g.getAttribute("enabled") ?? "true") !== "false",
      level: Number(g.getAttribute("level") ?? "1"),
      quality: Number(g.getAttribute("quality") ?? "0"),
    });
  }
  return { enabled, label, mainActiveSkill, gems };
}
