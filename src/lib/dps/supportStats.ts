import type { GemEntry } from "../../types/itemDatabase";
import type { StatMap } from "./types";
import { addContribution, emptyStatMap } from "./statMap";
import { statKindForId } from "./modStats";
import { getSkillTags } from "./skillStats";

export function supportApplies(support: GemEntry, skill: GemEntry): boolean {
  const skillTypes = new Set(skill.skillDetail?.activeSkillTypes ?? []);
  const allowed = support.allowedActiveSkillTypes ?? [];
  const excluded = support.excludedActiveSkillTypes ?? [];
  if (allowed.length > 0 && !allowed.some((t) => skillTypes.has(t))) return false;
  if (excluded.length > 0 && excluded.some((t) => skillTypes.has(t))) return false;
  return true;
}

export function collectSupportStats(
  supports: GemEntry[],
  skill: GemEntry,
  level = 1,
): StatMap {
  const map = emptyStatMap();
  const skillTags = getSkillTags(skill);
  for (const sup of supports) {
    if (!supportApplies(sup, skill)) continue;
    const detail = sup.skillDetail;
    if (!detail) continue;
    const lvl =
      detail.levels[String(level)] ?? detail.levels[String(detail.maxLevel)];
    if (!lvl) continue;
    for (const [statId, value] of Object.entries(lvl.stats ?? {})) {
      if (value === 0) continue;
      addContribution(map, statId, {
        value,
        kind: statKindForId(statId),
        tags: skillTags,
        source: { type: "support", id: sup.id, label: sup.name },
      });
    }
  }
  return map;
}
