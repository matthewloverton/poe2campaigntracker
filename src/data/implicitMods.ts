import rawImplicitMods from "./raw/implicit_mods.json";
import { cleanModText } from "./mods";

export interface ImplicitMod {
  id: string;
  name: string;
  text: string;
  stats: Array<{ id: string; min: number; max: number }>;
}

export const allImplicitMods: ImplicitMod[] = rawImplicitMods as ImplicitMod[];

export const implicitModById: Map<string, ImplicitMod> = new Map(
  allImplicitMods.map((m) => [m.id, m])
);

/** Resolve an implicit mod's display text, stripping RePoE markup. */
export function implicitModText(mod: ImplicitMod): string {
  return cleanModText(mod.text);
}
