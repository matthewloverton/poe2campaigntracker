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
