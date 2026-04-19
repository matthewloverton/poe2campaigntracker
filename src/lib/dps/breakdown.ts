import type {
  BreakdownStage,
  CalcBreakdown,
  ModifierSource,
  ModifierSourceType,
  SourceSummary,
} from "./types";

export function makeBreakdown(
  stages: BreakdownStage[],
  sources: ModifierSource[],
): CalcBreakdown {
  return { stages, sources: summariseSources(sources) };
}

function summariseSources(sources: ModifierSource[]): SourceSummary[] {
  const counts = new Map<ModifierSourceType, number>();
  for (const s of sources) counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
  return Array.from(counts.entries()).map(([type, count]) => ({ type, count }));
}
