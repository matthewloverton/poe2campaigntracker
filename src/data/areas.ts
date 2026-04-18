import type { Area } from "../types";
import rawAreasData from "./raw/areas.json";

type RawArea = {
  id: string;
  name: string;
  recommendation?: string;
};
type RawAreas = RawArea[][];

function parseRecommendation(
  rec?: string
): { min: number; max: number } | undefined {
  if (!rec) return undefined;
  const parts = rec.split("|").map((s) => parseInt(s.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { min: parts[0], max: parts[1] };
  }
  return undefined;
}

export function transformAreasData(raw: RawAreas): Area[] {
  const areas: Area[] = [];
  for (let actIndex = 0; actIndex < raw.length; actIndex++) {
    for (const rawArea of raw[actIndex]) {
      areas.push({
        id: rawArea.id.toLowerCase(),
        name: rawArea.name.toLowerCase(),
        act: actIndex + 1,
        recommendation: parseRecommendation(rawArea.recommendation),
      });
    }
  }
  return areas;
}

export const areas: Area[] = transformAreasData(rawAreasData as RawAreas);

export const areaById = new Map(areas.map((a) => [a.id, a]));

export const areaByName = new Map(areas.map((a) => [a.name.toLowerCase(), a]));

export function getAreaAct(areaId: string): number | undefined {
  return areaById.get(areaId.toLowerCase())?.act;
}

export function isTownZone(areaId: string): boolean {
  return areaId.toLowerCase().includes("town");
}
