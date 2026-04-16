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
