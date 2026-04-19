import type { BuildPhase, BuildGearEntry } from "../../types/buildPlan";
import type { DpsSnapshot, RollMode } from "./types";

export function snapshotFromPhase(
  phase: BuildPhase,
  primarySkillId: string,
  rollMode: RollMode,
): DpsSnapshot {
  const resolvedPrimary = primarySkillId || phase.gems[0]?.skill.id || "";
  return {
    gear: phase.gear,
    skillGroups: phase.gems,
    primarySkillId: resolvedPrimary,
    rollMode,
  };
}

export function swapWeapon(
  snapshot: DpsSnapshot,
  weapon: BuildGearEntry | null,
): DpsSnapshot {
  return {
    ...snapshot,
    gear: { ...snapshot.gear, weapon },
  };
}
