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
  return allAugments.filter((a) =>
    a.effects[category] != null || a.effects["All"] != null || a.effects["All Equipment"] != null
  );
}

/** Get the base effect text for an augment on a specific category */
export function getAugmentEffect(augment: Augment, category: string): string[] {
  const effect = augment.effects[category];
  const allEffect = augment.effects["All"] ?? augment.effects["All Equipment"];
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

export interface AugmentFamily {
  baseName: string;
  lesser?: Augment;
  regular?: Augment;
  greater?: Augment;
}

/** Group augments into Lesser/Regular/Greater families */
export function getAugmentFamilies(category?: string): AugmentFamily[] {
  let pool = allAugments;
  if (category) pool = getAugmentsForCategory(category);

  const families = new Map<string, AugmentFamily>();

  for (const a of pool) {
    let baseName = a.name;
    let tier: "lesser" | "regular" | "greater" = "regular";

    if (a.name.startsWith("Lesser ")) {
      baseName = a.name.slice(7);
      tier = "lesser";
    } else if (a.name.startsWith("Greater ")) {
      baseName = a.name.slice(8);
      tier = "greater";
    }

    if (!families.has(baseName)) {
      families.set(baseName, { baseName });
    }
    families.get(baseName)![tier] = a;
  }

  return [...families.values()].sort((a, b) => a.baseName.localeCompare(b.baseName));
}

/** Search augment families by name */
export function searchAugmentFamilies(query: string, category?: string): AugmentFamily[] {
  const q = query.toLowerCase();
  const families = getAugmentFamilies(category);
  if (!q) return families;
  return families.filter((f) => f.baseName.toLowerCase().includes(q));
}

/** Search augments by name */
export function searchAugments(query: string, category?: string): Augment[] {
  const q = query.toLowerCase();
  let pool = allAugments;
  if (category) pool = getAugmentsForCategory(category);
  if (!q) return pool;
  return pool.filter((a) => a.name.toLowerCase().includes(q));
}
