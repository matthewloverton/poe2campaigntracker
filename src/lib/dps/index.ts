import type { DpsSnapshot, SkillDps } from "./types";

export * from "./types";
export { snapshotFromPhase, swapWeapon } from "./snapshot";

/**
 * Compute DPS for every active skill in the snapshot.
 * Phase 1 scope: gear mods + support gems + skill innate stats.
 *
 * Real implementation lands in Task 11; this stub lets dependent
 * code typecheck before the pipeline is wired.
 */
export function calcDps(snapshot: DpsSnapshot): SkillDps[] {
  void snapshot;
  return [];
}
