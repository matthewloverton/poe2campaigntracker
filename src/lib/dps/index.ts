import type {
  BreakdownStage,
  DpsSnapshot,
  ModifierSource,
  SkillDps,
} from "./types";
import { DAMAGE_TYPES } from "./types";
import type { GemEntry } from "../../types/itemDatabase";
import { gemById } from "../../data/gems";
import {
  applyConversions,
  applyMultipliers,
  avg,
  calcBaseDamage,
  calcCrit,
  calcRate,
  projectileCount,
  sumPerHit,
  zeroDamageByType,
} from "./pipeline";
import { collectGearStats } from "./modStats";
import { resolveWeaponProperties } from "./localWeaponMods";
import { getSkillLevel, getSkillTags, statMapFromSkillLevel } from "./skillStats";
import { collectSupportStats } from "./supportStats";
import { mergeStatMaps } from "./statMap";
import { makeBreakdown } from "./breakdown";

export * from "./types";
export { snapshotFromPhase, swapWeapon } from "./snapshot";

/**
 * Compute DPS for every active skill in the snapshot.
 * Phase 1 scope: gear mods + support gems + skill innate stats across all stat sets.
 */
export function calcDps(snapshot: DpsSnapshot): SkillDps[] {
  const gearStats = collectGearStats(snapshot.gear, snapshot.rollMode);
  const results: SkillDps[] = [];

  for (const group of snapshot.skillGroups) {
    const result = calcSkillGroupDps(group, gearStats, snapshot);
    if (result) results.push(result);
  }
  return results;
}

function calcSkillGroupDps(
  group: DpsSnapshot["skillGroups"][number],
  gearStats: ReturnType<typeof collectGearStats>,
  snapshot: DpsSnapshot,
): SkillDps | null {
  const skillGemId = group.skill.gemId;
  if (!skillGemId) return null;
  const skillGem = gemById.get(skillGemId);
  if (!skillGem || skillGem.gemType !== "active") return null;
  const detail = skillGem.skillDetail;
  if (!detail) return null;

  const level = getSkillLevel(
    skillGem,
    group.skill.craftingLevel ?? detail.maxLevel,
  );

  const supportGems: GemEntry[] = [];
  for (const s of group.supports) {
    if (!s || !s.gemId) continue;
    const g = gemById.get(s.gemId);
    if (g) supportGems.push(g);
  }
  const supportStats = collectSupportStats(supportGems, skillGem, level);

  const skillTags = getSkillTags(skillGem);
  const types = detail.activeSkillTypes ?? [];
  const isAttack = types.includes("Attack");

  const weaponProps = resolveWeaponProperties(snapshot.gear.weapon, snapshot.rollMode);

  const statSets = detail.statSets ?? [];
  const damageByType = zeroDamageByType();
  const breakdownStages: BreakdownStage[] = [];
  const allSources: ModifierSource[] = [];

  for (const ss of statSets) {
    const lvlKey = String(level);
    const lvlData = ss.levels[lvlKey] ?? ss.levels[String(detail.maxLevel)];
    if (!lvlData) continue;

    // Skip stat sets that have no damage multiplier — these are non-damage sets
    // (e.g. the Ammunition set on Galvanic Shards which tracks bolt consumption).
    if (typeof lvlData.damageMultiplier !== "number") continue;

    const effectiveness = lvlData.damageMultiplier;

    const ssStats = statMapFromSkillLevel(ss.name, lvlData, skillTags);
    const setStatMap = mergeStatMaps(gearStats, ssStats, supportStats);

    const base = calcBaseDamage({
      isAttack,
      damageEffectiveness: effectiveness,
      weapon: weaponProps,
      skillFlat: zeroDamageByType(),
      statMap: setStatMap,
    });
    const converted = applyConversions(base, setStatMap);
    const multiplied = applyMultipliers(converted, setStatMap, skillTags);
    const projectiles = projectileCount(skillTags, setStatMap);

    for (const t of DAMAGE_TYPES) {
      damageByType[t].min += multiplied[t].min;
      damageByType[t].max += multiplied[t].max;
    }
    const ssPerHit = sumPerHit(multiplied);
    breakdownStages.push({
      kind: "base",
      label: `${ss.name}`,
      value: `${ssPerHit.min.toFixed(0)} – ${ssPerHit.max.toFixed(0)}`,
    });
    // Keep projectile count informational in the breakdown, but do not multiply per-hit.
    if (projectiles > 1) {
      breakdownStages.push({
        kind: "base",
        label: `${ss.name} projectile count`,
        value: projectiles,
      });
    }
    for (const list of setStatMap.values()) {
      for (const c of list) allSources.push(c.source);
    }
  }

  const perHit = sumPerHit(damageByType);

  const aggregateStatMap = mergeStatMaps(gearStats, supportStats);
  const rate = calcRate({
    isAttack,
    weaponAttackTime: weaponProps?.attackTime,
    skillAttackTime: undefined,
    castTime: detail.castTime,
    skillAttackSpeedMultiplier: detail.attackSpeedMultiplier ?? 0,
    statMap: aggregateStatMap,
    skillTags,
    ammoCapacity: detail.ammoCapacity,
    weaponReloadTime: weaponProps?.reloadTime,
  });

  // criticalStrikeChance in base_items.json is stored as hundredths of a percent
  // (e.g. 500 = 5.00%). Divide by 10000 to get a 0..1 fraction.
  const baseCritChance = (weaponProps?.criticalStrikeChance ?? 500) / 10000;
  const crit = calcCrit({
    baseCritChance,
    baseCritMulti: 2.0,
    statMap: aggregateStatMap,
    tags: skillTags,
  });

  const avgPerHit = avg(perHit);
  const dps = avgPerHit * rate * crit.expectedMulti;

  breakdownStages.push({
    kind: "rate",
    label: `Rate ${rate.toFixed(2)}/s`,
    value: rate,
  });
  breakdownStages.push({
    kind: "crit",
    label: `Crit ${(crit.chance * 100).toFixed(1)}% × ${crit.multi.toFixed(2)}`,
    value: crit.expectedMulti,
  });
  breakdownStages.push({ kind: "total", label: "Total DPS", value: Math.round(dps) });

  return {
    skillId: group.skill.id,
    skillName: skillGem.name,
    level,
    dps,
    perHit,
    rate,
    crit,
    damageByType,
    breakdown: makeBreakdown(breakdownStages, allSources),
  };
}
