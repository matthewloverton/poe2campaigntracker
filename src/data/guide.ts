import { tokenize } from "../lib/tokenizer";
import type { GuidePage, GuideStep, GuideCondition, StoredGuide } from "../types";
import rawGuideData from "./raw/guide.json";
import rawCustomGuide from "./raw/guide-custom.json";

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
  const areaIdPattern = /areaid(\w+).*?;;\s*(.+?)$/;
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

/** Filter out Exile-UI meta-instructions that don't apply to our app */
function isMetaInstruction(raw: string): boolean {
  return raw.includes("info: optional rewards") ||
    raw.includes("enable (quest:optionals)") ||
    raw.includes("examples: currency, gems, gear");
}

function transformSteps(rawSteps: string[]): GuideStep[] {
  return rawSteps
    .filter((raw) => !isMetaInstruction(raw))
    .map((raw) => ({
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

export const guidePages: GuidePage[] = transformGuideData(
  rawGuideData as RawGuide
);

export const customGuidePages: GuidePage[] = transformGuideData(
  rawCustomGuide as RawGuide
);

export function getGuidePages(guide: "default" | "custom"): GuidePage[] {
  return guide === "custom" ? customGuidePages : guidePages;
}

export function storedGuideToPages(guide: StoredGuide): GuidePage[] {
  // Flatten StoredAct[] into the RawGuide shape the transformer expects
  const raw: RawGuide = guide.acts.map((a) =>
    a.entries.map<RawEntry>((e) =>
      e.type === "page"
        ? e.lines
        : { condition: e.condition, lines: e.lines },
    ),
  );
  return transformGuideData(raw);
}
