import { useMemo } from "react";
import { calcDps } from "../lib/dps";
import type { DpsSnapshot, SkillDps } from "../lib/dps";

export function useDps(snapshot: DpsSnapshot): SkillDps[] {
  return useMemo(() => calcDps(snapshot), [snapshot]);
}
