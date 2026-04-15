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

/** Get the base effect text for an augment on a specific category */
export function getAugmentEffect(augment: Augment, category: string): string[] {
  const effect = augment.effects[category];
  const allEffect = augment.effects["All"];
  const texts: string[] = [];
  if (allEffect) texts.push(...allEffect.statText);
  if (effect) texts.push(...effect.statText);
  return texts;
}

/** Get the bonded effect text for an augment on a specific category */
export function getAugmentBonded(augment: Augment, category: string): string[] {
  const effect = augment.effects[category];
  if (!effect) return [];
  return effect.bondedStatText;
}

/** Map item classes to augment categories (matches poe2db category names) */
export function itemClassToAugmentCategory(itemClass: string): string | null {
  const map: Record<string, string> = {
    "Body Armour": "Armour",
    "Helmet": "Armour",
    "Gloves": "Armour",
    "Boots": "Armour",
    "Shield": "Armour",
    "Buckler": "Armour",
    "Wand": "Wand or Staff",
    "Staff": "Wand or Staff",
    "Sceptre": "Wand or Staff",
    "Focus": "Wand or Staff",
    "One Hand Mace": "Martial Weapon",
    "Two Hand Mace": "Martial Weapon",
    "Warstaff": "Martial Weapon",
    "Spear": "Martial Weapon",
    "Bow": "Martial Weapon",
    "Crossbow": "Martial Weapon",
    "TrapTool": "Martial Weapon",
  };
  return map[itemClass] ?? null;
}

/** How many sockets an item class gets by default */
export function defaultSocketCount(itemClass: string): number {
  const twoSocket = new Set([
    "Body Armour", "Two Hand Mace", "Staff", "Warstaff", "Bow", "Crossbow", "Spear",
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
