import type { GemEntry, SkillLevelData } from "../../types/itemDatabase";
import type { StatMap } from "./types";
import { addContribution, emptyStatMap } from "./statMap";
import { statKindForId } from "./modStats";

export function getSkillTags(gem: GemEntry): string[] {
  const types = gem.skillDetail?.activeSkillTypes ?? [];
  return types.map((t) => t.toLowerCase());
}

export function getSkillLevel(gem: GemEntry, requestedLevel: number): number {
  const max = gem.skillDetail?.maxLevel ?? 1;
  return Math.max(1, Math.min(max, requestedLevel));
}

/**
 * Emit the gem's primary stat set, level-N stats into a StatMap.
 * Tags: the gem's activeSkillTypes (lowercased).
 * Source: the gem itself.
 */
export function collectSkillStats(gem: GemEntry, level: number): StatMap {
  const map = emptyStatMap();
  const detail = gem.skillDetail;
  if (!detail) return map;
  const lvl =
    detail.levels[String(level)] ??
    detail.levels[String(detail.maxLevel)] ??
    detail.levels[String(Math.max(...Object.keys(detail.levels).map(Number)))];
  if (!lvl) return map;
  const tags = getSkillTags(gem);
  for (const [statId, value] of Object.entries(lvl.stats ?? {})) {
    if (value === 0) continue;
    addContribution(map, statId, {
      value,
      kind: statKindForId(statId),
      tags,
      source: { type: "skill", id: gem.id, label: gem.name },
    });
  }
  return map;
}

/**
 * Emit a single stat-set level's stats into a StatMap.
 * Used by the pipeline (Task 11) to iterate each stat set per skill.
 *
 * Caller provides the set's name (for breakdown/source labelling) and
 * the skill's tags (so inc/more stats only fire when the skill's tags apply).
 */
export function statMapFromSkillLevel(
  setName: string,
  lvl: SkillLevelData,
  skillTags: string[],
): StatMap {
  const map = emptyStatMap();
  for (const [statId, value] of Object.entries(lvl.stats ?? {})) {
    if (value === 0) continue;
    addContribution(map, statId, {
      value,
      kind: statKindForId(statId),
      tags: skillTags,
      source: { type: "skill", id: setName, label: setName },
    });
  }
  return map;
}
