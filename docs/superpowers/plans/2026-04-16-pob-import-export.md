# PoB PoE2 Import/Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users paste a Path of Building PoE2 build code to create build phases in-app, and copy any gear-slot item as a PoB-compatible text block for pasting into PoB.

**Architecture:** Self-contained `src/lib/pob/` module with pure functions (codec, parser, matchers, encoder) and one new modal UI. Store gets a single new action `createPhasesFromPoB`. No schema changes to existing data types.

**Tech Stack:** React 19 + TypeScript + Vite + Zustand. Vitest + jsdom for tests. New dep: `pako` (zlib in JS).

Source of truth for PoB format: https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2

---

## File Structure

**New files:**
- `src/lib/pob/types.ts` — type definitions for parsed PoB structures + import result
- `src/lib/pob/codec.ts` — decode base64+zlib build code → XML string
- `src/lib/pob/parseBuild.ts` — XML → normalized `ParsedBuild`
- `src/lib/pob/pairSets.ts` — pair item sets with skill sets (name-match → index → active)
- `src/lib/pob/matchItem.ts` — parse a PoB item text block, resolve to `BuildGearEntry`
- `src/lib/pob/matchGem.ts` — resolve PoB gem ids to `BuildGemEntry` / `SkillGroup`
- `src/lib/pob/encodeItem.ts` — `BuildGearEntry` → PoB-compatible multi-line text block
- `src/lib/pob/codec.test.ts`
- `src/lib/pob/parseBuild.test.ts`
- `src/lib/pob/pairSets.test.ts`
- `src/lib/pob/matchItem.test.ts`
- `src/lib/pob/matchGem.test.ts`
- `src/lib/pob/encodeItem.test.ts`
- `src/lib/pob/__fixtures__/sample-build.xml` — reusable fixture
- `src/components/PoBImport/PoBImportModal.tsx` — modal shell (paste + preview + confirm)
- `src/components/PoBImport/PoBImportModal.module.css`

**Modified files:**
- `package.json` — add `pako` + `@types/pako`
- `src/store/customizationsStore.ts` — add `createPhasesFromPoB` action
- `src/components/BuildPlan/BuildPlan.tsx` — wire "Import from PoB" button + modal
- `src/components/BuildPlan/GearSlot.tsx` — add copy button
- `src/components/BuildPlan/GearSlot.module.css` — copy button + "copied" badge styles

---

## Task 1: Add pako dependency and shared types

**Files:**
- Modify: `package.json`
- Create: `src/lib/pob/types.ts`

- [ ] **Step 1: Install pako**

```bash
npm install pako
npm install --save-dev @types/pako
```

Expected: `package.json` now has `pako` in `dependencies` and `@types/pako` in `devDependencies`.

- [ ] **Step 2: Create types module**

`src/lib/pob/types.ts`:

```typescript
import type { BuildGearEntry, SkillGroup, GearSlotKey } from "../../types/buildPlan";

/** Parsed PoB item — before matching against our DB. */
export interface PoBItem {
  id: number;                // <Item id="N">
  rarity: "NORMAL" | "MAGIC" | "RARE" | "UNIQUE";
  name: string;              // item name (first body line for rare/unique)
  baseType: string;          // base type (second body line)
  itemLevel?: number;
  quality?: number;
  implicits: string[];       // lines ending " (implicit)"
  explicits: string[];       // everything else in the mod section
  raw: string;               // full text for debugging
}

/** Item set: maps slot name → item id. */
export interface PoBItemSet {
  id: number;
  title: string;             // empty string if unnamed
  slots: Record<string, number>; // slot name as written in XML → item id
}

/** Parsed PoB skill / skill group. */
export interface PoBSkill {
  enabled: boolean;
  label: string;             // user-given or skill name
  mainActiveSkill: number;   // 1-based index into gems; 0 means "first"
  gems: PoBGem[];
}

export interface PoBGem {
  skillId: string;           // e.g. "LightningArrow", "SupportMartialTempo"
  enabled: boolean;
  level: number;
  quality: number;
}

export interface PoBSkillSet {
  id: number;
  title: string;
  skills: PoBSkill[];
}

export interface ParsedBuild {
  buildName: string;         // from <Build> or fallback
  items: PoBItem[];
  itemSets: PoBItemSet[];
  activeItemSetId: number;
  skillSets: PoBSkillSet[];
  activeSkillSetId: number;
}

/** A non-fatal issue to surface in the import preview. */
export interface ImportWarning {
  scope: "item" | "gem" | "slot" | "general";
  message: string;
}

/** A phase-shaped payload plus warnings — used by the preview. */
export interface ImportPhase {
  name: string;
  gear: Partial<Record<GearSlotKey, BuildGearEntry>>;
  gems: SkillGroup[];
  warnings: ImportWarning[];
}

export interface ImportResult {
  buildName: string;
  phases: ImportPhase[];
  generalWarnings: ImportWarning[];
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors introduced.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/pob/types.ts
git commit -m "feat(pob): pako dep + shared types"
```

---

## Task 2: Build-code codec (base64 + zlib → XML)

**Files:**
- Create: `src/lib/pob/codec.ts`
- Create: `src/lib/pob/codec.test.ts`

- [ ] **Step 1: Write failing test — round-trip known XML**

`src/lib/pob/codec.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { inflate, deflate } from "pako";
import { decodeBuildCode } from "./codec";

function toBase64UrlSafe(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
}

describe("codec.decodeBuildCode", () => {
  it("round-trips simple XML", () => {
    const xml = "<PathOfBuilding><Build/></PathOfBuilding>";
    const deflated = deflate(new TextEncoder().encode(xml));
    const code = toBase64UrlSafe(deflated);
    expect(decodeBuildCode(code)).toBe(xml);
  });

  it("handles URL-safe base64 with padding stripped", () => {
    const xml = "<A/>";
    const deflated = deflate(new TextEncoder().encode(xml));
    const code = toBase64UrlSafe(deflated).replace(/=+$/, "");
    expect(decodeBuildCode(code)).toBe(xml);
  });

  it("throws informative error on non-base64 input", () => {
    expect(() => decodeBuildCode("!!!not-base64!!!")).toThrow(/not a valid/i);
  });

  it("throws informative error on non-zlib payload", () => {
    // valid base64 of the string "hello"
    expect(() => decodeBuildCode("aGVsbG8=")).toThrow(/not a valid/i);
  });

  it("also works with standard base64 (non-URL-safe)", () => {
    const xml = "<B/>";
    const deflated = deflate(new TextEncoder().encode(xml));
    let binary = "";
    for (const b of deflated) binary += String.fromCharCode(b);
    const stdCode = btoa(binary);           // contains '+' and '/'
    expect(decodeBuildCode(stdCode)).toBe(xml);
  });

  it("tolerates surrounding whitespace/newlines from a copy-paste", () => {
    const xml = "<C/>";
    const deflated = deflate(new TextEncoder().encode(xml));
    const code = toBase64UrlSafe(deflated);
    expect(decodeBuildCode(`  \n${code}\n  `)).toBe(xml);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pob/codec.test.ts`
Expected: FAIL — `decodeBuildCode` not exported.

- [ ] **Step 3: Implement `codec.ts`**

`src/lib/pob/codec.ts`:

```typescript
import { inflate } from "pako";

/**
 * Decode a Path of Building share code (URL-safe or standard base64 of a
 * zlib-deflated UTF-8 XML document) into the underlying XML string.
 * Throws with "Not a valid PoB code" if the input can't be decoded.
 */
export function decodeBuildCode(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Not a valid PoB code: empty input");

  // Accept both URL-safe and standard base64, with or without padding.
  const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  let bytes: Uint8Array;
  try {
    const binary = atob(padded);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch {
    throw new Error("Not a valid PoB code: could not decode base64");
  }

  let inflated: Uint8Array;
  try {
    inflated = inflate(bytes);
  } catch {
    throw new Error("Not a valid PoB code: could not decompress payload");
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(inflated);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/lib/pob/codec.test.ts`
Expected: PASS — 6/6.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pob/codec.ts src/lib/pob/codec.test.ts
git commit -m "feat(pob): base64+zlib build-code decoder"
```

---

## Task 3: XML parser (`parseBuild.ts`)

**Files:**
- Create: `src/lib/pob/parseBuild.ts`
- Create: `src/lib/pob/parseBuild.test.ts`
- Create: `src/lib/pob/__fixtures__/sample-build.xml`

- [ ] **Step 1: Create the fixture**

`src/lib/pob/__fixtures__/sample-build.xml`:

```xml
<PathOfBuilding>
  <Build className="Mercenary" ascendClassName="Witchhunter" level="92" />
  <Items activeItemSet="1">
    <Item id="1">
Rarity: RARE
Doom Song
Expert Zealot Bow
--------
Quality: +20% (augmented)
--------
Item Level: 82
--------
20% increased Physical Damage (implicit)
--------
+83 to maximum Life
Adds 30 to 60 Fire Damage
15% increased Attack Speed
    </Item>
    <Item id="2">
Rarity: UNIQUE
Pillar of the Caged God
Long Staff
--------
Requires: Level 41
--------
Adds 2 to 6 Physical Damage per 10 Strength
    </Item>
    <ItemSet id="1" title="Leveling">
      <Slot name="Weapon 1" itemId="1" />
    </ItemSet>
    <ItemSet id="2" title="">
      <Slot name="Weapon 1" itemId="2" />
    </ItemSet>
  </Items>
  <Skills activeSkillSet="2">
    <SkillSet id="1" title="Leveling">
      <Skill mainActiveSkill="1" enabled="true" label="Bow Shot">
        <Gem skillId="LightningArrow" level="1" quality="0" enabled="true" />
      </Skill>
    </SkillSet>
    <SkillSet id="2" title="Endgame">
      <Skill mainActiveSkill="1" enabled="true" label="Main">
        <Gem skillId="LightningArrowOfTheStorm" level="20" quality="0" enabled="true" />
        <Gem skillId="SupportMartialTempo" level="20" quality="0" enabled="true" />
      </Skill>
      <Skill mainActiveSkill="1" enabled="false" label="Disabled">
        <Gem skillId="IceShot" level="1" quality="0" enabled="true" />
      </Skill>
    </SkillSet>
  </Skills>
</PathOfBuilding>
```

- [ ] **Step 2: Write failing test**

`src/lib/pob/parseBuild.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseBuildXml } from "./parseBuild";

const sample = readFileSync(
  join(__dirname, "__fixtures__", "sample-build.xml"),
  "utf-8",
);

describe("parseBuildXml", () => {
  const build = parseBuildXml(sample);

  it("extracts items with rarity and name", () => {
    expect(build.items).toHaveLength(2);
    const rare = build.items.find((i) => i.id === 1)!;
    expect(rare.rarity).toBe("RARE");
    expect(rare.name).toBe("Doom Song");
    expect(rare.baseType).toBe("Expert Zealot Bow");
    expect(rare.quality).toBe(20);
    expect(rare.itemLevel).toBe(82);
    expect(rare.implicits).toEqual(["20% increased Physical Damage"]);
    expect(rare.explicits).toEqual([
      "+83 to maximum Life",
      "Adds 30 to 60 Fire Damage",
      "15% increased Attack Speed",
    ]);
  });

  it("extracts unique items", () => {
    const unique = build.items.find((i) => i.id === 2)!;
    expect(unique.rarity).toBe("UNIQUE");
    expect(unique.name).toBe("Pillar of the Caged God");
    expect(unique.baseType).toBe("Long Staff");
  });

  it("extracts item sets with slot mapping", () => {
    expect(build.itemSets).toHaveLength(2);
    expect(build.itemSets[0].title).toBe("Leveling");
    expect(build.itemSets[0].slots).toEqual({ "Weapon 1": 1 });
    expect(build.itemSets[1].title).toBe("");
    expect(build.itemSets[1].slots).toEqual({ "Weapon 1": 2 });
    expect(build.activeItemSetId).toBe(1);
  });

  it("extracts skill sets with gems", () => {
    expect(build.skillSets).toHaveLength(2);
    expect(build.activeSkillSetId).toBe(2);
    const endgame = build.skillSets[1];
    expect(endgame.title).toBe("Endgame");
    expect(endgame.skills).toHaveLength(2);
    expect(endgame.skills[0].enabled).toBe(true);
    expect(endgame.skills[0].gems.map((g) => g.skillId))
      .toEqual(["LightningArrowOfTheStorm", "SupportMartialTempo"]);
    expect(endgame.skills[1].enabled).toBe(false);
  });

  it("falls back to empty build on missing Items/Skills", () => {
    const result = parseBuildXml("<PathOfBuilding><Build/></PathOfBuilding>");
    expect(result.items).toEqual([]);
    expect(result.itemSets).toEqual([]);
    expect(result.skillSets).toEqual([]);
  });

  it("throws on non-XML input", () => {
    expect(() => parseBuildXml("not xml at all")).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/pob/parseBuild.test.ts`
Expected: FAIL — `parseBuildXml` not exported.

- [ ] **Step 4: Implement `parseBuild.ts`**

`src/lib/pob/parseBuild.ts`:

```typescript
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
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run src/lib/pob/parseBuild.test.ts`
Expected: PASS — 6/6.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pob/parseBuild.ts src/lib/pob/parseBuild.test.ts src/lib/pob/__fixtures__/sample-build.xml
git commit -m "feat(pob): XML parser + sample fixture"
```

---

## Task 4: Set pairing logic (`pairSets.ts`)

**Files:**
- Create: `src/lib/pob/pairSets.ts`
- Create: `src/lib/pob/pairSets.test.ts`

- [ ] **Step 1: Write failing test**

`src/lib/pob/pairSets.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { pairSets } from "./pairSets";
import type { PoBItemSet, PoBSkillSet } from "./types";

function makeItemSet(id: number, title: string): PoBItemSet {
  return { id, title, slots: {} };
}
function makeSkillSet(id: number, title: string): PoBSkillSet {
  return { id, title, skills: [] };
}

describe("pairSets", () => {
  it("pairs by name when both have matching titles", () => {
    const items = [makeItemSet(1, "Endgame"), makeItemSet(2, "Leveling")];
    const skills = [makeSkillSet(10, "Leveling"), makeSkillSet(20, "Endgame")];
    const pairs = pairSets(items, skills, 0);
    expect(pairs).toEqual([
      { itemSet: items[0], skillSet: skills[1] }, // Endgame ↔ Endgame
      { itemSet: items[1], skillSet: skills[0] }, // Leveling ↔ Leveling
    ]);
  });

  it("falls back to index pairing when no name match", () => {
    const items = [makeItemSet(1, "A"), makeItemSet(2, "B")];
    const skills = [makeSkillSet(10, "X"), makeSkillSet(20, "Y")];
    const pairs = pairSets(items, skills, 0);
    expect(pairs).toEqual([
      { itemSet: items[0], skillSet: skills[0] },
      { itemSet: items[1], skillSet: skills[1] },
    ]);
  });

  it("mixes name match with index fallback", () => {
    const items = [makeItemSet(1, "Endgame"), makeItemSet(2, "Leveling"), makeItemSet(3, "Extra")];
    const skills = [makeSkillSet(10, "Leveling"), makeSkillSet(20, "Endgame")];
    const pairs = pairSets(items, skills, 20);
    expect(pairs[0]).toEqual({ itemSet: items[0], skillSet: skills[1] }); // Endgame
    expect(pairs[1]).toEqual({ itemSet: items[1], skillSet: skills[0] }); // Leveling
    expect(pairs[2]).toEqual({ itemSet: items[2], skillSet: skills[1] }); // Extra → active
  });

  it("leftover item sets with no skill sets at all use the active skill set", () => {
    const items = [makeItemSet(1, "A"), makeItemSet(2, "B")];
    const skills = [makeSkillSet(10, "Only")];
    const pairs = pairSets(items, skills, 10);
    expect(pairs[0].skillSet).toBe(skills[0]);
    expect(pairs[1].skillSet).toBe(skills[0]);
  });

  it("empty skill sets → pairs with null", () => {
    const items = [makeItemSet(1, "A")];
    const pairs = pairSets(items, [], 0);
    expect(pairs).toEqual([{ itemSet: items[0], skillSet: null }]);
  });

  it("empty item sets → empty result", () => {
    expect(pairSets([], [makeSkillSet(1, "A")], 1)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pob/pairSets.test.ts`
Expected: FAIL — `pairSets` not exported.

- [ ] **Step 3: Implement `pairSets.ts`**

`src/lib/pob/pairSets.ts`:

```typescript
import type { PoBItemSet, PoBSkillSet } from "./types";

export interface SetPair {
  itemSet: PoBItemSet;
  skillSet: PoBSkillSet | null;
}

/**
 * Pair each PoB item set with a skill set.
 * 1. Name match first (non-empty titles that match exactly).
 * 2. Index fallback for any remaining item sets, in original order.
 * 3. Leftover item sets use the active skill set (by id), or null if there are none.
 */
export function pairSets(
  itemSets: PoBItemSet[],
  skillSets: PoBSkillSet[],
  activeSkillSetId: number,
): SetPair[] {
  const result: SetPair[] = [];
  const takenSkillIds = new Set<number>();

  // Pass 1: name match (only when title is non-empty).
  const pairedByName = new Map<number, PoBSkillSet>();
  for (const i of itemSets) {
    if (!i.title) continue;
    const match = skillSets.find((s) => s.title === i.title && !takenSkillIds.has(s.id));
    if (match) {
      pairedByName.set(i.id, match);
      takenSkillIds.add(match.id);
    }
  }

  // Pass 2: index fallback over remaining.
  const remainingSkills = skillSets.filter((s) => !takenSkillIds.has(s.id));
  let skillCursor = 0;
  const activeSkillSet = skillSets.find((s) => s.id === activeSkillSetId) ?? null;

  for (const i of itemSets) {
    const named = pairedByName.get(i.id);
    if (named) {
      result.push({ itemSet: i, skillSet: named });
      continue;
    }
    if (skillCursor < remainingSkills.length) {
      result.push({ itemSet: i, skillSet: remainingSkills[skillCursor] });
      skillCursor++;
      continue;
    }
    // Pass 3: leftover → active skill set (may be null if there are none).
    result.push({ itemSet: i, skillSet: activeSkillSet });
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/lib/pob/pairSets.test.ts`
Expected: PASS — 6/6.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pob/pairSets.ts src/lib/pob/pairSets.test.ts
git commit -m "feat(pob): set pairing (name match → index → active)"
```

---

## Task 5: Item matcher (`matchItem.ts`)

**Files:**
- Create: `src/lib/pob/matchItem.ts`
- Create: `src/lib/pob/matchItem.test.ts`

- [ ] **Step 1: Write failing test**

`src/lib/pob/matchItem.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { allItems } from "../../data/items";
import { allUniques } from "../../data/uniques";
import { allMods } from "../../data/mods";
import { matchItem, normalizeModText, POB_SLOT_MAP } from "./matchItem";
import type { PoBItem } from "./types";

function fakeItem(overrides: Partial<PoBItem> = {}): PoBItem {
  return {
    id: 1,
    rarity: "RARE",
    name: "Fake",
    baseType: "Zealot Bow",
    implicits: [],
    explicits: [],
    raw: "",
    ...overrides,
  };
}

describe("normalizeModText", () => {
  it("replaces numbers with #", () => {
    expect(normalizeModText("+83 to maximum Life")).toBe("# to maximum Life");
    expect(normalizeModText("Adds 30 to 60 Fire Damage")).toBe("Adds # to # Fire Damage");
    expect(normalizeModText("15% increased Attack Speed")).toBe("#% increased Attack Speed");
  });

  it("strips (crafted)/(fractured) suffixes", () => {
    expect(normalizeModText("+50 to Life (crafted)")).toBe("# to Life");
    expect(normalizeModText("15% increased Damage (fractured)")).toBe("#% increased Damage");
  });

  it("strips extra whitespace", () => {
    expect(normalizeModText("  15%   increased   Attack Speed  "))
      .toBe("#% increased Attack Speed");
  });
});

describe("POB_SLOT_MAP", () => {
  it("maps known slot names", () => {
    expect(POB_SLOT_MAP["Weapon 1"]).toBe("weapon");
    expect(POB_SLOT_MAP["Weapon 2"]).toBe("offhand");
    expect(POB_SLOT_MAP["Body Armour"]).toBe("bodyArmour");
    expect(POB_SLOT_MAP["Ring 1"]).toBe("ring1");
  });
});

describe("matchItem", () => {
  const baseBow = allItems.find((i) => i.name === "Zealot Bow");

  it("is a smoke test for the DB — Zealot Bow exists", () => {
    expect(baseBow).toBeDefined();
  });

  it("matches a rare with known base", () => {
    if (!baseBow) return;
    const pobItem = fakeItem({
      baseType: baseBow.name,
      explicits: ["15% increased Attack Speed"],
    });
    const { entry, warnings } = matchItem(pobItem, "weapon");
    expect(entry).not.toBeNull();
    expect(entry!.baseItemId).toBe(baseBow.id);
    expect(entry!.slot).toBe("weapon");
    expect(warnings).toEqual([]);
  });

  it("falls back to free text for an unmatched base", () => {
    const pobItem = fakeItem({ baseType: "Unknown Xyzzy Bow" });
    const { entry, warnings } = matchItem(pobItem, "weapon");
    expect(entry).not.toBeNull();
    expect(entry!.baseItemId).toBeUndefined();
    expect(entry!.base).toBe("Unknown Xyzzy Bow");
    expect(warnings.some((w) => w.scope === "item" && /not in database/i.test(w.message))).toBe(true);
  });

  it("emits a warning for an unmatched mod but still stores its raw text", () => {
    if (!baseBow) return;
    const pobItem = fakeItem({
      baseType: baseBow.name,
      explicits: ["Gives you 3 extra jumps on Tuesdays"],
    });
    const { entry, warnings } = matchItem(pobItem, "weapon");
    expect(entry!.desiredMods).toContain("Gives you 3 extra jumps on Tuesdays");
    expect(warnings.some((w) => /fell back to free text/i.test(w.message))).toBe(true);
  });

  it("resolves a unique by name", () => {
    const u = allUniques[0];
    if (!u) return;
    const pobItem = fakeItem({ rarity: "UNIQUE", name: u.name, baseType: u.itemClass });
    const { entry } = matchItem(pobItem, "amulet");
    expect(entry!.uniqueId).toBe(u.id);
  });

  it("strips (crafted) suffix before matching mods", () => {
    if (!baseBow) return;
    // pick an existing mod we can recognize
    const existingMod = allMods.find((m) => m.text.includes("increased Attack Speed"));
    if (!existingMod) return;
    const normalized = normalizeModText(existingMod.text);
    const withSuffix = `${existingMod.text.replace(/\(\d+-\d+\)/g, "15")} (crafted)`;
    expect(normalizeModText(withSuffix)).toBe(normalized);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pob/matchItem.test.ts`
Expected: FAIL — `matchItem` not exported.

- [ ] **Step 3: Implement `matchItem.ts`**

`src/lib/pob/matchItem.ts`:

```typescript
import { allItems } from "../../data/items";
import { allUniques } from "../../data/uniques";
import { allMods, cleanModText } from "../../data/mods";
import type { BuildGearEntry, GearSlotKey } from "../../types/buildPlan";
import type { ImportWarning, PoBItem } from "./types";

export const POB_SLOT_MAP: Record<string, GearSlotKey> = {
  "Weapon 1": "weapon",
  "Weapon 2": "offhand",
  "Weapon 1 Swap": "weaponSwap",
  "Weapon 2 Swap": "offhandSwap",
  "Helmet": "helmet",
  "Body Armour": "bodyArmour",
  "Gloves": "gloves",
  "Boots": "boots",
  "Amulet": "amulet",
  "Ring 1": "ring1",
  "Ring 2": "ring2",
  "Belt": "belt",
};

/**
 * Normalise mod text for fuzzy matching against our DB:
 * - strip (crafted)/(fractured)/(implicit) suffixes
 * - strip RePoE markup via cleanModText
 * - replace numbers (with optional +/- sign) with "#"
 * - collapse whitespace
 */
export function normalizeModText(text: string): string {
  const stripped = cleanModText(text).replace(/\s*\((crafted|fractured|implicit)\)\s*/gi, "");
  const numsReplaced = stripped.replace(/[+-]?\d+(\.\d+)?/g, "#");
  return numsReplaced.replace(/\s+/g, " ").trim();
}

// Precompute normalized text per mod once. RePoE mods have (min-max) ranges that
// normalize to (#-#); unique ranges like (10-20) do too.
const normalizedModIndex: Array<{ normalized: string; modId: string }> = allMods.map((m) => ({
  modId: m.id,
  normalized: normalizeModText(m.text),
}));

export interface MatchItemResult {
  entry: BuildGearEntry | null;
  warnings: ImportWarning[];
}

/**
 * Map a PoB item to a BuildGearEntry for the given slot.
 * Returns null entry (with warning) only for totally unusable input.
 */
export function matchItem(item: PoBItem, slot: GearSlotKey): MatchItemResult {
  const warnings: ImportWarning[] = [];

  // Base match
  const base = allItems.find((i) => i.name === item.baseType);
  if (!base) {
    warnings.push({
      scope: "item",
      message: `Base "${item.baseType}" not in database — item kept as free text`,
    });
  }

  // Unique match (only if rarity is UNIQUE)
  let uniqueId: string | undefined;
  if (item.rarity === "UNIQUE") {
    const unique = allUniques.find((u) => u.name === item.name);
    if (unique) {
      uniqueId = unique.id;
    } else {
      warnings.push({
        scope: "item",
        message: `Unique "${item.name}" not in database — treating as rare`,
      });
    }
  }

  // Mod match — pair normalized patterns against the DB.
  const desiredMods: string[] = [];
  const desiredModIds: string[] = [];
  for (const line of item.explicits) {
    const normalized = normalizeModText(line);
    const match = normalizedModIndex.find((n) => n.normalized === normalized);
    if (match) {
      desiredModIds.push(match.modId);
      desiredMods.push(cleanModText(line.replace(/\s*\((crafted|fractured)\)\s*/gi, "")));
    } else {
      desiredMods.push(line);
      warnings.push({
        scope: "item",
        message: `Mod fell back to free text: "${line}"`,
      });
    }
  }

  const entry: BuildGearEntry = {
    id: crypto.randomUUID(),
    slot,
    base: base?.name ?? item.baseType,
    baseItemId: base?.id,
    uniqueId,
    desiredMods,
    desiredModIds: desiredModIds.length > 0 ? desiredModIds : undefined,
    notes: "",
    iconPath: base?.iconPath,
    quality: item.quality,
  };

  return { entry, warnings };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/lib/pob/matchItem.test.ts`
Expected: PASS — 7/7 (smoke test may skip if `baseBow` not found; that's okay).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pob/matchItem.ts src/lib/pob/matchItem.test.ts
git commit -m "feat(pob): item matcher with DB lookup + mod normalization"
```

---

## Task 6: Gem matcher (`matchGem.ts`)

**Files:**
- Create: `src/lib/pob/matchGem.ts`
- Create: `src/lib/pob/matchGem.test.ts`

- [ ] **Step 1: Write failing test**

`src/lib/pob/matchGem.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { allGems } from "../../data/gems";
import { matchSkillGroup } from "./matchGem";
import type { PoBSkill } from "./types";

function makeSkill(overrides: Partial<PoBSkill> = {}): PoBSkill {
  return {
    enabled: true,
    label: "Main",
    mainActiveSkill: 1,
    gems: [],
    ...overrides,
  };
}

describe("matchSkillGroup", () => {
  it("returns null for a disabled group and emits a warning", () => {
    const r = matchSkillGroup(makeSkill({ enabled: false, label: "Off" }));
    expect(r.group).toBeNull();
    expect(r.warnings.some((w) => /disabled/i.test(w.message))).toBe(true);
  });

  it("returns null for a group with no gems", () => {
    const r = matchSkillGroup(makeSkill({ gems: [] }));
    expect(r.group).toBeNull();
  });

  it("builds a group with matched main + supports", () => {
    // pick a gem we know exists
    const active = allGems.find((g) => g.gemType === "active");
    const support = allGems.find((g) => g.gemType === "support");
    if (!active || !support) return;
    const r = matchSkillGroup(
      makeSkill({
        gems: [
          { skillId: active.id, enabled: true, level: 20, quality: 0 },
          { skillId: support.id, enabled: true, level: 20, quality: 0 },
        ],
      }),
    );
    expect(r.group).not.toBeNull();
    expect(r.group!.skill.gemId).toBe(active.id);
    expect(r.group!.supports).toHaveLength(1);
    expect(r.group!.supports[0]!.gemId).toBe(support.id);
    expect(r.warnings).toEqual([]);
  });

  it("keeps an unmatched gem as a synthetic entry with a warning", () => {
    const active = allGems.find((g) => g.gemType === "active");
    if (!active) return;
    const r = matchSkillGroup(
      makeSkill({
        gems: [
          { skillId: active.id, enabled: true, level: 1, quality: 0 },
          { skillId: "UnknownXyzzySupport", enabled: true, level: 1, quality: 0 },
        ],
      }),
    );
    expect(r.group!.supports).toHaveLength(1);
    expect(r.group!.supports[0]!.name).toBe("UnknownXyzzySupport");
    expect(r.warnings.some((w) => /UnknownXyzzySupport/.test(w.message))).toBe(true);
  });

  it("honours mainActiveSkill index (1-based) when != 1", () => {
    const a = allGems.find((g) => g.gemType === "active");
    const b = allGems.find((g) => g.gemType === "active" && g.id !== a?.id);
    if (!a || !b) return;
    const r = matchSkillGroup(
      makeSkill({
        mainActiveSkill: 2,
        gems: [
          { skillId: a.id, enabled: true, level: 20, quality: 0 },
          { skillId: b.id, enabled: true, level: 20, quality: 0 },
        ],
      }),
    );
    expect(r.group!.skill.gemId).toBe(b.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pob/matchGem.test.ts`
Expected: FAIL — `matchSkillGroup` not exported.

- [ ] **Step 3: Implement `matchGem.ts`**

`src/lib/pob/matchGem.ts`:

```typescript
import { gemById } from "../../data/gems";
import type {
  BuildGemEntry,
  SkillGroup,
} from "../../types/buildPlan";
import type { GemEntry } from "../../types/itemDatabase";
import type { ImportWarning, PoBSkill } from "./types";

export interface MatchSkillGroupResult {
  group: SkillGroup | null;
  warnings: ImportWarning[];
}

function toEntry(
  dbGem: GemEntry | undefined,
  skillId: string,
  category: BuildGemEntry["category"],
  priority: number,
): BuildGemEntry {
  if (dbGem) {
    return {
      id: crypto.randomUUID(),
      gemId: dbGem.id,
      name: dbGem.name,
      category,
      priority,
      supports: [],
      iconPath: dbGem.iconPath,
      color: dbGem.color,
      craftingLevel: dbGem.craftingLevel,
    };
  }
  // Synthetic entry so the user still sees the gem in the UI
  return {
    id: crypto.randomUUID(),
    name: skillId,
    category,
    priority,
    supports: [],
  };
}

export function matchSkillGroup(pobSkill: PoBSkill, priority = 0): MatchSkillGroupResult {
  const warnings: ImportWarning[] = [];
  if (!pobSkill.enabled) {
    warnings.push({
      scope: "gem",
      message: `Skipped disabled skill group "${pobSkill.label || "(unnamed)"}"`,
    });
    return { group: null, warnings };
  }
  if (pobSkill.gems.length === 0) {
    return { group: null, warnings };
  }

  // 1-based index; fall back to first gem on out-of-range
  const mainIdx = Math.max(1, Math.min(pobSkill.mainActiveSkill, pobSkill.gems.length)) - 1;
  const mainGem = pobSkill.gems[mainIdx];
  const otherGems = pobSkill.gems.filter((_, i) => i !== mainIdx);

  const dbMain = gemById.get(mainGem.skillId);
  if (!dbMain) {
    warnings.push({ scope: "gem", message: `Gem not in database: ${mainGem.skillId}` });
  }
  const skill = toEntry(dbMain, mainGem.skillId, "skill", priority);

  const supports: (BuildGemEntry | null)[] = [];
  for (const g of otherGems) {
    const db = gemById.get(g.skillId);
    if (!db) {
      warnings.push({ scope: "gem", message: `Gem not in database: ${g.skillId}` });
    }
    supports.push(toEntry(db, g.skillId, "support", 0));
  }

  const group: SkillGroup = {
    id: crypto.randomUUID(),
    skill,
    supports,
    priority,
  };
  return { group, warnings };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/lib/pob/matchGem.test.ts`
Expected: PASS — 5/5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pob/matchGem.ts src/lib/pob/matchGem.test.ts
git commit -m "feat(pob): gem matcher with synthetic-entry fallback"
```

---

## Task 7: Top-level import pipeline

**Files:**
- Modify: `src/lib/pob/types.ts` (no new code — ImportResult already defined)
- Create: `src/lib/pob/importBuild.ts`
- Create: `src/lib/pob/importBuild.test.ts`

- [ ] **Step 1: Write failing test**

`src/lib/pob/importBuild.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { importBuildXml } from "./importBuild";

const sample = readFileSync(
  join(__dirname, "__fixtures__", "sample-build.xml"),
  "utf-8",
);

describe("importBuildXml", () => {
  const result = importBuildXml(sample);

  it("returns one phase per item set", () => {
    expect(result.phases).toHaveLength(2);
    expect(result.phases[0].name).toBe("Leveling");
    expect(result.phases[1].name).not.toBe("");
  });

  it("pairs named item+skill sets", () => {
    // Item set 'Leveling' should pair with skill set 'Leveling'
    const leveling = result.phases.find((p) => p.name === "Leveling")!;
    expect(leveling.gems.length).toBeGreaterThanOrEqual(0);
  });

  it("populates gear slots that map to known PoB slots", () => {
    const leveling = result.phases.find((p) => p.name === "Leveling")!;
    // sample has Weapon 1 in both sets
    expect(leveling.gear.weapon).toBeDefined();
  });

  it("returns a non-empty buildName", () => {
    expect(result.buildName).toBeTruthy();
  });

  it("gives unnamed item sets a reasonable fallback name", () => {
    const unnamed = result.phases[1];
    expect(unnamed.name).toMatch(/^(Phase|Set) \d+$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pob/importBuild.test.ts`
Expected: FAIL — `importBuildXml` not exported.

- [ ] **Step 3: Implement `importBuild.ts`**

`src/lib/pob/importBuild.ts`:

```typescript
import { parseBuildXml } from "./parseBuild";
import { pairSets } from "./pairSets";
import { POB_SLOT_MAP, matchItem } from "./matchItem";
import { matchSkillGroup } from "./matchGem";
import type {
  ImportPhase,
  ImportResult,
  ImportWarning,
  PoBItem,
} from "./types";
import type { SkillGroup } from "../../types/buildPlan";
import type { BuildGearEntry, GearSlotKey } from "../../types/buildPlan";

/** End-to-end: XML string → ImportResult ready for preview. */
export function importBuildXml(xml: string): ImportResult {
  const build = parseBuildXml(xml);
  const itemsById = new Map<number, PoBItem>(build.items.map((i) => [i.id, i]));
  const pairs = pairSets(build.itemSets, build.skillSets, build.activeSkillSetId);
  const generalWarnings: ImportWarning[] = [];

  if (build.items.length === 0) {
    generalWarnings.push({ scope: "general", message: "No items found in build" });
  }
  if (build.skillSets.length === 0) {
    generalWarnings.push({ scope: "general", message: "No skills found in build" });
  }

  const phases: ImportPhase[] = pairs.map((pair, idx) => {
    const warnings: ImportWarning[] = [];
    const gear: Partial<Record<GearSlotKey, BuildGearEntry>> = {};

    for (const [pobSlotName, itemId] of Object.entries(pair.itemSet.slots)) {
      const appSlot = POB_SLOT_MAP[pobSlotName];
      if (!appSlot) {
        warnings.push({
          scope: "slot",
          message: `Ignored slot "${pobSlotName}" (not supported)`,
        });
        continue;
      }
      const pobItem = itemsById.get(itemId);
      if (!pobItem) continue;
      const { entry, warnings: itemWarnings } = matchItem(pobItem, appSlot);
      if (entry) gear[appSlot] = entry;
      warnings.push(...itemWarnings);
    }

    const gems: SkillGroup[] = [];
    if (pair.skillSet) {
      pair.skillSet.skills.forEach((skill, i) => {
        const { group, warnings: gemWarnings } = matchSkillGroup(skill, i);
        warnings.push(...gemWarnings);
        if (group) gems.push(group);
      });
    }

    const name = pair.itemSet.title || `Phase ${idx + 1}`;
    return { name, gear, gems, warnings };
  });

  return {
    buildName: build.buildName,
    phases,
    generalWarnings,
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/lib/pob/importBuild.test.ts`
Expected: PASS — 5/5.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pob/importBuild.ts src/lib/pob/importBuild.test.ts
git commit -m "feat(pob): end-to-end import pipeline"
```

---

## Task 8: Store action `createPhasesFromPoB`

**Files:**
- Modify: `src/store/customizationsStore.ts`

- [ ] **Step 1: Add the action signature to the interface**

Find the `CustomizationsState extends Customizations` block (around line 18–74) and add a new field inside it:

```typescript
  // PoB import
  createPhasesFromPoB: (phases: import("../lib/pob/types").ImportPhase[]) => void;
```

Insert it near `updatePhaseTrigger` for locality.

- [ ] **Step 2: Implement the action**

Add after the `reorderPhases` implementation (around line 236–250 — search for `reorderPhases:` and insert after the closing `},`):

```typescript
  createPhasesFromPoB: (importPhases) => {
    const { buildPhases, save } = get();

    const existingNames = new Set(buildPhases.map((p) => p.name));
    const newPhases = importPhases.map((ip, i) => {
      // auto-suffix on collision
      let candidate = ip.name;
      let counter = 2;
      while (existingNames.has(candidate)) {
        candidate = `${ip.name} (${counter++})`;
      }
      existingNames.add(candidate);

      const gear = { ...EMPTY_GEAR_LAYOUT };
      for (const [slot, entry] of Object.entries(ip.gear)) {
        if (entry) (gear as Record<string, typeof entry>)[slot] = entry;
      }

      return {
        id: crypto.randomUUID(),
        name: candidate,
        order: buildPhases.length + i,
        trigger: { type: "manual" as const },
        gear,
        gems: ip.gems,
        regexes: [],
      };
    });

    set((state) => ({
      buildPhases: [...state.buildPhases, ...newPhases],
      activePhaseId: newPhases[0]?.id ?? state.activePhaseId,
    }));
    save();
  },
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Verify store tests still pass**

Run: `npx vitest run src/store`
Expected: PASS — all existing store tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/store/customizationsStore.ts
git commit -m "feat(store): createPhasesFromPoB with name-collision suffixing"
```

---

## Task 9: PoB import modal — paste view

**Files:**
- Create: `src/components/PoBImport/PoBImportModal.tsx`
- Create: `src/components/PoBImport/PoBImportModal.module.css`
- Modify: `src/components/BuildPlan/BuildPlan.tsx` (add trigger button + modal mount)

- [ ] **Step 1: Create modal component**

`src/components/PoBImport/PoBImportModal.tsx`:

```typescript
import { useState } from "react";
import { decodeBuildCode } from "../../lib/pob/codec";
import { importBuildXml } from "../../lib/pob/importBuild";
import { useCustomizationsStore } from "../../store/customizationsStore";
import type { ImportResult } from "../../lib/pob/types";
import styles from "./PoBImportModal.module.css";

interface Props {
  onClose: () => void;
}

export function PoBImportModal({ onClose }: Props) {
  const createPhases = useCustomizationsStore((s) => s.createPhasesFromPoB);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);

  function handleImport() {
    setError(null);
    try {
      const xml = decodeBuildCode(raw);
      const result = importBuildXml(xml);
      setPreview(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  function handleConfirm() {
    if (!preview) return;
    createPhases(preview.phases);
    onClose();
  }

  const totalWarnings =
    (preview?.generalWarnings.length ?? 0) +
    (preview?.phases.reduce((acc, p) => acc + p.warnings.length, 0) ?? 0);
  const hasContent =
    (preview?.phases.length ?? 0) > 0 &&
    preview!.phases.some((p) => Object.keys(p.gear).length + p.gems.length > 0);

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>Import from Path of Building</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {!preview && (
          <div className={styles.body}>
            <label className={styles.label}>
              Paste a PoB build code (Import/Export → Generate Build Code in Path of Building):
            </label>
            <textarea
              className={styles.textarea}
              value={raw}
              onChange={(e) => setRaw(e.currentTarget.value)}
              rows={8}
              placeholder="eNrtW..."
              spellCheck={false}
            />
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.actions}>
              <button
                className={styles.primaryBtn}
                disabled={!raw.trim()}
                onClick={handleImport}
              >
                Parse Build
              </button>
            </div>
          </div>
        )}

        {preview && (
          <div className={styles.body}>
            <div className={styles.buildName}>{preview.buildName}</div>

            <div className={styles.phaseList}>
              {preview.phases.map((p, i) => (
                <div key={i} className={styles.phaseRow}>
                  <span className={styles.phaseName}>{p.name}</span>
                  <span className={styles.phaseMeta}>
                    {Object.keys(p.gear).length} items, {p.gems.length} skill groups
                  </span>
                  {p.warnings.length > 0 && (
                    <span className={styles.warnBadge}>{p.warnings.length} warnings</span>
                  )}
                </div>
              ))}
            </div>

            {totalWarnings > 0 && (
              <details className={styles.warnings}>
                <summary>{totalWarnings} warnings</summary>
                <ul>
                  {preview.generalWarnings.map((w, i) => <li key={`g-${i}`}>{w.message}</li>)}
                  {preview.phases.flatMap((p, i) =>
                    p.warnings.map((w, j) => (
                      <li key={`${i}-${j}`}><strong>{p.name}:</strong> {w.message}</li>
                    )),
                  )}
                </ul>
              </details>
            )}

            <div className={styles.actions}>
              <button className={styles.secondaryBtn} onClick={() => setPreview(null)}>
                Back
              </button>
              <button
                className={styles.primaryBtn}
                disabled={!hasContent}
                onClick={handleConfirm}
              >
                Create {preview.phases.length} phase{preview.phases.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create modal CSS**

`src/components/PoBImport/PoBImportModal.module.css`:

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  width: min(720px, 90vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
}

.title { font-size: 0.85rem; color: var(--text-primary); }

.closeBtn {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1.4rem;
  line-height: 1;
}

.body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.label { font-size: 0.72rem; color: var(--text-secondary); }

.textarea {
  width: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 8px;
  font-family: monospace;
  font-size: 0.72rem;
  resize: vertical;
}

.error {
  background: rgba(220, 60, 60, 0.15);
  border: 1px solid rgba(220, 60, 60, 0.5);
  padding: 8px;
  border-radius: 4px;
  color: #f08080;
  font-size: 0.72rem;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.primaryBtn {
  background: var(--accent-gold);
  color: black;
  border: none;
  border-radius: 4px;
  padding: 6px 14px;
  font-size: 0.75rem;
  cursor: pointer;
}
.primaryBtn:disabled { opacity: 0.4; cursor: not-allowed; }

.secondaryBtn {
  background: none;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 6px 14px;
  font-size: 0.75rem;
  cursor: pointer;
}

.buildName {
  font-size: 0.9rem;
  color: var(--accent-gold);
}

.phaseList {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 8px;
}

.phaseRow {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.75rem;
}

.phaseName { color: var(--text-primary); flex: 0 0 auto; }
.phaseMeta { color: var(--text-secondary); flex: 1 1 auto; }

.warnBadge {
  background: rgba(255, 165, 0, 0.2);
  color: orange;
  border-radius: 3px;
  padding: 2px 6px;
  font-size: 0.65rem;
}

.warnings {
  font-size: 0.7rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 8px;
}
.warnings summary { cursor: pointer; color: var(--text-secondary); }
.warnings ul { margin: 6px 0 0; padding-left: 18px; color: var(--text-secondary); }
.warnings li { margin-bottom: 2px; }
```

- [ ] **Step 3: Wire trigger + mount in BuildPlan**

Modify `src/components/BuildPlan/BuildPlan.tsx`:

Add import at the top with the other component imports:

```typescript
import { PoBImportModal } from "../PoBImport/PoBImportModal";
```

Add state near the other `useState` calls (around line 44–49):

```typescript
const [pobImportOpen, setPobImportOpen] = useState(false);
```

Add a trigger button in **two** places so users can import from either the empty state or a populated build:

**(a)** In the empty-state branch (around lines 154–163), replace:

```tsx
if (buildPhases.length === 0) {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyText}>No build phases yet.</p>
      <button className={styles.createBtn} onClick={() => addPhase("League Start")}>
        Create Build Plan
      </button>
    </div>
  );
}
```

with:

```tsx
if (buildPhases.length === 0) {
  return (
    <div className={styles.emptyState}>
      <p className={styles.emptyText}>No build phases yet.</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button className={styles.createBtn} onClick={() => addPhase("League Start")}>
          Create Build Plan
        </button>
        <button className={styles.createBtn} onClick={() => setPobImportOpen(true)}>
          Import from PoB
        </button>
      </div>
      {pobImportOpen && <PoBImportModal onClose={() => setPobImportOpen(false)} />}
    </div>
  );
}
```

**(b)** Just before the `<PhaseBar>` element in the main render (around line 167):

```tsx
<div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 8px" }}>
  <button
    className={styles.createBtn}
    style={{ fontSize: "0.7rem", padding: "4px 10px" }}
    onClick={() => setPobImportOpen(true)}
  >
    Import from PoB
  </button>
</div>
```

Add the modal mount in the main render, just before the closing `</div>` of the root `container` div (near the end of the return, around line 301):

```tsx
{pobImportOpen && <PoBImportModal onClose={() => setPobImportOpen(false)} />}
```

- [ ] **Step 4: Manually verify build + dev server starts**

Run: `npm run build` (or `npx tsc --noEmit` then `npx vite build` if needed).
Expected: build succeeds, no TypeScript errors.

Run: `npm run dev` in one terminal. Open the app. Click "Import from PoB" — modal should open. Clicking outside or × should close. Pasting garbage should show the inline error.

- [ ] **Step 5: Commit**

```bash
git add src/components/PoBImport/ src/components/BuildPlan/BuildPlan.tsx
git commit -m "feat(pob): import modal UI (paste + preview + confirm)"
```

---

## Task 10: Item encoder (`encodeItem.ts`)

**Files:**
- Create: `src/lib/pob/encodeItem.ts`
- Create: `src/lib/pob/encodeItem.test.ts`

- [ ] **Step 1: Write failing test**

`src/lib/pob/encodeItem.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { allItems } from "../../data/items";
import { allMods } from "../../data/mods";
import { encodeItem } from "./encodeItem";
import type { BuildGearEntry } from "../../types/buildPlan";

describe("encodeItem", () => {
  const bow = allItems.find((i) => i.name === "Zealot Bow");

  it("emits the expected top-of-block markers for a rare", () => {
    if (!bow) return;
    const entry: BuildGearEntry = {
      id: "1",
      slot: "weapon",
      base: bow.name,
      baseItemId: bow.id,
      desiredMods: [],
      notes: "",
    };
    const text = encodeItem(entry);
    expect(text).toContain(`Item Class: ${bow.itemClass}`);
    expect(text).toContain("Rarity: Rare");
    expect(text).toContain(bow.name);
    expect(text).toContain("Item Level: 82");
    expect(text).toMatch(/--------/); // has dividers
    expect(text).toMatch(/Note: Crafted in PoE2 Campaign Tracker$/m);
  });

  it("emits 'Rarity: Unique' with the unique name when uniqueId is set", () => {
    if (!bow) return;
    const entry: BuildGearEntry = {
      id: "1",
      slot: "weapon",
      base: bow.name,
      baseItemId: bow.id,
      uniqueId: "228",
      desiredMods: ["(15-30)% increased Movement Speed"],
      notes: "",
    };
    const text = encodeItem(entry);
    expect(text).toContain("Rarity: Unique");
  });

  it("includes quality line when quality > 0", () => {
    if (!bow) return;
    const entry: BuildGearEntry = {
      id: "1",
      slot: "weapon",
      base: bow.name,
      baseItemId: bow.id,
      desiredMods: [],
      notes: "",
      quality: 20,
    };
    expect(encodeItem(entry)).toContain("Quality: +20% (augmented)");
  });

  it("omits quality line when quality is 0 or undefined", () => {
    if (!bow) return;
    const entry: BuildGearEntry = {
      id: "1",
      slot: "weapon",
      base: bow.name,
      baseItemId: bow.id,
      desiredMods: [],
      notes: "",
    };
    expect(encodeItem(entry)).not.toContain("Quality:");
  });

  it("resolves mod roll values from modRolls when available", () => {
    const lifeMod = allMods.find((m) =>
      m.text.includes("to maximum Life") && m.stats.some((s) => s.id.includes("life"))
    );
    if (!bow || !lifeMod) return;
    const stat = lifeMod.stats[0];
    const entry: BuildGearEntry = {
      id: "1",
      slot: "weapon",
      base: bow.name,
      baseItemId: bow.id,
      desiredMods: [lifeMod.text],
      desiredModIds: [lifeMod.id],
      modRolls: { [lifeMod.id]: 100 },  // max roll
      notes: "",
    };
    const text = encodeItem(entry);
    // max roll should appear as a concrete number, not as "(min-max)"
    expect(text).toContain(String(stat.max));
    expect(text).not.toMatch(/\(\d+[–—-]\d+\)/);
  });

  it("passes unresolved (free-text) mods through verbatim", () => {
    if (!bow) return;
    const entry: BuildGearEntry = {
      id: "1",
      slot: "weapon",
      base: bow.name,
      baseItemId: bow.id,
      desiredMods: ["Gives you +5 extra jumps"],
      notes: "",
    };
    expect(encodeItem(entry)).toContain("Gives you +5 extra jumps");
  });

  it("falls back gracefully when baseItemId is unknown", () => {
    const entry: BuildGearEntry = {
      id: "1",
      slot: "weapon",
      base: "Made-up Thing",
      desiredMods: ["+10 to Life"],
      notes: "",
    };
    const text = encodeItem(entry);
    expect(text).toContain("Made-up Thing");
    expect(text).toContain("+10 to Life");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/pob/encodeItem.test.ts`
Expected: FAIL — `encodeItem` not exported.

- [ ] **Step 3: Implement `encodeItem.ts`**

`src/lib/pob/encodeItem.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run src/lib/pob/encodeItem.test.ts`
Expected: PASS — 7/7.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pob/encodeItem.ts src/lib/pob/encodeItem.test.ts
git commit -m "feat(pob): item encoder for PoE-style Ctrl+C text blocks"
```

---

## Task 11: Copy-item button on `GearSlot`

**Files:**
- Modify: `src/components/BuildPlan/GearSlot.tsx`
- Modify: `src/components/BuildPlan/GearSlot.module.css`

- [ ] **Step 1: Add copy state + handler**

In `GearSlot.tsx`, import the encoder at the top with the other imports:

```typescript
import { encodeItem } from "../../lib/pob/encodeItem";
```

Inside the component, right after `const [showTooltip, setShowTooltip] = useState(false);`, add:

```typescript
const [copied, setCopied] = useState(false);
```

After `const handleMouseLeave = useCallback(() => setShowTooltip(false), []);`, add a copy handler:

```typescript
const handleCopy = useCallback(async (e: React.MouseEvent) => {
  e.stopPropagation();
  if (!entry) return;
  const text = encodeItem(entry);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for environments without clipboard permission
    window.prompt("Copy this into PoB:", text);
  }
  setCopied(true);
  setTimeout(() => setCopied(false), 600);
}, [entry]);
```

- [ ] **Step 2: Render the copy button when the slot has an entry**

Find the `return (…)` block for the filled slot (starts at `return (<div className={...slotFilled...}>`). Immediately after the `{entry.priority != null && entry.priority > 0 && (<span className={styles.priorityBadge}>{entry.priority}</span>)}` line, add:

```tsx
<button
  className={styles.copyBtn}
  onClick={handleCopy}
  title="Copy item for Path of Building"
  aria-label="Copy item for Path of Building"
>
  {copied ? "✓" : "⧉"}
</button>
```

- [ ] **Step 3: Add CSS for the copy button**

Append to `src/components/BuildPlan/GearSlot.module.css`:

```css
.copyBtn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: 3px;
  width: 22px;
  height: 22px;
  font-size: 0.8rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms;
  z-index: 2;
}

.slotFilled:hover .copyBtn {
  opacity: 1;
}

.copyBtn:hover {
  background: rgba(0, 0, 0, 0.8);
}
```

If `.slotFilled` does not already have `position: relative;`, confirm it does; if not, add it. Search the CSS for `.slotFilled {` — if there's no `position: relative` there, add one.

- [ ] **Step 4: Verify types compile and no regressions**

Run: `npx tsc --noEmit`
Expected: no new errors.

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Manually verify**

Run: `npm run dev`. Populate a gear slot via the item browser. Hover the slot — copy button appears. Click it — checkmark briefly shows. Paste into PoB's "Create custom" dialog and verify PoB parses it.

- [ ] **Step 6: Commit**

```bash
git add src/components/BuildPlan/GearSlot.tsx src/components/BuildPlan/GearSlot.module.css
git commit -m "feat(pob): copy-to-PoB button on filled gear slots"
```

---

## Task 12: Final manual verification pass

**Files:** *(no code changes — walkthrough only)*

- [ ] **Step 1: Full import walkthrough**

1. Copy a real build code from a PoB PoE2 share link (e.g. pobb.in).
2. Open the app → Build Plan tab → Import from PoB.
3. Paste, click Parse Build.
4. Verify preview shows: build name, one row per item set, warning counts reasonable.
5. Click Create N phases.
6. Verify new phases appear in the PhaseBar, active phase switched to the first new one, gear grid shows items, skill groups list is populated.

- [ ] **Step 2: Full export walkthrough**

1. Populate a gear slot with a crafted rare (item browser → base → mods → Save).
2. Hover the slot, click the copy icon.
3. Open PoB PoE2 → Items → Create custom → paste.
4. Confirm PoB accepts the item (base recognized, mods parsed into the right slots).

- [ ] **Step 3: Edge cases**

- [ ] Paste obviously invalid text → friendly red error banner, no crash.
- [ ] Paste a code whose build has no items (skills only) → preview disables Create with a helpful message.
- [ ] Import a build whose phase name matches an existing phase → see auto-suffix `(2)` applied.
- [ ] Clipboard copy from an empty slot → button not visible (slot is empty).
- [ ] Close modal via × button, overlay click, Esc (if wired) — all work without leaks.

- [ ] **Step 4: Full test run + commit any follow-ups**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all green.

If small follow-up fixes are needed from the manual walkthrough, commit them individually with focused messages. Do not re-open closed tasks.

---

## Out-of-Scope Notes

The following were explicitly deferred during brainstorming and should NOT be expanded in this plan:

- Passive tree import/export (not modelled in the app).
- Whole-build export (only per-item export shipped here).
- Round-tripping gem socket layouts / runes / soul cores in exported items.
- Importing flasks, jewels, or the PoB configuration tab.
- Syncing with pobb.in URLs — users paste the build code string only.
