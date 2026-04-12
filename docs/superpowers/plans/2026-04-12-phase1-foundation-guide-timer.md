# PoE2 Campaign Tracker — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working PoE2 campaign tracker desktop app with step-by-step guide rendering, auto-advance from game log, campaign timer, and level indicator — all in companion mode (second-monitor window).

**Architecture:** Tauri v2 desktop app with React + TypeScript frontend. Rust backend handles file I/O, Client.txt log tailing, and PoE2 install detection. Frontend uses Zustand for state, renders campaign guide data transformed from Exile-UI JSON files. Phase 1 covers companion mode only — overlay mode, gem tracker, gear advisor, vendor regex, zone maps, and settings panel are Phase 2.

**Tech Stack:** Tauri v2, React 18, TypeScript, Vite, Zustand, Vitest, @testing-library/react

**Design Spec:** `docs/superpowers/specs/2026-04-12-poe2-campaign-tracker-design.md`

---

## File Map

### New files created in this plan

**Frontend (src/):**
- `src/types.ts` — all shared TypeScript interfaces
- `src/data/raw/guide.json` — raw Exile-UI guide data (downloaded)
- `src/data/raw/areas.json` — raw Exile-UI areas data (downloaded)
- `src/data/guide.ts` — transformed guide data + transform function
- `src/data/areas.ts` — transformed areas data + transform function
- `src/lib/tokenizer.ts` — markup string → StepToken[] parser
- `src/lib/tokenizer.test.ts` — tokenizer tests
- `src/data/guide.test.ts` — guide transform tests
- `src/components/StepRenderer.tsx` — renders StepToken[] as React elements
- `src/components/StepRenderer.module.css` — step renderer styles
- `src/components/GuidePanel/GuidePanel.tsx` — main guide view
- `src/components/GuidePanel/GuidePanel.module.css` — guide panel styles
- `src/components/CampaignTimer/CampaignTimer.tsx` — timer display
- `src/components/CampaignTimer/CampaignTimer.module.css` — timer styles
- `src/components/LevelIndicator/LevelIndicator.tsx` — level/XP indicator
- `src/components/LevelIndicator/LevelIndicator.module.css` — level indicator styles
- `src/components/Toast/Toast.tsx` — toast notification component
- `src/components/Toast/Toast.module.css` — toast styles
- `src/layouts/CompanionLayout.tsx` — companion mode layout shell
- `src/layouts/CompanionLayout.module.css` — companion layout styles
- `src/store/guideStore.ts` — guide state (Zustand)
- `src/store/timerStore.ts` — timer state (Zustand)
- `src/store/settingsStore.ts` — settings state (Zustand)
- `src/hooks/useLogWatcher.ts` — subscribe to zone-change events
- `src/hooks/useAutoAdvance.ts` — auto-advance guide on zone change
- `src/hooks/useTimer.ts` — timer tick logic
- `src/hooks/usePersistence.ts` — load/save state to Tauri file I/O
- `src/theme.css` — dark theme CSS variables
- `src/setupTests.ts` — vitest setup file

**Tauri backend (src-tauri/):**
- `src-tauri/src/commands/mod.rs` — module declarations
- `src-tauri/src/commands/file_io.rs` — read/write user data JSON files
- `src-tauri/src/commands/log_watcher.rs` — tail Client.txt, emit events
- `src-tauri/src/commands/detect.rs` — auto-detect PoE2 install path

**Modified files:**
- `src-tauri/src/lib.rs` — register commands, setup log watcher
- `src-tauri/src/main.rs` — unchanged (calls lib::run)
- `src-tauri/Cargo.toml` — add dependencies (notify, regex)
- `src-tauri/tauri.conf.json` — app metadata, window config
- `src/App.tsx` — root component wiring
- `src/main.tsx` — entry point
- `package.json` — add zustand, vitest deps
- `vite.config.ts` — vitest config
- `tsconfig.json` — path aliases if needed

---

## Task 1: Scaffold Tauri + React + TypeScript Project

**Files:**
- Create: entire project scaffold
- Modify: `package.json`, `vite.config.ts`

- [ ] **Step 1: Scaffold the Tauri project**

Run from the parent directory since our project dir already has files:

```bash
cd D:/Github
npx create-tauri-app@latest poe2-scaffold --template react-ts --manager npm
```

Then merge into the existing project:

```bash
# Copy scaffold files into our project (don't overwrite .git or docs/)
cp -r poe2-scaffold/src D:/Github/poe2campaigntracker/
cp -r poe2-scaffold/src-tauri D:/Github/poe2campaigntracker/
cp poe2-scaffold/package.json D:/Github/poe2campaigntracker/
cp poe2-scaffold/tsconfig.json D:/Github/poe2campaigntracker/
cp poe2-scaffold/tsconfig.node.json D:/Github/poe2campaigntracker/ 2>/dev/null || true
cp poe2-scaffold/vite.config.ts D:/Github/poe2campaigntracker/
cp poe2-scaffold/index.html D:/Github/poe2campaigntracker/
cp poe2-scaffold/.gitignore D:/Github/poe2campaigntracker/ 2>/dev/null || true
rm -rf poe2-scaffold
```

- [ ] **Step 2: Install base dependencies**

```bash
cd D:/Github/poe2campaigntracker
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Install additional frontend dependencies**

```bash
npm install zustand
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @types/node
```

- [ ] **Step 4: Configure Vitest**

Add vitest config to `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    css: true,
  },
});
```

Create `src/setupTests.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

Add test script to `package.json` scripts:

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 5: Verify build and test**

```bash
npm run test -- --passWithNoTests
npm run tauri dev
```

Expected: Tauri dev window opens with default React template. Tests pass (none yet). Kill the dev server after verifying.

- [ ] **Step 6: Update Tauri app metadata**

In `src-tauri/tauri.conf.json`, update:

```json
{
  "productName": "PoE2 Campaign Tracker",
  "version": "0.1.0",
  "identifier": "com.poe2campaigntracker.app",
  "app": {
    "windows": [
      {
        "title": "PoE2 Campaign Tracker",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600
      }
    ]
  }
}
```

- [ ] **Step 7: Add Rust dependencies**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
notify = "7"
regex = "1"
```

Run to verify Rust compiles:

```bash
cd src-tauri && cargo check && cd ..
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "scaffold: Tauri v2 + React + TypeScript project

Includes zustand for state management, vitest for testing,
notify + regex crates for log watching."
```

---

## Task 2: TypeScript Types and Raw Data

**Files:**
- Create: `src/types.ts`, `src/data/raw/guide.json`, `src/data/raw/areas.json`

- [ ] **Step 1: Define shared TypeScript types**

Create `src/types.ts`:

```typescript
// === Guide Data Types ===

export interface GuidePage {
  act: number; // 1-4 for campaign, 5-7 for postgame, 8 for endgame
  pageIndex: number; // index within the act
  globalIndex: number; // index across all pages
  targetAreaId: string; // zone ID that triggers advance (last areaid on page)
  targetZoneName: string; // human-readable zone name
  steps: GuideStep[];
  condition?: GuideCondition; // if this page is conditional
}

export interface GuideCondition {
  key: string; // e.g. "league-start"
  value: string; // e.g. "yes" or "no"
}

export interface GuideStep {
  raw: string; // original markup string
  tokens: StepToken[];
  isHint: boolean;
}

export type StepTokenType =
  | "text"
  | "icon"
  | "color_start"
  | "color_end"
  | "zone"
  | "arena"
  | "quest"
  | "separator"
  | "kill";

export interface StepToken {
  type: StepTokenType;
  value: string; // display text or icon name
  color?: string; // hex color for color tokens
  zoneId?: string; // area ID for zone tokens
}

// === Area Data Types ===

export interface Area {
  id: string; // e.g. "g1_1", "g1_town"
  name: string; // e.g. "the riverbank"
  act: number; // 1-8
  recommendation?: { min: number; max: number }; // level range
}

// === Persistence Types ===

export interface Settings {
  clientTxtPath: string | null;
  fontSize: number;
  displayMode: "companion" | "overlay";
  notifications: {
    autoAdvance: boolean;
    gemAlerts: boolean;
    vendorReminders: boolean;
  };
  autoShowVendorRegex: boolean;
}

export interface Progress {
  currentPageIndex: number;
  timerState: "stopped" | "running" | "paused";
  timerStartedAt: string | null; // ISO timestamp
  timerPausedElapsed: number; // ms accumulated while paused
  actSplits: Record<
    string,
    {
      startedAt: string;
      completedAt: string | null;
      elapsed: number | null;
    }
  >;
}

export interface ZoneChangeEvent {
  areaId: string;
  level: number;
  timestamp: string;
}

// === Default Values ===

export const DEFAULT_SETTINGS: Settings = {
  clientTxtPath: null,
  fontSize: 14,
  displayMode: "companion",
  notifications: {
    autoAdvance: true,
    gemAlerts: true,
    vendorReminders: true,
  },
  autoShowVendorRegex: true,
};

export const DEFAULT_PROGRESS: Progress = {
  currentPageIndex: 0,
  timerState: "stopped",
  timerStartedAt: null,
  timerPausedElapsed: 0,
  actSplits: {},
};
```

- [ ] **Step 2: Download raw Exile-UI data files**

```bash
cd D:/Github/poe2campaigntracker
mkdir -p src/data/raw

curl -o src/data/raw/guide.json "https://raw.githubusercontent.com/Lailloken/Exile-UI/refs/heads/main/data/english/%5Bleveltracker%5D%20default%20guide%202.json"

curl -o src/data/raw/areas.json "https://raw.githubusercontent.com/Lailloken/Exile-UI/refs/heads/main/data/english/%5Bleveltracker%5D%20areas%202.json"

curl -o src/data/raw/gems.json "https://raw.githubusercontent.com/Lailloken/Exile-UI/refs/heads/main/data/english/%5Bleveltracker%5D%20gems%202.json"
```

Verify files downloaded:

```bash
wc -l src/data/raw/guide.json src/data/raw/areas.json src/data/raw/gems.json
```

Expected: All three files exist and have content (guide.json is the largest).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/data/raw/
git commit -m "feat: add TypeScript types and raw Exile-UI data files

Downloads PoE2 guide, areas, and gems JSON from Exile-UI repo.
Defines all shared interfaces for guide pages, areas, settings,
and progress persistence."
```

---

## Task 3: Data Transform Functions

**Files:**
- Create: `src/data/guide.ts`, `src/data/areas.ts`, `src/data/guide.test.ts`

- [ ] **Step 1: Write tests for guide data transform**

Create `src/data/guide.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { transformGuideData, extractTargetAreaId } from "./guide";

describe("extractTargetAreaId", () => {
  it("extracts area ID from a step with areaid prefix", () => {
    const result = extractTargetAreaId([
      "kill the_bloated_miller",
      "enter areaidg1_town ;; clearfell encampment",
    ]);
    expect(result).toEqual({ id: "g1_town", name: "clearfell encampment" });
  });

  it("extracts the last area ID when multiple exist", () => {
    const result = extractTargetAreaId([
      "(img:quest_2) renly: (img:skill) || enter areaidg1_2 ;; clearfell",
      "go to areaidg1_3 ;; mud burrow",
    ]);
    expect(result).toEqual({ id: "g1_3", name: "mud burrow" });
  });

  it("returns empty strings when no area ID found", () => {
    const result = extractTargetAreaId(["kill some_boss", "pick up loot"]);
    expect(result).toEqual({ id: "", name: "" });
  });
});

describe("transformGuideData", () => {
  it("transforms a simple act with two pages", () => {
    const raw = [
      [
        ["step one", "enter areaidg1_town ;; town"],
        ["step two", "go to areaidg1_2 ;; clearfell"],
      ],
    ];
    const pages = transformGuideData(raw);
    expect(pages).toHaveLength(2);
    expect(pages[0].act).toBe(1);
    expect(pages[0].pageIndex).toBe(0);
    expect(pages[0].globalIndex).toBe(0);
    expect(pages[0].targetAreaId).toBe("g1_town");
    expect(pages[0].targetZoneName).toBe("town");
    expect(pages[0].steps).toHaveLength(2);
    expect(pages[1].act).toBe(1);
    expect(pages[1].pageIndex).toBe(1);
    expect(pages[1].globalIndex).toBe(1);
    expect(pages[1].targetAreaId).toBe("g1_2");
  });

  it("handles conditional pages", () => {
    const raw = [
      [
        ["step one", "enter areaidg1_town ;; town"],
        {
          condition: ["league-start", "yes"],
          lines: ["league start step", "enter areaidg1_2 ;; zone"],
        },
        {
          condition: ["league-start", "no"],
          lines: ["non-league step", "enter areaidg1_2 ;; zone"],
        },
      ],
    ];
    const pages = transformGuideData(raw);
    expect(pages).toHaveLength(3);
    expect(pages[1].condition).toEqual({ key: "league-start", value: "yes" });
    expect(pages[2].condition).toEqual({ key: "league-start", value: "no" });
  });

  it("assigns correct act numbers across multiple acts", () => {
    const raw = [
      [["enter areaidg1_town ;; town1"]],
      [["enter areaidg2_town ;; town2"]],
    ];
    const pages = transformGuideData(raw);
    expect(pages[0].act).toBe(1);
    expect(pages[1].act).toBe(2);
    expect(pages[1].globalIndex).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/data/guide.test.ts
```

Expected: FAIL — `guide.ts` module doesn't exist yet.

- [ ] **Step 3: Implement guide data transform**

Create `src/data/guide.ts`:

```typescript
import { tokenize } from "../lib/tokenizer";
import type { GuidePage, GuideStep, GuideCondition } from "../types";
import rawGuideData from "./raw/guide.json";

// Raw data types from Exile-UI JSON
type RawStep = string;
type RawPage = RawStep[];
type RawConditionalPage = {
  condition: [string, string];
  lines: string[];
};
type RawEntry = RawPage | RawConditionalPage;
type RawAct = RawEntry[];
type RawGuide = RawAct[];

function isConditionalPage(entry: RawEntry): entry is RawConditionalPage {
  return (
    typeof entry === "object" &&
    !Array.isArray(entry) &&
    "condition" in entry
  );
}

export function extractTargetAreaId(steps: string[]): {
  id: string;
  name: string;
} {
  const areaIdPattern = /areaid(\w+)\s*;;\s*(.+?)$/;
  let lastId = "";
  let lastName = "";

  for (const step of steps) {
    const matches = [...step.matchAll(new RegExp(areaIdPattern, "g"))];
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      lastId = lastMatch[1].toLowerCase();
      lastName = lastMatch[2].trim().toLowerCase();
    }
  }

  return { id: lastId, name: lastName };
}

function transformSteps(rawSteps: string[]): GuideStep[] {
  return rawSteps.map((raw) => ({
    raw,
    tokens: tokenize(raw),
    isHint: raw.startsWith("(hint)"),
  }));
}

export function transformGuideData(raw: RawGuide): GuidePage[] {
  const pages: GuidePage[] = [];
  let globalIndex = 0;

  for (let actIndex = 0; actIndex < raw.length; actIndex++) {
    const act = raw[actIndex];
    let pageIndex = 0;

    for (const entry of act) {
      if (isConditionalPage(entry)) {
        const { id, name } = extractTargetAreaId(entry.lines);
        const condition: GuideCondition = {
          key: entry.condition[0],
          value: entry.condition[1],
        };
        pages.push({
          act: actIndex + 1,
          pageIndex,
          globalIndex,
          targetAreaId: id,
          targetZoneName: name,
          steps: transformSteps(entry.lines),
          condition,
        });
      } else {
        const { id, name } = extractTargetAreaId(entry);
        pages.push({
          act: actIndex + 1,
          pageIndex,
          globalIndex,
          targetAreaId: id,
          targetZoneName: name,
          steps: transformSteps(entry),
        });
      }
      pageIndex++;
      globalIndex++;
    }
  }

  return pages;
}

// Pre-computed guide pages from bundled data
export const guidePages: GuidePage[] = transformGuideData(
  rawGuideData as RawGuide
);
```

Note: This depends on the tokenizer from Task 4. For now, create a stub `src/lib/tokenizer.ts`:

```typescript
import type { StepToken } from "../types";

export function tokenize(raw: string): StepToken[] {
  // Stub — implemented in Task 4
  return [{ type: "text", value: raw }];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/data/guide.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Implement areas data transform**

Create `src/data/areas.ts`:

```typescript
import type { Area } from "../types";
import rawAreasData from "./raw/areas.json";

type RawArea = {
  id: string;
  name: string;
  recommendation?: string; // "min | max"
};
type RawAreas = RawArea[][];

function parseRecommendation(
  rec?: string
): { min: number; max: number } | undefined {
  if (!rec) return undefined;
  const parts = rec.split("|").map((s) => parseInt(s.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { min: parts[0], max: parts[1] };
  }
  return undefined;
}

export function transformAreasData(raw: RawAreas): Area[] {
  const areas: Area[] = [];
  for (let actIndex = 0; actIndex < raw.length; actIndex++) {
    for (const rawArea of raw[actIndex]) {
      areas.push({
        id: rawArea.id.toLowerCase(),
        name: rawArea.name.toLowerCase(),
        act: actIndex + 1,
        recommendation: parseRecommendation(rawArea.recommendation),
      });
    }
  }
  return areas;
}

export const areas: Area[] = transformAreasData(rawAreasData as RawAreas);

// Lookup helpers
export const areaById = new Map(areas.map((a) => [a.id, a]));

export function getAreaAct(areaId: string): number | undefined {
  return areaById.get(areaId.toLowerCase())?.act;
}

export function isTownZone(areaId: string): boolean {
  return areaId.toLowerCase().includes("town");
}
```

- [ ] **Step 6: Enable JSON imports in TypeScript**

In `tsconfig.json`, ensure these compiler options are set:

```json
{
  "compilerOptions": {
    "resolveJsonModule": true,
    "esModuleInterop": true
  }
}
```

- [ ] **Step 7: Verify everything compiles**

```bash
npx vitest run src/data/guide.test.ts
npx tsc --noEmit
```

Expected: Tests pass, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/data/ src/lib/tokenizer.ts src/types.ts tsconfig.json
git commit -m "feat: data pipeline for guide and areas

Transform Exile-UI JSON into typed GuidePage[] and Area[] arrays.
Includes extractTargetAreaId for auto-advance zone matching,
area lookup helpers, and town zone detection."
```

---

## Task 4: Guide Markup Tokenizer (TDD)

**Files:**
- Create: `src/lib/tokenizer.test.ts`
- Modify: `src/lib/tokenizer.ts` (replace stub)

- [ ] **Step 1: Write comprehensive tokenizer tests**

Create `src/lib/tokenizer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";
import type { StepToken } from "../types";

describe("tokenize", () => {
  it("returns plain text for a simple string", () => {
    const result = tokenize("go north");
    expect(result).toEqual([{ type: "text", value: "go north" }]);
  });

  it("parses (img:waypoint) as an icon token", () => {
    const result = tokenize("get (img:waypoint)");
    expect(result).toEqual([
      { type: "text", value: "get " },
      { type: "icon", value: "waypoint" },
    ]);
  });

  it("parses multiple icon types", () => {
    const icons = [
      "waypoint",
      "checkpoint",
      "quest_2",
      "portal",
      "skill",
      "support",
      "in-out2",
      "lab",
    ];
    for (const icon of icons) {
      const result = tokenize(`(img:${icon})`);
      expect(result).toEqual([{ type: "icon", value: icon }]);
    }
  });

  it("parses (color:hex)text as color tokens", () => {
    const result = tokenize("(color:red)important info");
    expect(result).toEqual([
      { type: "color_start", value: "", color: "red" },
      { type: "text", value: "important info" },
    ]);
  });

  it("parses (color:cc99ff)location_name", () => {
    const result = tokenize("go to (color:cc99ff)mysterious_campsite");
    expect(result).toEqual([
      { type: "text", value: "go to " },
      { type: "color_start", value: "", color: "cc99ff" },
      { type: "text", value: "mysterious_campsite" },
    ]);
  });

  it("parses (hint)_ prefix", () => {
    const result = tokenize("(hint)_ this is a hint");
    expect(result).toEqual([{ type: "text", value: "this is a hint" }]);
  });

  it("parses (hint)__ prefix (double underscore)", () => {
    const result = tokenize("(hint)__ indented hint");
    expect(result).toEqual([{ type: "text", value: "indented hint" }]);
  });

  it("parses areaid with zone name", () => {
    const result = tokenize("enter areaidg1_town ;; clearfell encampment");
    expect(result).toEqual([
      { type: "text", value: "enter " },
      {
        type: "zone",
        value: "clearfell encampment",
        zoneId: "g1_town",
      },
    ]);
  });

  it("parses arena: references", () => {
    const result = tokenize("arena:devourer in the cave");
    expect(result).toEqual([
      { type: "arena", value: "devourer" },
      { type: "text", value: " in the cave" },
    ]);
  });

  it("parses (quest:name) references", () => {
    const result = tokenize("kill boss for (quest:ring)");
    expect(result).toEqual([
      { type: "text", value: "kill boss for " },
      { type: "quest", value: "ring" },
    ]);
  });

  it("parses || as separator", () => {
    const result = tokenize("do thing || go somewhere");
    expect(result).toEqual([
      { type: "text", value: "do thing " },
      { type: "separator", value: "||" },
      { type: "text", value: " go somewhere" },
    ]);
  });

  it("parses kill keyword with enemy name", () => {
    const result = tokenize("kill the_bloated_miller");
    expect(result).toEqual([
      { type: "kill", value: "kill" },
      { type: "text", value: " the_bloated_miller" },
    ]);
  });

  it("handles complex mixed markup", () => {
    const input =
      "(img:quest_2) renly: (img:skill) || enter areaidg1_2 ;; clearfell";
    const result = tokenize(input);
    expect(result.length).toBeGreaterThan(3);
    expect(result.find((t) => t.type === "icon" && t.value === "quest_2")).toBeTruthy();
    expect(result.find((t) => t.type === "icon" && t.value === "skill")).toBeTruthy();
    expect(result.find((t) => t.type === "separator")).toBeTruthy();
    expect(result.find((t) => t.type === "zone" && t.zoneId === "g1_2")).toBeTruthy();
  });

  it("handles color followed by another markup", () => {
    const input = "(color:ff00ff)2_tasks: get (img:waypoint)";
    const result = tokenize(input);
    const colorToken = result.find((t) => t.type === "color_start");
    const iconToken = result.find((t) => t.type === "icon");
    expect(colorToken).toBeTruthy();
    expect(colorToken!.color).toBe("ff00ff");
    expect(iconToken).toBeTruthy();
    expect(iconToken!.value).toBe("waypoint");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/tokenizer.test.ts
```

Expected: FAIL — stub tokenizer returns everything as plain text.

- [ ] **Step 3: Implement the tokenizer**

Replace `src/lib/tokenizer.ts`:

```typescript
import type { StepToken } from "../types";

// Regex patterns for markup elements, ordered by priority
const PATTERNS = {
  hint: /^\(hint\)_+\s*/,
  icon: /\(img:([a-z0-9_-]+)\)/,
  color: /\(color:([a-z0-9]+)\)/,
  zone: /areaid(\w+)\s*;;\s*([^|]+?)(?=\s*\||$)/,
  arena: /arena:(\w+)/,
  quest: /\(quest:([^)]+)\)/,
  separator: /\s*\|\|\s*/,
  kill: /^kill\s/,
};

export function tokenize(raw: string): StepToken[] {
  const tokens: StepToken[] = [];
  let input = raw;

  // Strip hint prefix — the isHint flag on GuideStep handles styling
  const hintMatch = input.match(PATTERNS.hint);
  if (hintMatch) {
    input = input.slice(hintMatch[0].length);
  }

  // Strip leading "kill " — emit as kill token
  const killMatch = input.match(PATTERNS.kill);
  if (killMatch) {
    tokens.push({ type: "kill", value: "kill" });
    input = input.slice(4); // remove "kill" but keep the space
  }

  while (input.length > 0) {
    // Find the earliest matching pattern
    let earliest: {
      index: number;
      length: number;
      token: StepToken;
    } | null = null;

    // Icon: (img:name)
    const iconMatch = input.match(PATTERNS.icon);
    if (iconMatch && iconMatch.index !== undefined) {
      const candidate = {
        index: iconMatch.index,
        length: iconMatch[0].length,
        token: { type: "icon" as const, value: iconMatch[1] },
      };
      if (!earliest || candidate.index < earliest.index) earliest = candidate;
    }

    // Color: (color:hex)
    const colorMatch = input.match(PATTERNS.color);
    if (colorMatch && colorMatch.index !== undefined) {
      const candidate = {
        index: colorMatch.index,
        length: colorMatch[0].length,
        token: {
          type: "color_start" as const,
          value: "",
          color: colorMatch[1],
        },
      };
      if (!earliest || candidate.index < earliest.index) earliest = candidate;
    }

    // Zone: areaidXXX ;; Zone Name
    const zoneMatch = input.match(PATTERNS.zone);
    if (zoneMatch && zoneMatch.index !== undefined) {
      const candidate = {
        index: zoneMatch.index,
        length: zoneMatch[0].length,
        token: {
          type: "zone" as const,
          value: zoneMatch[2].trim(),
          zoneId: zoneMatch[1].toLowerCase(),
        },
      };
      if (!earliest || candidate.index < earliest.index) earliest = candidate;
    }

    // Arena: arena:name
    const arenaMatch = input.match(PATTERNS.arena);
    if (arenaMatch && arenaMatch.index !== undefined) {
      const candidate = {
        index: arenaMatch.index,
        length: arenaMatch[0].length,
        token: { type: "arena" as const, value: arenaMatch[1] },
      };
      if (!earliest || candidate.index < earliest.index) earliest = candidate;
    }

    // Quest: (quest:name)
    const questMatch = input.match(PATTERNS.quest);
    if (questMatch && questMatch.index !== undefined) {
      const candidate = {
        index: questMatch.index,
        length: questMatch[0].length,
        token: { type: "quest" as const, value: questMatch[1] },
      };
      if (!earliest || candidate.index < earliest.index) earliest = candidate;
    }

    // Separator: ||
    const sepMatch = input.match(PATTERNS.separator);
    if (sepMatch && sepMatch.index !== undefined) {
      const candidate = {
        index: sepMatch.index,
        length: sepMatch[0].length,
        token: { type: "separator" as const, value: "||" },
      };
      if (!earliest || candidate.index < earliest.index) earliest = candidate;
    }

    if (earliest) {
      // Emit text before the match
      if (earliest.index > 0) {
        tokens.push({ type: "text", value: input.slice(0, earliest.index) });
      }
      tokens.push(earliest.token);
      input = input.slice(earliest.index + earliest.length);
    } else {
      // No more patterns — rest is text
      if (input.length > 0) {
        tokens.push({ type: "text", value: input });
      }
      break;
    }
  }

  return tokens;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/tokenizer.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass (tokenizer + guide transform).

- [ ] **Step 6: Commit**

```bash
git add src/lib/tokenizer.ts src/lib/tokenizer.test.ts
git commit -m "feat: guide markup tokenizer with full test coverage

Parses Exile-UI markup syntax into StepToken arrays. Handles icons,
colors, zone references, arenas, quests, separators, kill keywords,
and hint prefixes."
```

---

## Task 5: Guide Store (Zustand)

**Files:**
- Create: `src/store/guideStore.ts`

- [ ] **Step 1: Implement guide store**

Create `src/store/guideStore.ts`:

```typescript
import { create } from "zustand";
import { guidePages } from "../data/guide";
import type { GuidePage, GuideCondition } from "../types";

interface GuideState {
  allPages: GuidePage[];
  pages: GuidePage[]; // filtered by conditions
  currentPageIndex: number;
  conditions: Record<string, string>; // user's condition choices

  // Computed
  currentPage: GuidePage | null;
  currentAct: number;
  totalPages: number;

  // Actions
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (globalIndex: number) => void;
  goToAct: (act: number) => void;
  setCondition: (key: string, value: string) => void;
  advanceToZone: (areaId: string) => void;
  reset: () => void;
}

function filterPages(
  allPages: GuidePage[],
  conditions: Record<string, string>
): GuidePage[] {
  return allPages.filter((page) => {
    if (!page.condition) return true;
    const userChoice = conditions[page.condition.key];
    if (!userChoice) return true; // include if no preference set
    return page.condition.value === userChoice;
  });
}

function findPageForZone(
  pages: GuidePage[],
  areaId: string,
  fromIndex: number
): number {
  const normalizedId = areaId.toLowerCase();
  // Search forward from current position
  for (let i = fromIndex; i < pages.length; i++) {
    if (pages[i].targetAreaId === normalizedId) {
      return i;
    }
  }
  return -1; // not found
}

export const useGuideStore = create<GuideState>((set, get) => {
  const allPages = guidePages;
  const defaultConditions: Record<string, string> = {
    "league-start": "yes",
  };
  const filteredPages = filterPages(allPages, defaultConditions);

  return {
    allPages,
    pages: filteredPages,
    currentPageIndex: 0,
    conditions: defaultConditions,

    get currentPage() {
      const { pages, currentPageIndex } = get();
      return pages[currentPageIndex] ?? null;
    },

    get currentAct() {
      const page = get().currentPage;
      return page?.act ?? 1;
    },

    get totalPages() {
      return get().pages.length;
    },

    nextPage: () =>
      set((state) => ({
        currentPageIndex: Math.min(
          state.currentPageIndex + 1,
          state.pages.length - 1
        ),
      })),

    prevPage: () =>
      set((state) => ({
        currentPageIndex: Math.max(state.currentPageIndex - 1, 0),
      })),

    goToPage: (globalIndex: number) =>
      set((state) => {
        const idx = state.pages.findIndex((p) => p.globalIndex === globalIndex);
        return { currentPageIndex: idx >= 0 ? idx : state.currentPageIndex };
      }),

    goToAct: (act: number) =>
      set((state) => {
        const idx = state.pages.findIndex((p) => p.act === act);
        return { currentPageIndex: idx >= 0 ? idx : state.currentPageIndex };
      }),

    setCondition: (key: string, value: string) =>
      set((state) => {
        const conditions = { ...state.conditions, [key]: value };
        const pages = filterPages(state.allPages, conditions);
        return {
          conditions,
          pages,
          currentPageIndex: Math.min(
            state.currentPageIndex,
            pages.length - 1
          ),
        };
      }),

    advanceToZone: (areaId: string) =>
      set((state) => {
        const idx = findPageForZone(
          state.pages,
          areaId,
          state.currentPageIndex
        );
        if (idx >= 0 && idx > state.currentPageIndex) {
          return { currentPageIndex: idx };
        }
        return state;
      }),

    reset: () =>
      set((state) => ({
        currentPageIndex: 0,
        pages: filterPages(state.allPages, state.conditions),
      })),
  };
});
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/guideStore.ts
git commit -m "feat: Zustand guide store with navigation and zone advance

Supports page navigation, act jumping, condition filtering, and
advanceToZone for auto-advance from log watcher."
```

---

## Task 6: Guide UI Components

**Files:**
- Create: `src/components/StepRenderer.tsx`, `src/components/StepRenderer.module.css`, `src/components/GuidePanel/GuidePanel.tsx`, `src/components/GuidePanel/GuidePanel.module.css`

- [ ] **Step 1: Create StepRenderer component**

Create `src/components/StepRenderer.tsx`:

```tsx
import type { StepToken } from "../types";
import styles from "./StepRenderer.module.css";

interface StepRendererProps {
  tokens: StepToken[];
  isHint: boolean;
}

const ICON_MAP: Record<string, string> = {
  waypoint: "◆",
  checkpoint: "☠",
  quest_2: "❗",
  portal: "🌀",
  skill: "💎",
  support: "🔷",
  "in-out2": "↩",
  lab: "⚗",
};

export function StepRenderer({ tokens, isHint }: StepRendererProps) {
  return (
    <div className={`${styles.step} ${isHint ? styles.hint : ""}`}>
      {renderTokens(tokens)}
    </div>
  );
}

function renderTokens(tokens: StepToken[]) {
  let currentColor: string | undefined;
  return tokens.map((token, i) => {
    if (token.type === "color_start") {
      currentColor = token.color;
      return null;
    }
    const color = currentColor;
    if (token.type === "text" && color) {
      currentColor = undefined; // color applies to next text token only
      return (
        <span key={i} style={{ color: color.startsWith("#") ? color : `#${color}` }}>
          {token.value}
        </span>
      );
    }
    return renderToken(token, i);
  });
}

function renderToken(token: StepToken, key: number) {
  switch (token.type) {
    case "text":
      return <span key={key}>{token.value}</span>;

    case "icon":
      return (
        <span key={key} className={styles.icon} title={token.value}>
          {ICON_MAP[token.value] ?? `[${token.value}]`}
        </span>
      );

    case "color_start":
      return null;

    case "zone":
      return (
        <span key={key} className={styles.zone}>
          {token.value}
        </span>
      );

    case "arena":
      return (
        <span key={key} className={styles.arena}>
          {token.value}
        </span>
      );

    case "quest":
      return (
        <span key={key} className={styles.quest}>
          🏆 {token.value}
        </span>
      );

    case "separator":
      return (
        <span key={key} className={styles.separator}>
          {" "}
          →{" "}
        </span>
      );

    case "kill":
      return (
        <span key={key} className={styles.kill}>
          kill
        </span>
      );

    default:
      return <span key={key}>{token.value}</span>;
  }
}
```

Create `src/components/StepRenderer.module.css`:

```css
.step {
  padding: 4px 0;
  line-height: 1.6;
  font-size: var(--font-size, 14px);
}

.hint {
  font-size: calc(var(--font-size, 14px) - 2px);
  opacity: 0.7;
  padding-left: 16px;
}

.icon {
  margin: 0 2px;
  font-size: 1.1em;
}

.zone {
  color: #cc99ff;
  font-weight: 600;
  background: rgba(204, 153, 255, 0.1);
  padding: 1px 6px;
  border-radius: 3px;
}

.arena {
  color: #ff9933;
  font-weight: 600;
}

.quest {
  color: #ffcc00;
}

.separator {
  color: #666;
  margin: 0 4px;
}

.kill {
  color: #ff4444;
  font-weight: 700;
}
```

- [ ] **Step 2: Create GuidePanel component**

Create `src/components/GuidePanel/GuidePanel.tsx`:

```tsx
import { useGuideStore } from "../../store/guideStore";
import { StepRenderer } from "../StepRenderer";
import styles from "./GuidePanel.module.css";

export function GuidePanel() {
  const { pages, currentPageIndex, nextPage, prevPage, goToAct } =
    useGuideStore();
  const currentPage = pages[currentPageIndex];

  if (!currentPage) {
    return <div className={styles.panel}>No guide data loaded.</div>;
  }

  const progress = ((currentPageIndex + 1) / pages.length) * 100;
  const actLabel = currentPage.act <= 4 ? `Act ${currentPage.act}` : `Postgame ${currentPage.act - 4}`;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.actZone}>
          <span className={styles.actLabel}>{actLabel}</span>
          <span className={styles.zoneName}>
            {currentPage.targetZoneName || "Unknown Zone"}
          </span>
        </div>
        <div className={styles.pageInfo}>
          Page {currentPageIndex + 1} / {pages.length}
        </div>
      </div>

      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className={styles.steps}>
        {currentPage.steps.map((step, i) => (
          <StepRenderer key={i} tokens={step.tokens} isHint={step.isHint} />
        ))}
      </div>

      <div className={styles.nav}>
        <button
          className={styles.navBtn}
          onClick={prevPage}
          disabled={currentPageIndex === 0}
        >
          ◀ Prev
        </button>

        <select
          className={styles.actSelect}
          value={currentPage.act}
          onChange={(e) => goToAct(Number(e.target.value))}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((act) => (
            <option key={act} value={act}>
              {act <= 4 ? `Act ${act}` : `Postgame ${act - 4}`}
            </option>
          ))}
        </select>

        <button
          className={styles.navBtn}
          onClick={nextPage}
          disabled={currentPageIndex === pages.length - 1}
        >
          Next ▶
        </button>
      </div>
    </div>
  );
}
```

Create `src/components/GuidePanel/GuidePanel.module.css`:

```css
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.actZone {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.actLabel {
  font-size: 1.2em;
  font-weight: 700;
  color: var(--accent-gold);
}

.zoneName {
  color: #cc99ff;
  font-size: 1.1em;
  text-transform: capitalize;
}

.pageInfo {
  font-size: 0.85em;
  opacity: 0.6;
}

.progressBar {
  height: 3px;
  background: var(--bg-secondary);
}

.progressFill {
  height: 100%;
  background: var(--accent-gold);
  transition: width 0.3s ease;
}

.steps {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
}

.navBtn {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.navBtn:hover:not(:disabled) {
  background: var(--bg-hover);
}

.navBtn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.actSelect {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.9em;
}
```

- [ ] **Step 3: Verify components compile**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "feat: StepRenderer and GuidePanel components

StepRenderer converts tokenized markup into styled React elements
with icons, color coding, and zone badges. GuidePanel provides the
main guide view with act/zone header, progress bar, step list, and
prev/next navigation."
```

---

## Task 7: Companion Layout, Dark Theme, and App Wiring

**Files:**
- Create: `src/layouts/CompanionLayout.tsx`, `src/layouts/CompanionLayout.module.css`, `src/theme.css`
- Modify: `src/App.tsx`, `src/main.tsx`

- [ ] **Step 1: Create dark theme CSS**

Create `src/theme.css`:

```css
:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-hover: #1f2b47;
  --bg-panel: #0f1629;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --accent-gold: #c9a84c;
  --accent-teal: #4ecdc4;
  --border-color: #2a2a4a;
  --color-red: #ff4444;
  --color-green: #44cc44;
  --color-yellow: #cccc44;
  --color-purple: #cc99ff;
  --font-size: 14px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: "Segoe UI", -apple-system, sans-serif;
  font-size: var(--font-size);
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
  user-select: none;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #3a3a6a;
}
```

- [ ] **Step 2: Create CompanionLayout**

Create `src/layouts/CompanionLayout.tsx`:

```tsx
import type { ReactNode } from "react";
import styles from "./CompanionLayout.module.css";

interface CompanionLayoutProps {
  topBar: ReactNode;
  center: ReactNode;
  leftSidebar?: ReactNode;
  rightSidebar?: ReactNode;
  bottomPanel?: ReactNode;
}

export function CompanionLayout({
  topBar,
  center,
  leftSidebar,
  rightSidebar,
  bottomPanel,
}: CompanionLayoutProps) {
  return (
    <div className={styles.layout}>
      <div className={styles.topBar}>{topBar}</div>
      <div className={styles.main}>
        {leftSidebar && (
          <div className={styles.sidebar}>{leftSidebar}</div>
        )}
        <div className={styles.center}>{center}</div>
        {rightSidebar && (
          <div className={styles.sidebar}>{rightSidebar}</div>
        )}
      </div>
      {bottomPanel && (
        <div className={styles.bottomPanel}>{bottomPanel}</div>
      )}
    </div>
  );
}
```

Create `src/layouts/CompanionLayout.module.css`:

```css
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
}

.topBar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-color);
  min-height: 48px;
  gap: 16px;
}

.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 280px;
  min-width: 200px;
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
  background: var(--bg-panel);
}

.sidebar:last-of-type {
  border-right: none;
  border-left: 1px solid var(--border-color);
}

.center {
  flex: 1;
  overflow: hidden;
}

.bottomPanel {
  border-top: 1px solid var(--border-color);
  background: var(--bg-panel);
  padding: 8px 16px;
}
```

- [ ] **Step 3: Wire up App.tsx**

Replace `src/App.tsx`:

```tsx
import { CompanionLayout } from "./layouts/CompanionLayout";
import { GuidePanel } from "./components/GuidePanel/GuidePanel";

function TopBar() {
  return (
    <>
      <div style={{ color: "var(--text-secondary)", fontSize: "0.85em" }}>
        PoE2 Campaign Tracker
      </div>
      <div style={{ color: "var(--text-secondary)", fontSize: "0.85em" }}>
        {/* Timer and level indicator slots — implemented in later tasks */}
      </div>
    </>
  );
}

export default function App() {
  return (
    <CompanionLayout
      topBar={<TopBar />}
      center={<GuidePanel />}
    />
  );
}
```

- [ ] **Step 4: Update main.tsx to import theme**

Replace `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./theme.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Clean up scaffold files**

Remove any default scaffold CSS/assets that are no longer needed:

```bash
rm -f src/App.css src/index.css src/assets/react.svg 2>/dev/null || true
```

- [ ] **Step 6: Verify the app builds and launches**

```bash
npm run tauri dev
```

Expected: Tauri window opens showing the guide panel with PoE2 campaign steps rendered with the dark theme. You can click Prev/Next to navigate. The act/zone header and progress bar work. Kill the dev server after verifying.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: companion layout with dark theme and guide panel

Wires up CompanionLayout shell with top bar, center guide panel,
and sidebar/bottom panel slots. Dark theme uses PoE2-inspired
color palette with gold accents and deep dark backgrounds."
```

---

## Task 8: Tauri Backend — File I/O and Persistence

**Files:**
- Create: `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/file_io.rs`
- Modify: `src-tauri/src/lib.rs`
- Create: `src/store/settingsStore.ts`, `src/hooks/usePersistence.ts`

- [ ] **Step 1: Create Rust commands module**

Create `src-tauri/src/commands/mod.rs`:

```rust
pub mod file_io;
```

- [ ] **Step 2: Implement file I/O commands**

Create `src-tauri/src/commands/file_io.rs`:

```rust
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

fn get_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to create data dir: {}", e))?;
    }

    Ok(data_dir)
}

#[tauri::command]
pub async fn read_user_data(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    let data_dir = get_data_dir(&app)?;
    let path = data_dir.join(&filename);

    if !path.exists() {
        return Ok(String::new());
    }

    fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", filename, e))
}

#[tauri::command]
pub async fn write_user_data(
    app: tauri::AppHandle,
    filename: String,
    data: String,
) -> Result<(), String> {
    let data_dir = get_data_dir(&app)?;
    let path = data_dir.join(&filename);

    fs::write(&path, &data).map_err(|e| format!("Failed to write {}: {}", filename, e))
}
```

- [ ] **Step 3: Register commands in lib.rs**

Replace `src-tauri/src/lib.rs`:

```rust
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::file_io::read_user_data,
            commands::file_io::write_user_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Create settings store with persistence**

Create `src/store/settingsStore.ts`:

```typescript
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "../types";
import { DEFAULT_SETTINGS } from "../types";

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (partial: Partial<Settings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    try {
      const raw = await invoke<string>("read_user_data", {
        filename: "settings.json",
      });
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Settings>;
        set({ settings: { ...DEFAULT_SETTINGS, ...saved }, loaded: true });
      } else {
        set({ loaded: true });
      }
    } catch {
      set({ loaded: true });
    }
  },

  update: async (partial: Partial<Settings>) => {
    const newSettings = { ...get().settings, ...partial };
    set({ settings: newSettings });
    try {
      await invoke("write_user_data", {
        filename: "settings.json",
        data: JSON.stringify(newSettings, null, 2),
      });
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  },
}));
```

- [ ] **Step 5: Create persistence hook**

Create `src/hooks/usePersistence.ts`:

```typescript
import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useGuideStore } from "../store/guideStore";
import type { Progress } from "../types";
import { DEFAULT_PROGRESS } from "../types";

export function usePersistence() {
  const currentPageIndex = useGuideStore((s) => s.currentPageIndex);
  const goToPage = useGuideStore((s) => s.goToPage);
  const pages = useGuideStore((s) => s.pages);
  const loadedRef = useRef(false);

  // Load progress on mount
  useEffect(() => {
    async function loadProgress() {
      try {
        const raw = await invoke<string>("read_user_data", {
          filename: "progress.json",
        });
        if (raw) {
          const progress = JSON.parse(raw) as Progress;
          if (
            progress.currentPageIndex >= 0 &&
            progress.currentPageIndex < pages.length
          ) {
            // Use the store's internal setter directly
            useGuideStore.setState({
              currentPageIndex: progress.currentPageIndex,
            });
          }
        }
      } catch {
        // First launch, no progress file
      }
      loadedRef.current = true;
    }
    loadProgress();
  }, [pages.length]);

  // Save progress on page change (debounced)
  useEffect(() => {
    if (!loadedRef.current) return;

    const timer = setTimeout(async () => {
      try {
        const progress: Partial<Progress> = {
          currentPageIndex,
        };
        // Read existing progress to preserve timer data
        const raw = await invoke<string>("read_user_data", {
          filename: "progress.json",
        });
        const existing = raw
          ? (JSON.parse(raw) as Progress)
          : DEFAULT_PROGRESS;
        const merged = { ...existing, ...progress };
        await invoke("write_user_data", {
          filename: "progress.json",
          data: JSON.stringify(merged, null, 2),
        });
      } catch (e) {
        console.error("Failed to save progress:", e);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [currentPageIndex]);
}
```

- [ ] **Step 6: Wire persistence into App.tsx**

Update `src/App.tsx` to use the persistence hook and load settings:

```tsx
import { useEffect } from "react";
import { CompanionLayout } from "./layouts/CompanionLayout";
import { GuidePanel } from "./components/GuidePanel/GuidePanel";
import { useSettingsStore } from "./store/settingsStore";
import { usePersistence } from "./hooks/usePersistence";

function TopBar() {
  return (
    <>
      <div style={{ color: "var(--text-secondary)", fontSize: "0.85em" }}>
        PoE2 Campaign Tracker
      </div>
      <div style={{ color: "var(--text-secondary)", fontSize: "0.85em" }}>
        {/* Timer and level indicator — Tasks 10, 11 */}
      </div>
    </>
  );
}

export default function App() {
  const loadSettings = useSettingsStore((s) => s.load);
  usePersistence();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <CompanionLayout topBar={<TopBar />} center={<GuidePanel />} />
  );
}
```

- [ ] **Step 7: Verify it builds**

```bash
npm run tauri dev
```

Expected: App launches. Navigate a few pages, close the app, reopen — it should resume on the same page.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/ src/store/settingsStore.ts src/hooks/usePersistence.ts src/App.tsx
git commit -m "feat: Tauri file I/O backend and progress persistence

Rust commands for reading/writing JSON files in app data directory.
Settings store loads/saves user preferences. Persistence hook saves
guide page position and restores it on app restart."
```

---

## Task 9: Tauri Backend — Log Watcher and Install Detection

**Files:**
- Create: `src-tauri/src/commands/log_watcher.rs`, `src-tauri/src/commands/detect.rs`
- Modify: `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`

- [ ] **Step 1: Implement log line parser with tests**

Create `src-tauri/src/commands/log_watcher.rs`:

```rust
use notify::{Event, EventKind, RecursiveMode, Watcher};
use regex::Regex;
use serde::Serialize;
use std::fs::File;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::sync::mpsc;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize)]
pub struct ZoneChangeEvent {
    #[serde(rename = "areaId")]
    pub area_id: String,
    pub level: u32,
    pub timestamp: String,
}

pub fn parse_zone_change(line: &str) -> Option<ZoneChangeEvent> {
    // Pattern: ... Generating level N area "AreaId" with seed N
    let re = Regex::new(r#"Generating level (\d+) area "([^"]+)" with seed"#).unwrap();
    if let Some(caps) = re.captures(line) {
        let level = caps.get(1)?.as_str().parse::<u32>().ok()?;
        let area_id = caps.get(2)?.as_str().to_lowercase();
        let timestamp = chrono::Utc::now().to_rfc3339();
        return Some(ZoneChangeEvent {
            area_id,
            level,
            timestamp,
        });
    }
    None
}

#[tauri::command]
pub async fn start_log_watcher(app: tauri::AppHandle, log_path: String) -> Result<(), String> {
    let path = std::path::PathBuf::from(&log_path);
    if !path.exists() {
        return Err(format!("Log file not found: {}", log_path));
    }

    tauri::async_runtime::spawn(async move {
        if let Err(e) = watch_log_file(app, &path) {
            eprintln!("Log watcher error: {}", e);
        }
    });

    Ok(())
}

fn watch_log_file(app: tauri::AppHandle, path: &std::path::Path) -> Result<(), String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    // Seek to end — only watch new lines
    let mut pos = file.metadata().map_err(|e| e.to_string())?.len();
    file.seek(SeekFrom::Start(pos)).map_err(|e| e.to_string())?;

    let (tx, rx) = mpsc::channel();
    let mut watcher = notify::recommended_watcher(tx).map_err(|e| e.to_string())?;
    watcher
        .watch(path, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    for event in rx {
        match event {
            Ok(Event {
                kind: EventKind::Modify(_),
                ..
            }) => {
                let new_len = match file.metadata() {
                    Ok(m) => m.len(),
                    Err(_) => continue,
                };
                if new_len > pos {
                    if file.seek(SeekFrom::Start(pos)).is_err() {
                        continue;
                    }
                    let reader = BufReader::new(&file);
                    for line in reader.lines().map_while(Result::ok) {
                        if let Some(zone_event) = parse_zone_change(&line) {
                            let _ = app.emit("zone-changed", &zone_event);
                        }
                    }
                    pos = new_len;
                }
            }
            _ => {}
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_zone_change_valid_line() {
        let line = r#"2025-01-15 12:34:56 12345 [INFO Client 1234] [ENGINE] Generating level 5 area "G1_2" with seed 98765"#;
        let result = parse_zone_change(line);
        assert!(result.is_some());
        let event = result.unwrap();
        assert_eq!(event.area_id, "g1_2");
        assert_eq!(event.level, 5);
    }

    #[test]
    fn test_parse_zone_change_town() {
        let line = r#"Generating level 1 area "G1_town" with seed 12345"#;
        let result = parse_zone_change(line);
        assert!(result.is_some());
        let event = result.unwrap();
        assert_eq!(event.area_id, "g1_town");
        assert_eq!(event.level, 1);
    }

    #[test]
    fn test_parse_zone_change_no_match() {
        let line = "2025-01-15 12:34:56 [INFO Client] Connected to server";
        let result = parse_zone_change(line);
        assert!(result.is_none());
    }

    #[test]
    fn test_parse_zone_change_act2() {
        let line = r#"Generating level 20 area "G2_5" with seed 55555"#;
        let result = parse_zone_change(line);
        assert!(result.is_some());
        let event = result.unwrap();
        assert_eq!(event.area_id, "g2_5");
        assert_eq!(event.level, 20);
    }
}
```

- [ ] **Step 2: Add chrono dependency**

In `src-tauri/Cargo.toml`, add:

```toml
chrono = "0.4"
```

- [ ] **Step 3: Implement install detection**

Create `src-tauri/src/commands/detect.rs`:

```rust
use std::path::PathBuf;

const COMMON_PATHS: &[&str] = &[
    r"C:\Program Files (x86)\Steam\steamapps\common\Path of Exile 2\logs\Client.txt",
    r"C:\Program Files\Steam\steamapps\common\Path of Exile 2\logs\Client.txt",
    r"D:\Steam\steamapps\common\Path of Exile 2\logs\Client.txt",
    r"D:\SteamLibrary\steamapps\common\Path of Exile 2\logs\Client.txt",
    r"E:\SteamLibrary\steamapps\common\Path of Exile 2\logs\Client.txt",
    r"C:\Program Files\Grinding Gear Games\Path of Exile 2\logs\Client.txt",
];

#[tauri::command]
pub fn detect_client_txt() -> Option<String> {
    for path_str in COMMON_PATHS {
        let path = PathBuf::from(path_str);
        if path.exists() {
            return Some(path_str.to_string());
        }
    }
    None
}

#[tauri::command]
pub async fn browse_for_file(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri::dialog::FileDialogBuilder;

    let (tx, rx) = std::sync::mpsc::channel();

    FileDialogBuilder::new(&app)
        .add_filter("Log files", &["txt"])
        .set_title("Select PoE2 Client.txt")
        .pick_file(move |path| {
            let _ = tx.send(path.map(|p| p.to_string_lossy().to_string()));
        });

    rx.recv()
        .map_err(|e| format!("Dialog cancelled: {}", e))
}
```

Note: The `browse_for_file` dialog API may differ based on the exact Tauri v2 plugins installed. If `tauri::dialog` is not available, install `tauri-plugin-dialog`:

```bash
cd src-tauri
cargo add tauri-plugin-dialog
```

And register it in `lib.rs` with `.plugin(tauri_plugin_dialog::init())`.

- [ ] **Step 4: Update module declarations and register commands**

Update `src-tauri/src/commands/mod.rs`:

```rust
pub mod detect;
pub mod file_io;
pub mod log_watcher;
```

Update `src-tauri/src/lib.rs`:

```rust
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::file_io::read_user_data,
            commands::file_io::write_user_data,
            commands::log_watcher::start_log_watcher,
            commands::detect::detect_client_txt,
            commands::detect::browse_for_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Run Rust tests**

```bash
cd src-tauri && cargo test && cd ..
```

Expected: All log parser tests PASS.

- [ ] **Step 6: Verify full build**

```bash
npm run tauri dev
```

Expected: App launches without errors. The log watcher and detection commands are registered but not yet called from the frontend.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/
git commit -m "feat: log watcher and install detection backend

Tails Client.txt for zone-change events using notify crate.
Parses log lines with regex to extract area IDs and zone levels.
Auto-detects common PoE2 install paths with dialog fallback."
```

---

## Task 10: Auto-Advance and Toast Notifications

**Files:**
- Create: `src/hooks/useLogWatcher.ts`, `src/hooks/useAutoAdvance.ts`, `src/components/Toast/Toast.tsx`, `src/components/Toast/Toast.module.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create useLogWatcher hook**

Create `src/hooks/useLogWatcher.ts`:

```typescript
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../store/settingsStore";
import type { ZoneChangeEvent } from "../types";

type ZoneChangeHandler = (event: ZoneChangeEvent) => void;

export function useLogWatcher(onZoneChange: ZoneChangeHandler) {
  const clientTxtPath = useSettingsStore((s) => s.settings.clientTxtPath);

  useEffect(() => {
    if (!clientTxtPath) return;

    // Start the log watcher backend
    invoke("start_log_watcher", { logPath: clientTxtPath }).catch((e) =>
      console.error("Failed to start log watcher:", e)
    );

    // Listen for zone-change events
    const unlisten = listen<ZoneChangeEvent>("zone-changed", (event) => {
      onZoneChange(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [clientTxtPath, onZoneChange]);
}
```

- [ ] **Step 2: Create useAutoAdvance hook**

Create `src/hooks/useAutoAdvance.ts`:

```typescript
import { useCallback, useState } from "react";
import { useGuideStore } from "../store/guideStore";
import { useTimerStore } from "../store/timerStore";
import { useLogWatcher } from "./useLogWatcher";
import type { ZoneChangeEvent } from "../types";

interface ToastMessage {
  id: number;
  text: string;
}

let toastId = 0;

export function useAutoAdvance() {
  const advanceToZone = useGuideStore((s) => s.advanceToZone);
  const pages = useGuideStore((s) => s.pages);
  const currentPageIndex = useGuideStore((s) => s.currentPageIndex);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((text: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleZoneChange = useCallback(
    (event: ZoneChangeEvent) => {
      // Auto-start timer on first zone change
      const timerState = useTimerStore.getState().state;
      if (timerState === "stopped") {
        useTimerStore.getState().start();
      }

      const prevIndex = useGuideStore.getState().currentPageIndex;
      advanceToZone(event.areaId);
      const newIndex = useGuideStore.getState().currentPageIndex;

      if (newIndex > prevIndex) {
        const newPage = pages[newIndex];
        if (newPage) {
          addToast(`Advanced to: ${newPage.targetZoneName}`);
        }
      }
    },
    [advanceToZone, pages, addToast]
  );

  useLogWatcher(handleZoneChange);

  return { toasts, dismissToast };
}
```

- [ ] **Step 3: Create Toast component**

Create `src/components/Toast/Toast.tsx`:

```tsx
import styles from "./Toast.module.css";

interface ToastProps {
  messages: { id: number; text: string }[];
  onDismiss: (id: number) => void;
}

export function ToastContainer({ messages, onDismiss }: ToastProps) {
  if (messages.length === 0) return null;

  return (
    <div className={styles.container}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={styles.toast}
          onClick={() => onDismiss(msg.id)}
        >
          {msg.text}
        </div>
      ))}
    </div>
  );
}
```

Create `src/components/Toast/Toast.module.css`:

```css
.container {
  position: fixed;
  top: 56px;
  right: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toast {
  background: var(--bg-secondary);
  color: var(--accent-gold);
  border: 1px solid var(--accent-gold);
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 0.85em;
  cursor: pointer;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

- [ ] **Step 4: Wire auto-advance into App.tsx**

Update `src/App.tsx`:

```tsx
import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CompanionLayout } from "./layouts/CompanionLayout";
import { GuidePanel } from "./components/GuidePanel/GuidePanel";
import { ToastContainer } from "./components/Toast/Toast";
import { useSettingsStore } from "./store/settingsStore";
import { usePersistence } from "./hooks/usePersistence";
import { useAutoAdvance } from "./hooks/useAutoAdvance";

function TopBar() {
  const clientTxtPath = useSettingsStore((s) => s.settings.clientTxtPath);
  const updateSettings = useSettingsStore((s) => s.update);

  // Auto-detect on first load if no path set
  useEffect(() => {
    if (clientTxtPath) return;
    invoke<string | null>("detect_client_txt").then((path) => {
      if (path) {
        updateSettings({ clientTxtPath: path });
      }
    });
  }, [clientTxtPath, updateSettings]);

  return (
    <>
      <div style={{ color: "var(--text-secondary)", fontSize: "0.85em" }}>
        PoE2 Campaign Tracker
      </div>
      <div
        style={{
          color: clientTxtPath ? "var(--color-green)" : "var(--color-yellow)",
          fontSize: "0.75em",
        }}
      >
        {clientTxtPath ? "● Connected" : "○ No Client.txt"}
      </div>
    </>
  );
}

export default function App() {
  const loadSettings = useSettingsStore((s) => s.load);
  const { toasts, dismissToast } = useAutoAdvance();
  usePersistence();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <>
      <CompanionLayout topBar={<TopBar />} center={<GuidePanel />} />
      <ToastContainer messages={toasts} onDismiss={dismissToast} />
    </>
  );
}
```

- [ ] **Step 5: Verify it builds**

```bash
npm run tauri dev
```

Expected: App launches. Shows "Connected" or "No Client.txt" in top bar depending on whether PoE2 is installed. If connected and PoE2 is running, zone changes should auto-advance the guide and show toast notifications.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/ src/components/Toast/ src/App.tsx
git commit -m "feat: auto-advance from Client.txt zone detection

useLogWatcher subscribes to Tauri zone-change events. useAutoAdvance
advances the guide when target zones are detected, with skip-ahead
support. Toast notifications confirm zone transitions."
```

---

## Task 11: Campaign Timer

**Files:**
- Create: `src/store/timerStore.ts`, `src/hooks/useTimer.ts`, `src/components/CampaignTimer/CampaignTimer.tsx`, `src/components/CampaignTimer/CampaignTimer.module.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create timer store**

Create `src/store/timerStore.ts`:

```typescript
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { Progress } from "../types";
import { DEFAULT_PROGRESS } from "../types";

interface TimerState {
  state: "stopped" | "running" | "paused";
  startedAt: number | null; // epoch ms
  pausedElapsed: number; // ms accumulated before current run
  currentAct: number;
  actSplits: Record<
    number,
    { startedAt: number; completedAt: number | null; elapsed: number | null }
  >;

  // Actions
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  splitAct: (newAct: number) => void;
  load: () => Promise<void>;
  save: () => Promise<void>;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  state: "stopped",
  startedAt: null,
  pausedElapsed: 0,
  currentAct: 1,
  actSplits: {},

  start: () => {
    const now = Date.now();
    set({
      state: "running",
      startedAt: now,
      pausedElapsed: 0,
      currentAct: 1,
      actSplits: {
        1: { startedAt: now, completedAt: null, elapsed: null },
      },
    });
    get().save();
  },

  pause: () => {
    const { startedAt, pausedElapsed } = get();
    if (startedAt) {
      const elapsed = pausedElapsed + (Date.now() - startedAt);
      set({ state: "paused", pausedElapsed: elapsed, startedAt: null });
      get().save();
    }
  },

  resume: () => {
    set({ state: "running", startedAt: Date.now() });
    get().save();
  },

  reset: () => {
    set({
      state: "stopped",
      startedAt: null,
      pausedElapsed: 0,
      currentAct: 1,
      actSplits: {},
    });
    get().save();
  },

  splitAct: (newAct: number) => {
    const { currentAct, actSplits } = get();
    if (newAct <= currentAct) return; // don't split backward

    const now = Date.now();
    const currentSplit = actSplits[currentAct];
    const updatedSplits = {
      ...actSplits,
      [currentAct]: {
        ...currentSplit,
        completedAt: now,
        elapsed: currentSplit
          ? now - currentSplit.startedAt
          : null,
      },
      [newAct]: { startedAt: now, completedAt: null, elapsed: null },
    };

    set({ currentAct: newAct, actSplits: updatedSplits });
    get().save();
  },

  load: async () => {
    try {
      const raw = await invoke<string>("read_user_data", {
        filename: "progress.json",
      });
      if (!raw) return;
      const progress = JSON.parse(raw) as Progress;
      if (progress.timerState && progress.timerState !== "stopped") {
        set({
          state: progress.timerState,
          startedAt: progress.timerStartedAt
            ? new Date(progress.timerStartedAt).getTime()
            : null,
          pausedElapsed: progress.timerPausedElapsed || 0,
          actSplits: Object.fromEntries(
            Object.entries(progress.actSplits || {}).map(([k, v]) => [
              Number(k),
              {
                startedAt: new Date(v.startedAt).getTime(),
                completedAt: v.completedAt
                  ? new Date(v.completedAt).getTime()
                  : null,
                elapsed: v.elapsed,
              },
            ])
          ),
        });
      }
    } catch {
      // No saved timer state
    }
  },

  save: async () => {
    const { state, startedAt, pausedElapsed, actSplits } = get();
    try {
      const raw = await invoke<string>("read_user_data", {
        filename: "progress.json",
      });
      const existing = raw ? JSON.parse(raw) : {};
      const merged = {
        ...existing,
        timerState: state,
        timerStartedAt: startedAt
          ? new Date(startedAt).toISOString()
          : null,
        timerPausedElapsed: pausedElapsed,
        actSplits: Object.fromEntries(
          Object.entries(actSplits).map(([k, v]) => [
            k,
            {
              startedAt: new Date(v.startedAt).toISOString(),
              completedAt: v.completedAt
                ? new Date(v.completedAt).toISOString()
                : null,
              elapsed: v.elapsed,
            },
          ])
        ),
      };
      await invoke("write_user_data", {
        filename: "progress.json",
        data: JSON.stringify(merged, null, 2),
      });
    } catch (e) {
      console.error("Failed to save timer:", e);
    }
  },
}));
```

- [ ] **Step 2: Create timer tick hook**

Create `src/hooks/useTimer.ts`:

```typescript
import { useState, useEffect } from "react";
import { useTimerStore } from "../store/timerStore";

export function useTimerTick(): number {
  const timerState = useTimerStore((s) => s.state);
  const startedAt = useTimerStore((s) => s.startedAt);
  const pausedElapsed = useTimerStore((s) => s.pausedElapsed);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (timerState === "running" && startedAt) {
      const interval = setInterval(() => {
        setElapsed(pausedElapsed + (Date.now() - startedAt));
      }, 100);
      return () => clearInterval(interval);
    } else if (timerState === "paused") {
      setElapsed(pausedElapsed);
    } else {
      setElapsed(0);
    }
  }, [timerState, startedAt, pausedElapsed]);

  return elapsed;
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
```

- [ ] **Step 3: Create CampaignTimer component**

Create `src/components/CampaignTimer/CampaignTimer.tsx`:

```tsx
import { useTimerStore } from "../../store/timerStore";
import { useTimerTick, formatTime } from "../../hooks/useTimer";
import styles from "./CampaignTimer.module.css";

export function CampaignTimer() {
  const timerState = useTimerStore((s) => s.state);
  const currentAct = useTimerStore((s) => s.currentAct);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const reset = useTimerStore((s) => s.reset);
  const elapsed = useTimerTick();

  // Calculate current act elapsed
  const actSplits = useTimerStore((s) => s.actSplits);
  const currentActSplit = actSplits[currentAct];
  const actElapsed =
    currentActSplit && timerState === "running"
      ? Date.now() - currentActSplit.startedAt
      : 0;

  return (
    <div className={styles.timer}>
      <span className={styles.time}>{formatTime(elapsed)}</span>
      <span className={styles.divider}>|</span>
      <span className={styles.act}>A{currentAct}</span>
      <span className={styles.divider}>|</span>
      <span className={styles.actTime}>{formatTime(actElapsed)}</span>

      <div className={styles.controls}>
        {timerState === "stopped" && (
          <button className={styles.btn} onClick={start} title="Start">
            ▶
          </button>
        )}
        {timerState === "running" && (
          <button className={styles.btn} onClick={pause} title="Pause">
            ⏸
          </button>
        )}
        {timerState === "paused" && (
          <button className={styles.btn} onClick={resume} title="Resume">
            ▶
          </button>
        )}
        {timerState !== "stopped" && (
          <button
            className={styles.btn}
            onClick={() => {
              if (confirm("Reset timer and start a new run?")) reset();
            }}
            title="Reset"
          >
            ↺
          </button>
        )}
      </div>
    </div>
  );
}
```

Create `src/components/CampaignTimer/CampaignTimer.module.css`:

```css
.timer {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: "Consolas", "Courier New", monospace;
}

.time {
  color: var(--text-primary);
  font-size: 1.1em;
  font-weight: 600;
}

.divider {
  color: var(--text-secondary);
  opacity: 0.5;
}

.act {
  color: var(--accent-gold);
  font-weight: 700;
}

.actTime {
  color: var(--text-secondary);
  font-size: 0.9em;
}

.controls {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}

.btn {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8em;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn:hover {
  background: var(--bg-hover);
}
```

- [ ] **Step 4: Wire timer into App.tsx and connect to auto-advance for act splits**

Update `src/App.tsx` — add CampaignTimer to TopBar and auto-start timer on first zone change:

```tsx
import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CompanionLayout } from "./layouts/CompanionLayout";
import { GuidePanel } from "./components/GuidePanel/GuidePanel";
import { CampaignTimer } from "./components/CampaignTimer/CampaignTimer";
import { ToastContainer } from "./components/Toast/Toast";
import { useSettingsStore } from "./store/settingsStore";
import { useTimerStore } from "./store/timerStore";
import { useGuideStore } from "./store/guideStore";
import { usePersistence } from "./hooks/usePersistence";
import { useAutoAdvance } from "./hooks/useAutoAdvance";
function TopBar() {
  const clientTxtPath = useSettingsStore((s) => s.settings.clientTxtPath);
  const updateSettings = useSettingsStore((s) => s.update);

  useEffect(() => {
    if (clientTxtPath) return;
    invoke<string | null>("detect_client_txt").then((path) => {
      if (path) {
        updateSettings({ clientTxtPath: path });
      }
    });
  }, [clientTxtPath, updateSettings]);

  return (
    <>
      <CampaignTimer />
      <div
        style={{
          color: clientTxtPath ? "var(--color-green)" : "var(--color-yellow)",
          fontSize: "0.75em",
        }}
      >
        {clientTxtPath ? "● Connected" : "○ No Client.txt"}
      </div>
    </>
  );
}

export default function App() {
  const loadSettings = useSettingsStore((s) => s.load);
  const loadTimer = useTimerStore((s) => s.load);
  const timerState = useTimerStore((s) => s.state);
  const startTimer = useTimerStore((s) => s.start);
  const splitAct = useTimerStore((s) => s.splitAct);
  const { toasts, dismissToast } = useAutoAdvance();
  usePersistence();

  // Watch for act changes to split timer
  const currentPage = useGuideStore((s) => s.pages[s.currentPageIndex]);
  useEffect(() => {
    if (currentPage && timerState === "running") {
      splitAct(currentPage.act);
    }
  }, [currentPage?.act, timerState, splitAct]);

  useEffect(() => {
    loadSettings();
    loadTimer();
  }, [loadSettings, loadTimer]);

  return (
    <>
      <CompanionLayout topBar={<TopBar />} center={<GuidePanel />} />
      <ToastContainer messages={toasts} onDismiss={dismissToast} />
    </>
  );
}
```

- [ ] **Step 5: Verify it builds and the timer works**

```bash
npm run tauri dev
```

Expected: Timer visible in top bar. Click play to start, pause/resume works. Timer shows `HH:MM:SS | A1 | HH:MM:SS` format. Persists across restarts.

- [ ] **Step 6: Commit**

```bash
git add src/store/timerStore.ts src/hooks/useTimer.ts src/components/CampaignTimer/ src/App.tsx
git commit -m "feat: campaign timer with act splits and persistence

Shows total elapsed and per-act time. Auto-splits when entering new
acts. Supports start/pause/resume/reset. Timer state persists across
app restarts via progress.json."
```

---

## Task 12: Level Indicator

**Files:**
- Create: `src/components/LevelIndicator/LevelIndicator.tsx`, `src/components/LevelIndicator/LevelIndicator.module.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create LevelIndicator component**

Create `src/components/LevelIndicator/LevelIndicator.tsx`:

```tsx
import { useState } from "react";
import { useGuideStore } from "../../store/guideStore";
import { areaById } from "../../data/areas";
import styles from "./LevelIndicator.module.css";

const ACT_TARGETS: Record<number, { min: number; max: number }> = {
  1: { min: 13, max: 14 },
  2: { min: 28, max: 29 },
  3: { min: 40, max: 41 },
  4: { min: 47, max: 48 },
};

function getLevelColor(
  charLevel: number,
  zoneMin: number,
  zoneMax: number
): string {
  const avg = (zoneMin + zoneMax) / 2;
  const diff = Math.abs(charLevel - avg);
  if (diff <= 1) return "var(--color-green)";
  if (diff <= 2) return "var(--color-yellow)";
  return "var(--color-red)";
}

export function LevelIndicator() {
  const [charLevel, setCharLevel] = useState(1);
  const currentPage = useGuideStore(
    (s) => s.pages[s.currentPageIndex]
  );

  const area = currentPage
    ? areaById.get(currentPage.targetAreaId)
    : null;
  const rec = area?.recommendation;
  const actTarget = currentPage
    ? ACT_TARGETS[currentPage.act]
    : null;

  const levelColor = rec
    ? getLevelColor(charLevel, rec.min, rec.max)
    : "var(--text-secondary)";

  return (
    <div className={styles.indicator}>
      <div className={styles.levelControl}>
        <button
          className={styles.stepBtn}
          onClick={() => setCharLevel((l) => Math.max(1, l - 1))}
        >
          −
        </button>
        <span className={styles.level} style={{ color: levelColor }}>
          Lv {charLevel}
        </span>
        <button
          className={styles.stepBtn}
          onClick={() => setCharLevel((l) => l + 1)}
        >
          +
        </button>
      </div>
      {rec && (
        <span className={styles.zoneRange}>
          Zone: {rec.min}-{rec.max}
        </span>
      )}
      {actTarget && (
        <span className={styles.target}>
          Target: {actTarget.min}-{actTarget.max}
        </span>
      )}
    </div>
  );
}
```

Create `src/components/LevelIndicator/LevelIndicator.module.css`:

```css
.indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.85em;
}

.levelControl {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stepBtn {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  width: 22px;
  height: 22px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.9em;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stepBtn:hover {
  background: var(--bg-hover);
}

.level {
  font-weight: 700;
  min-width: 45px;
  text-align: center;
}

.zoneRange {
  color: var(--text-secondary);
}

.target {
  color: var(--accent-gold);
  opacity: 0.8;
}
```

- [ ] **Step 2: Add LevelIndicator to top bar**

Update the `TopBar` function in `src/App.tsx` to include the LevelIndicator between the timer and connection status:

```tsx
import { LevelIndicator } from "./components/LevelIndicator/LevelIndicator";

// Inside TopBar, replace the existing return with:
function TopBar() {
  const clientTxtPath = useSettingsStore((s) => s.settings.clientTxtPath);
  const updateSettings = useSettingsStore((s) => s.update);

  useEffect(() => {
    if (clientTxtPath) return;
    invoke<string | null>("detect_client_txt").then((path) => {
      if (path) {
        updateSettings({ clientTxtPath: path });
      }
    });
  }, [clientTxtPath, updateSettings]);

  return (
    <>
      <CampaignTimer />
      <LevelIndicator />
      <div
        style={{
          color: clientTxtPath ? "var(--color-green)" : "var(--color-yellow)",
          fontSize: "0.75em",
        }}
      >
        {clientTxtPath ? "● Connected" : "○ No Client.txt"}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Verify it builds and renders**

```bash
npm run tauri dev
```

Expected: Level indicator visible in top bar with +/- buttons. Shows zone level range and act target. Color changes based on how close your level is to the zone recommendation.

- [ ] **Step 4: Commit**

```bash
git add src/components/LevelIndicator/ src/App.tsx
git commit -m "feat: level indicator with zone range and act targets

Shows character level (manually adjustable) with color-coded feedback
comparing to the current zone's recommended level range. Displays
per-act level targets for campaign pacing."
```

---

## Summary

**Phase 1 delivers:**
- Tauri v2 + React + TypeScript desktop app
- PoE2 campaign guide rendered from Exile-UI data with custom markup (icons, colors, zones, hints)
- Manual prev/next navigation with act jumping
- Auto-advance from Client.txt zone detection
- Campaign timer with per-act splits and persistence
- Level indicator with zone range and act targets
- Dark PoE2-inspired theme
- Progress persistence across app restarts
- Toast notifications for zone transitions

**Phase 2 will cover (separate plan):**
- Gem tracker (priority-ordered gem plan, quest rewards, cutting order)
- Gear advisor (slot priorities, mod lists, vendor reminders)
- Vendor regex panel (auto-show in towns, click-to-copy)
- Zone layout maps (Act 1 from Mobalytics, zoomable)
- Settings panel (full configuration UI)
- Overlay mode (transparent always-on-top, draggable widgets, game panel awareness)
- Inline notes on guide steps
- Import/export customizations
