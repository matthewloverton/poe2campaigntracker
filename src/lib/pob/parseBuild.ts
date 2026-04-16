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
 * Throws only if the root element isn't <PathOfBuilding>.
 */
export function parseBuildXml(xml: string): ParsedBuild {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const err = doc.querySelector("parsererror");
  if (err) throw new Error(`Malformed PoB XML: ${err.textContent ?? "unknown"}`);
  const root = doc.documentElement;
  if (!root || root.tagName !== "PathOfBuilding") {
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

function parseItem(el: Element): PoBItem {
  const id = Number(el.getAttribute("id") ?? "0");
  const raw = (el.textContent ?? "").trim();
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  const sections: string[][] = [[]];
  for (const line of lines) {
    if (line === "--------") {
      sections.push([]);
    } else {
      sections[sections.length - 1].push(line);
    }
  }

  // Header: first section has Rarity + name (+ base type on second line for rare/unique)
  const header = sections[0] ?? [];
  const rarityLine = header.find((l) => /^Rarity:/i.test(l)) ?? "";
  const rarity = (rarityLine.split(":")[1] ?? "").trim().toUpperCase() as PoBItem["rarity"];
  const headerNonRarity = header.filter((l) => !/^Rarity:/i.test(l));
  const name = headerNonRarity[0] ?? "";
  const baseType = headerNonRarity[1] ?? name;

  // Property lines scattered through sections. Look anywhere in the body.
  let quality: number | undefined;
  let itemLevel: number | undefined;
  for (const line of lines) {
    const q = /^Quality:\s*\+?(\d+)/.exec(line);
    if (q) quality = Number(q[1]);
    const il = /^Item Level:\s*(\d+)/.exec(line);
    if (il) itemLevel = Number(il[1]);
  }

  // Implicits vs explicits: the very last body section is explicits.
  // Any earlier line ending "(implicit)" is an implicit.
  const implicits: string[] = [];
  const explicits: string[] = [];
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
      enabled: (g.getAttribute("enabled") ?? "true") !== "false",
      level: Number(g.getAttribute("level") ?? "1"),
      quality: Number(g.getAttribute("quality") ?? "0"),
    });
  }
  return { enabled, label, mainActiveSkill, gems };
}
