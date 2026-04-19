import type { GearLayout, SkillGroup } from "../../types/buildPlan";

export type DamageType = "physical" | "fire" | "cold" | "lightning" | "chaos";

export const DAMAGE_TYPES: readonly DamageType[] = [
  "physical", "fire", "cold", "lightning", "chaos",
] as const;

export type StatId = string;

export type ContributionKind = "flat" | "increased" | "more";

export type ModifierSourceType =
  | "gear"
  | "support"
  | "skill"
  | "gem_quality";

export interface ModifierSource {
  type: ModifierSourceType;
  id: string;
  label: string;
}

export interface StatContribution {
  value: number;
  kind: ContributionKind;
  tags: string[];
  source: ModifierSource;
}

export type StatMap = Map<StatId, StatContribution[]>;

export type RollMode = "actual" | "max";

export interface DpsSnapshot {
  gear: GearLayout;
  skillGroups: SkillGroup[];
  primarySkillId: string;
  rollMode: RollMode;
}

export interface DamageRange {
  min: number;
  max: number;
}

export type DamageByType = Record<DamageType, DamageRange>;

export interface CritInfo {
  chance: number;
  multi: number;
  expectedMulti: number;
}

export type BreakdownStageKind =
  | "base"
  | "add"
  | "inc"
  | "more"
  | "rate"
  | "crit"
  | "total";

export interface BreakdownContribution {
  source: ModifierSource;
  value: number;
}

export interface BreakdownStage {
  kind: BreakdownStageKind;
  label: string;
  detail?: string;
  value?: number | string;
  contributions?: BreakdownContribution[];
}

export interface SourceSummary {
  type: ModifierSourceType;
  count: number;
}

export interface CalcBreakdown {
  stages: BreakdownStage[];
  sources: SourceSummary[];
}

export interface SkillDps {
  skillId: string;
  skillName: string;
  level: number;
  dps: number;
  perHit: DamageRange;
  rate: number;
  crit: CritInfo;
  damageByType: DamageByType;
  breakdown: CalcBreakdown;
}
