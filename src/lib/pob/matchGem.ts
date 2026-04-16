import { gemById, allGems } from "../../data/gems";
import type {
  BuildGemEntry,
  SkillGroup,
} from "../../types/buildPlan";
import type { GemEntry } from "../../types/itemDatabase";
import type { ImportWarning, PoBGem, PoBSkill } from "./types";

export interface MatchSkillGroupResult {
  group: SkillGroup | null;
  warnings: ImportWarning[];
}

/**
 * Resolve a PoB gem against the DB. Try in order:
 *   1. gemId (full Metadata/... path — matches our DB id directly)
 *   2. skillId (less reliable: PoB2 adds a "Player" suffix on many actives)
 *   3. nameSpec (human-readable display name fallback)
 */
function findGem(g: PoBGem): GemEntry | undefined {
  if (g.gemId) {
    const byGemId = gemById.get(g.gemId);
    if (byGemId) return byGemId;
  }
  if (g.skillId) {
    const bySkillId = gemById.get(g.skillId);
    if (bySkillId) return bySkillId;
  }
  if (g.nameSpec) {
    const target = g.nameSpec.toLowerCase();
    return allGems.find((e) => e.name.toLowerCase() === target);
  }
  return undefined;
}

function gemLabel(g: PoBGem): string {
  return g.nameSpec || g.skillId || g.gemId || "(unknown gem)";
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

  const dbMain = findGem(mainGem);
  const mainLabel = gemLabel(mainGem);
  if (!dbMain) {
    warnings.push({ scope: "gem", message: `Gem not in database: ${mainLabel}` });
  }
  const skill = toEntry(dbMain, mainLabel, "skill", priority);

  const supports: (BuildGemEntry | null)[] = [];
  for (const g of otherGems) {
    const db = findGem(g);
    const label = gemLabel(g);
    if (!db) {
      warnings.push({ scope: "gem", message: `Gem not in database: ${label}` });
    }
    supports.push(toEntry(db, label, "support", 0));
  }

  const group: SkillGroup = {
    id: crypto.randomUUID(),
    skill,
    supports,
    priority,
  };
  return { group, warnings };
}
