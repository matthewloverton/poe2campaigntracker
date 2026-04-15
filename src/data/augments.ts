import rawAugments from "./raw/augments.json";

export interface AugmentEffect {
  target: string | string[];
  statText: string[];
  bondedStatText: string[];
}

export interface Augment {
  id: string;
  name: string;
  typeId: "Rune" | "SoulCore" | "Idol" | "AbyssalEye";
  typeName: string;
  requiredLevel: number;
  limit: string | null;
  effects: Record<string, AugmentEffect>;
}

export const allAugments: Augment[] = rawAugments as unknown as Augment[];

export const augmentById = new Map(allAugments.map((a) => [a.id, a]));

/** Get augments that apply to a given equipment category */
export function getAugmentsForCategory(category: string): Augment[] {
  return allAugments.filter((a) => a.effects[category] != null);
}

/** Get the effect text for an augment on a specific category */
export function getAugmentEffect(augment: Augment, category: string): string[] {
  const effect = augment.effects[category];
  if (!effect) return [];
  return [...effect.statText, ...effect.bondedStatText];
}

/** Map item classes to augment categories */
export function itemClassToAugmentCategory(itemClass: string): string | null {
  const map: Record<string, string> = {
    "Body Armour": "Body Armour",
    "Helmet": "Helmet",
    "Gloves": "Gloves",
    "Boots": "Boots",
    "Shield": "Shield",
    "Buckler": "Shield",
    "Wand": "Caster Weapons",
    "Staff": "Caster Weapons",
    "Sceptre": "Sceptre",
    "Focus": "Focus",
    "One Hand Mace": "Martial Weapons",
    "Two Hand Mace": "Martial Weapons",
    "Warstaff": "Martial Weapons",
    "Spear": "Martial Weapons",
    "Bow": "Bow",
    "Crossbow": "Martial Weapons",
    "TrapTool": "Martial Weapons",
  };
  return map[itemClass] ?? null;
}

/** How many sockets an item class gets by default */
export function defaultSocketCount(itemClass: string): number {
  const twoSocket = new Set([
    "Body Armour", "Two Hand Mace", "Staff", "Warstaff", "Bow",
  ]);
  return twoSocket.has(itemClass) ? 2 : 1;
}

/** Search augments by name */
export function searchAugments(query: string, category?: string): Augment[] {
  const q = query.toLowerCase();
  let pool = allAugments;
  if (category) pool = pool.filter((a) => a.effects[category] != null);
  if (!q) return pool;
  return pool.filter((a) => a.name.toLowerCase().includes(q));
}
