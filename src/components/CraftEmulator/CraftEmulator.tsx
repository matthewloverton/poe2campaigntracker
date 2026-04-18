import { useState, useCallback, useMemo } from "react";
import type { BaseItem, ItemMod } from "../../types/itemDatabase";
import { resolveMod, modTierLabel, formatRolledWithRange, cleanModText, computeRollStats } from "../../data/mods";
import {
  allEssences,
  resolveEssenceEntryForItem,
  REGULAR_ESSENCE_SLUGS,
  CORRUPTED_ESSENCE_SLUGS,
  type EssenceTier,
} from "../../data/essences";
import {
  type EmulatedItem,
  type EmulatedMod,
  type GenType,
  type TierType,
  type VaalOutcome,
  emptyItem,
  transmute,
  augment,
  regal,
  alchemy,
  exalt,
  annul,
  chaos,
  divine,
  vaal,
  scour,
  applyEssence,
  modPickChance,
} from "../../lib/crafting/emulator";
import styles from "./CraftEmulator.module.css";

interface Props {
  base: BaseItem;
  onClose: () => void;
}

type CurrencyKey =
  | "transmute"
  | "augment"
  | "regal"
  | "alchemy"
  | "exalt"
  | "chaos"
  | "annul"
  | "divine"
  | "vaal";

interface CurrencyDef {
  key: CurrencyKey;
  label: string;
  shortHint: string;
  className: string;
  icon: string;
  /** Whether Greater/Perfect variants have meaning for this currency. */
  hasTierVariants: boolean;
  /** Per-tier minimum-modifier-level floor for Greater/Perfect variants. */
  minLevels?: { greater: number; perfect: number };
  apply: (item: EmulatedItem, base: BaseItem, minModLevel: number) => EmulatedItem;
  canApply: (item: EmulatedItem) => boolean;
}

const CURRENCIES: CurrencyDef[] = [
  {
    key: "transmute",
    label: "Orb of Transmutation",
    shortHint: "Normal → Magic (1 mod)",
    className: "transmute",
    icon: "/assets/currency/transmute.webp",
    hasTierVariants: true,
    minLevels: { greater: 55, perfect: 70 }, // per poe2wiki
    apply: (i, b, m) => transmute(i, b, Math.random, m),
    canApply: (i) => i.rarity === "normal" && !i.corrupted,
  },
  {
    key: "augment",
    label: "Orb of Augmentation",
    shortHint: "Magic +1 mod",
    className: "augment",
    icon: "/assets/currency/augment.webp",
    hasTierVariants: true,
    minLevels: { greater: 55, perfect: 70 }, // per poe2wiki
    apply: (i, b, m) => augment(i, b, Math.random, m),
    canApply: (i) =>
      i.rarity === "magic" && !i.corrupted && (i.prefixes.length < 1 || i.suffixes.length < 1),
  },
  {
    key: "regal",
    label: "Regal Orb",
    shortHint: "Magic → Rare (+1 mod)",
    className: "regal",
    icon: "/assets/currency/regal.webp",
    hasTierVariants: true,
    minLevels: { greater: 35, perfect: 50 }, // per poe2wiki
    apply: (i, b, m) => regal(i, b, Math.random, m),
    canApply: (i) => i.rarity === "magic" && !i.corrupted,
  },
  {
    key: "alchemy",
    label: "Orb of Alchemy",
    shortHint: "Normal → Rare (4 mods)",
    className: "alchemy",
    icon: "/assets/currency/alchemy.webp",
    hasTierVariants: false, // no Greater/Perfect variant exists
    apply: (i, b) => alchemy(i, b),
    canApply: (i) => i.rarity === "normal" && !i.corrupted,
  },
  {
    key: "exalt",
    label: "Exalted Orb",
    shortHint: "Rare +1 mod",
    className: "exalt",
    icon: "/assets/currency/exalt.webp",
    hasTierVariants: true,
    minLevels: { greater: 35, perfect: 50 }, // per poe2wiki
    apply: (i, b, m) => exalt(i, b, Math.random, m),
    canApply: (i) =>
      i.rarity === "rare" && !i.corrupted && (i.prefixes.length < 3 || i.suffixes.length < 3),
  },
  {
    key: "chaos",
    label: "Chaos Orb",
    shortHint: "Rare: remove 1 + add 1",
    className: "chaos",
    icon: "/assets/currency/chaos.webp",
    hasTierVariants: true,
    minLevels: { greater: 35, perfect: 50 }, // per poe2wiki
    apply: (i, b, m) => chaos(i, b, Math.random, m),
    canApply: (i) => i.rarity === "rare" && !i.corrupted && i.prefixes.length + i.suffixes.length > 0,
  },
  {
    key: "annul",
    label: "Orb of Annulment",
    shortHint: "Remove random mod",
    className: "annul",
    icon: "/assets/currency/annul.webp",
    hasTierVariants: false,
    apply: (i) => annul(i),
    canApply: (i) => !i.corrupted && i.prefixes.length + i.suffixes.length > 0,
  },
  {
    key: "divine",
    label: "Divine Orb",
    shortHint: "Reroll values",
    className: "divine",
    icon: "/assets/currency/divine.webp",
    hasTierVariants: false,
    apply: (i) => divine(i),
    canApply: (i) =>
      !i.corrupted && i.prefixes.length + i.suffixes.length + (i.corruptedImplicit ? 1 : 0) > 0,
  },
  {
    key: "vaal",
    label: "Vaal Orb",
    shortHint: "Corrupt the item",
    className: "vaal",
    icon: "/assets/currency/vaal.webp",
    hasTierVariants: false,
    apply: (i, b) => vaal(i, b).item,
    canApply: (i) => !i.corrupted,
  },
];

function minLevelFor(def: CurrencyDef, tier: TierType): number {
  if (!def.hasTierVariants || !def.minLevels) return 0;
  if (tier === "greater") return def.minLevels.greater;
  if (tier === "perfect") return def.minLevels.perfect;
  return 0; // lesser / normal
}

const TIER_PREFIX: Record<TierType, string> = { lesser: "Lesser ", normal: "", greater: "Greater ", perfect: "Perfect " };

const ESSENCE_TIER_LABEL: Record<TierType, string> = { lesser: "Lesser", normal: "Normal", greater: "Greater", perfect: "Perfect" };

type SlotKind = "prefix" | "suffix" | "implicit";

interface HistoryLineMod {
  kind: SlotKind;
  modId?: string;
  name: string;
  text: string;
  tier: string;
  /** Aggregate roll percentile across the mod's stat ranges (0–100). */
  rollPercent: number;
  rollNumerator: number;
  rollDenominator: number;
  /** For Divine events: the previous roll percentile of the same mod. */
  oldRollPercent?: number;
  /** Chance the mod would be picked from its applicable pool at this moment (0–1). */
  pickChance?: number;
}

interface HistoryEvent {
  id: number;
  /** CurrencyKey for orbs, or `essence:<slug>` for essence applies. */
  currencyKey: CurrencyKey | string;
  tierType?: TierType;
  /** Icon override for non-currency events like essences. */
  iconSrc?: string;
  /** Optional outcome label, e.g. Vaal's "Reforged (prefix lock)" / "No change". */
  message?: string;
  added: HistoryLineMod[];
  removed: HistoryLineMod[];
  /** Snapshots of state AFTER this action so clicking can restore it. */
  itemAfter: EmulatedItem;
  spendAfter: Record<CurrencyKey, number>;
}

const VAAL_OUTCOME_LABEL: Record<VaalOutcome, string> = {
  implicit: "Added corrupted implicit",
  socket: "Added a rune socket",
  no_change: "No change (corrupted)",
  reforge_prefix_lock: "Reforged — prefix lock",
  reforge_suffix_lock: "Reforged — suffix lock",
};

function modToLineWithBase(base: BaseItem, mod: ItemMod, em: EmulatedMod, kind: SlotKind): HistoryLineMod {
  const stats = computeRollStats(mod, em.roll);
  return {
    kind,
    modId: mod.id,
    name: mod.name || "",
    text: formatRolledWithRange(mod, em.roll),
    tier: modTierLabel(mod, base),
    rollPercent: stats.percent,
    rollNumerator: stats.numerator,
    rollDenominator: stats.denominator,
  };
}

/** Diff two item states into +/- lines. */
function diffItems(base: BaseItem, prev: EmulatedItem, next: EmulatedItem): { added: HistoryLineMod[]; removed: HistoryLineMod[] } {
  const keyOf = (em: EmulatedMod, kind: SlotKind) => `${kind}:${em.modId}:${em.roll}`;
  const prevMap = new Map<string, { mod: ItemMod; em: EmulatedMod; kind: SlotKind }>();
  const push = (em: EmulatedMod, kind: SlotKind) => {
    const mod = resolveMod(em.modId);
    if (!mod) return;
    prevMap.set(keyOf(em, kind), { mod, em, kind });
  };
  prev.prefixes.forEach((m) => push(m, "prefix"));
  prev.suffixes.forEach((m) => push(m, "suffix"));
  if (prev.corruptedImplicit) push(prev.corruptedImplicit, "implicit");

  const nextMap = new Map<string, { mod: ItemMod; em: EmulatedMod; kind: SlotKind }>();
  const pushNext = (em: EmulatedMod, kind: SlotKind) => {
    const mod = resolveMod(em.modId);
    if (!mod) return;
    nextMap.set(keyOf(em, kind), { mod, em, kind });
  };
  next.prefixes.forEach((m) => pushNext(m, "prefix"));
  next.suffixes.forEach((m) => pushNext(m, "suffix"));
  if (next.corruptedImplicit) pushNext(next.corruptedImplicit, "implicit");

  const added: HistoryLineMod[] = [];
  const removed: HistoryLineMod[] = [];
  for (const [k, v] of nextMap.entries()) {
    if (!prevMap.has(k)) added.push(modToLineWithBase(base, v.mod, v.em, v.kind));
  }
  for (const [k, v] of prevMap.entries()) {
    if (!nextMap.has(k)) removed.push(modToLineWithBase(base, v.mod, v.em, v.kind));
  }
  return { added, removed };
}

export function CraftEmulator({ base, onClose }: Props) {
  const [item, setItem] = useState<EmulatedItem>(() => emptyItem(base, 82));
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyKey | null>(null);
  const [selectedEssence, setSelectedEssence] = useState<string | null>(null);
  const [essencesOpen, setEssencesOpen] = useState(false);
  const [tierType, setTierType] = useState<TierType>("normal");
  const [spend, setSpend] = useState<Record<CurrencyKey, number>>({
    transmute: 0, augment: 0, regal: 0, alchemy: 0, exalt: 0, chaos: 0, annul: 0, divine: 0, vaal: 0,
  });
  const [essenceSpend, setEssenceSpend] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [nextEventId, setNextEventId] = useState(1);

  const activeDef = selectedCurrency != null
    ? CURRENCIES.find((c) => c.key === selectedCurrency) ?? null
    : null;

  const activeEssence = selectedEssence ? allEssences[selectedEssence] ?? null : null;

  /** Checks whether the currently-armed essence + tier can be applied to `item`. */
  function canApplyEssence(it: EmulatedItem, slug: string, tier: TierType): boolean {
    if (it.corrupted) return false;
    const ess = allEssences[slug];
    if (!ess) return false;
    const t = ess.tiers[tier as EssenceTier];
    if (!t) return false;
    // Must match at least one category on this base
    if (!resolveEssenceEntryForItem(slug, tier as EssenceTier, base)) return false;
    if (tier === "perfect") return it.rarity === "rare" && it.prefixes.length + it.suffixes.length > 0;
    return it.rarity === "magic";
  }

  const canArmedApply = activeDef != null
    ? activeDef.canApply(item)
    : activeEssence != null
      ? canApplyEssence(item, selectedEssence!, tierType)
      : false;

  const handleApplyEssence = useCallback(() => {
    if (!activeEssence || !selectedEssence) return;
    if (!canApplyEssence(item, selectedEssence, tierType)) return;
    const result = applyEssence(item, base, selectedEssence, tierType as EssenceTier, Math.random);
    if (!result) return;
    const { item: next } = result;
    const diff = diffItems(base, item, next);
    const nextEssenceSpend = {
      ...essenceSpend,
      [`${selectedEssence}:${tierType}`]: (essenceSpend[`${selectedEssence}:${tierType}`] ?? 0) + 1,
    };
    const essLabel = `${ESSENCE_TIER_LABEL[tierType]} Essence of ${activeEssence.name}`;
    const essTier = activeEssence.tiers[tierType as EssenceTier];
    const essIcon = essTier?.iconPath ? `/assets/${essTier.iconPath}` : undefined;
    setItem(next);
    setEssenceSpend(nextEssenceSpend);
    setHistory((h) => [{
      id: nextEventId,
      currencyKey: `essence:${selectedEssence}`,
      tierType,
      iconSrc: essIcon,
      message: essLabel,
      added: diff.added,
      removed: diff.removed,
      itemAfter: next,
      spendAfter: spend,
    }, ...h].slice(0, 80));
    setNextEventId((n) => n + 1);
    if (!canApplyEssence(next, selectedEssence, tierType)) setSelectedEssence(null);
  }, [activeEssence, selectedEssence, tierType, item, base, essenceSpend, nextEventId, spend]);

  const handleApply = useCallback(() => {
    if (activeEssence) { handleApplyEssence(); return; }
    if (!activeDef) return;
    if (!activeDef.canApply(item)) return;
    const appliedTier: TierType = activeDef.hasTierVariants ? tierType : "normal";
    const minLvl = minLevelFor(activeDef, appliedTier);
    // Vaal is special-cased so we can surface its random outcome in history.
    let vaalOutcome: VaalOutcome | undefined;
    let next: EmulatedItem;
    if (activeDef.key === "vaal") {
      const result = vaal(item, base, Math.random);
      next = result.item;
      vaalOutcome = result.outcome;
    } else {
      next = activeDef.apply(item, base, minLvl);
    }
    if (next === item) return;
    const diff = diffItems(base, item, next);

    // Compute per-mod pick chance for added mods. Each mod's "peers" excluded
    // are the groups that were on the item BEFORE the craft plus groups of
    // the other mods added by this same apply (approximates sequential
    // picks within currencies like Alchemy).
    const existingGroupsBefore = new Set<string>();
    for (const m of [...item.prefixes, ...item.suffixes]) {
      const mod = resolveMod(m.modId);
      if (mod) existingGroupsBefore.add(mod.group);
    }
    const addedGroupsByKind: Record<SlotKind, string[]> = { prefix: [], suffix: [], implicit: [] };
    const resolveAddedModId = (line: HistoryLineMod): string | null => {
      const prevIds = new Set<string>([
        ...item.prefixes.map((m) => m.modId),
        ...item.suffixes.map((m) => m.modId),
        ...(item.corruptedImplicit ? [item.corruptedImplicit.modId] : []),
      ]);
      const candidates: EmulatedMod[] = line.kind === "prefix"
        ? next.prefixes
        : line.kind === "suffix"
          ? next.suffixes
          : (next.corruptedImplicit ? [next.corruptedImplicit] : []);
      for (const em of candidates) {
        if (prevIds.has(em.modId)) continue;
        const mod = resolveMod(em.modId);
        if (!mod) continue;
        // Match by stats fingerprint (tier, name, rolled text).
        const stats = computeRollStats(mod, em.roll);
        if (
          stats.percent === line.rollPercent
          && mod.name === line.name
          && formatRolledWithRange(mod, em.roll) === line.text
        ) return em.modId;
      }
      return null;
    };

    // First pass: collect all added mod groups so pick-chance excludes them
    // when computing each other's probability.
    const addedMods: Array<{ line: HistoryLineMod; modId: string; mod: ItemMod }> = [];
    for (const line of diff.added) {
      const modId = resolveAddedModId(line);
      if (!modId) continue;
      const mod = resolveMod(modId);
      if (!mod) continue;
      addedGroupsByKind[line.kind].push(mod.group);
      addedMods.push({ line, modId, mod });
    }

    const enrichedAdded: HistoryLineMod[] = diff.added.map((line) => {
      const found = addedMods.find((a) => a.line === line);
      if (!found) return line;
      const mod = found.mod;
      const gen = line.kind === "implicit" ? "corrupted" : (mod.generationType as GenType);
      // Exclude pre-existing groups plus groups of sibling adds of the same gen.
      const excluded = new Set<string>(existingGroupsBefore);
      for (const g of addedGroupsByKind[line.kind]) if (g !== mod.group) excluded.add(g);
      const chance = modPickChance(base, item.itemLevel, gen, excluded, minLvl, found.modId);
      return { ...line, pickChance: chance };
    });

    const nextSpend = { ...spend, [activeDef.key]: spend[activeDef.key] + 1 };
    // For Divine, pair each added line with its old-roll counterpart (same
    // modId in the removed list) so the UI can render direction-coloured
    // deltas instead of a separate +/− pair.
    let finalAdded: HistoryLineMod[] = enrichedAdded;
    let finalRemoved: HistoryLineMod[] = diff.removed;
    if (activeDef.key === "divine") {
      finalAdded = enrichedAdded.map((line) => {
        if (!line.modId) return line;
        const pair = diff.removed.find((r) => r.modId === line.modId);
        return pair ? { ...line, oldRollPercent: pair.rollPercent } : line;
      });
      finalRemoved = []; // collapse into single "changed" view
    }

    setItem(next);
    setSpend(nextSpend);
    setHistory((h) => [{
      id: nextEventId,
      currencyKey: activeDef.key,
      tierType: appliedTier,
      message: vaalOutcome ? VAAL_OUTCOME_LABEL[vaalOutcome] : undefined,
      added: finalAdded,
      removed: finalRemoved,
      itemAfter: next,
      spendAfter: nextSpend,
    }, ...h].slice(0, 80));
    setNextEventId((n) => n + 1);
    // Auto-unarm if the armed currency can't apply to the resulting state.
    if (!activeDef.canApply(next)) setSelectedCurrency(null);
  }, [activeDef, item, base, nextEventId, tierType, spend]);

  const handleRestart = useCallback(() => {
    setItem(emptyItem(base, item.itemLevel));
    setHistory([]);
    setNextEventId(1);
    setSelectedCurrency(null);
    setSpend({ transmute: 0, augment: 0, regal: 0, alchemy: 0, exalt: 0, chaos: 0, annul: 0, divine: 0, vaal: 0 });
  }, [base, item.itemLevel]);

  const handleScour = useCallback(() => {
    const prev = item;
    const next = scour(item);
    if (next === prev) return;
    const diff = diffItems(base, prev, next);
    const ev: HistoryEvent = {
      id: nextEventId,
      currencyKey: "annul",
      added: [],
      removed: diff.removed,
      itemAfter: next,
      spendAfter: spend,
    };
    setItem(next);
    setHistory((h) => [ev, ...h].slice(0, 80));
    setNextEventId((n) => n + 1);
  }, [item, nextEventId, spend, base]);

  /** Revert state to after the given event and drop everything newer. */
  const handleRestore = useCallback((eventId: number) => {
    const idx = history.findIndex((e) => e.id === eventId);
    if (idx < 0) return;
    const ev = history[idx];
    setItem(ev.itemAfter);
    setSpend(ev.spendAfter);
    // history is newest-first; dropping indexes 0..idx-1 removes newer events.
    setHistory(history.slice(idx));
    // Unarm if whatever is currently selected can no longer be used.
    if (activeDef && !activeDef.canApply(ev.itemAfter)) setSelectedCurrency(null);
  }, [history, activeDef]);

  const setItemLevel = useCallback((lvl: number) => {
    setItem((i) => ({ ...i, itemLevel: Math.max(1, Math.min(100, lvl)) }));
  }, []);

  const totalSpend = useMemo(
    () => Object.values(spend).reduce((acc, n) => acc + n, 0),
    [spend],
  );

  // Resolve mods for display
  const prefixMods = item.prefixes.map((m) => ({ em: m, mod: resolveMod(m.modId) }));
  const suffixMods = item.suffixes.map((m) => ({ em: m, mod: resolveMod(m.modId) }));
  const corruptedMod = item.corruptedImplicit
    ? { em: item.corruptedImplicit, mod: resolveMod(item.corruptedImplicit.modId) }
    : null;

  const rarityClass = item.corrupted
    ? styles.rarityCorrupted
    : item.rarity === "magic"
      ? styles.rarityMagic
      : item.rarity === "rare"
        ? styles.rarityRare
        : styles.rarityNormal;

  const currencyByKey = useMemo(() => {
    const map = new Map<CurrencyKey, CurrencyDef>();
    for (const c of CURRENCIES) map.set(c.key, c);
    return map;
  }, []);

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>Craft Emulator</span>
          <span className={styles.subtle}>{base.name}</span>
          <button className={styles.restartBtn} onClick={handleRestart}>RESTART</button>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {/* Currency strip */}
        <div className={styles.currencyStrip}>
          {CURRENCIES.map((c) => {
            const disabled = !c.canApply(item);
            const active = selectedCurrency === c.key;
            return (
              <button
                key={c.key}
                className={`${styles.stripBtn} ${active ? styles.stripBtnActive : ""}`}
                disabled={disabled}
                onClick={() => {
                  if (active) {
                    setSelectedCurrency(null);
                  } else {
                    setSelectedCurrency(c.key);
                    setSelectedEssence(null);
                    setEssencesOpen(false);
                    if (!c.hasTierVariants) setTierType("normal");
                  }
                }}
                title={`${c.label} — ${c.shortHint}`}
              >
                <img className={styles.stripIcon} src={c.icon} alt="" />
                {spend[c.key] > 0 && <span className={styles.stripCount}>{spend[c.key]}</span>}
              </button>
            );
          })}
          <button
            className={`${styles.stripBtn} ${styles.essenceToggleBtn} ${essencesOpen ? styles.stripBtnActive : ""}`}
            onClick={() => {
              if (essencesOpen) {
                setEssencesOpen(false);
                setSelectedEssence(null);
              } else {
                setEssencesOpen(true);
                setSelectedCurrency(null);
                // Auto-arm the first regular essence and default to Normal tier.
                if (!selectedEssence) {
                  setSelectedEssence(REGULAR_ESSENCE_SLUGS[0]);
                  if (tierType === "perfect") setTierType("normal");
                }
              }
            }}
            title="Essences"
          >
            <img className={styles.stripIcon} src="/assets/essences/essence_infinite.png" alt="" />
          </button>
        </div>

        {/* Essence strip */}
        {essencesOpen && (
          <div className={styles.essenceStrip}>
            {[...REGULAR_ESSENCE_SLUGS, ...CORRUPTED_ESSENCE_SLUGS].map((slug) => {
              const ess = allEssences[slug];
              if (!ess) return null;
              // First available tier icon
              const anyTier = ess.tiers.normal ?? ess.tiers.lesser ?? ess.tiers.greater ?? ess.tiers.perfect;
              const icon = anyTier?.iconPath ? `/assets/${anyTier.iconPath}` : undefined;
              const active = selectedEssence === slug;
              const isCorrupted = CORRUPTED_ESSENCE_SLUGS.includes(slug as typeof CORRUPTED_ESSENCE_SLUGS[number]);
              return (
                <button
                  key={slug}
                  className={`${styles.stripBtn} ${active ? styles.stripBtnActive : ""} ${isCorrupted ? styles.essenceCorrupted : ""}`}
                  onClick={() => {
                    if (active) {
                      setSelectedEssence(null);
                    } else {
                      setSelectedEssence(slug);
                      setSelectedCurrency(null);
                      // Auto-pick a valid tier when switching between regular/corrupted essences.
                      if (isCorrupted) setTierType("perfect");
                      else if (tierType === "perfect") setTierType("normal");
                    }
                  }}
                  title={`Essence of ${ess.name}`}
                >
                  {icon && <img className={styles.stripIcon} src={icon} alt="" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Tier-type row */}
        <div className={styles.typeRow}>
          <span className={styles.typeLabel}>TYPE</span>
          {(["lesser", "normal", "greater", "perfect"] as TierType[]).map((t) => {
            const isActive = tierType === t;
            // Currency: no "lesser"; Greater/Perfect only on mods-adding orbs.
            // Essence: only tiers that exist for this essence.
            const supportsThisTier = activeEssence
              ? !!activeEssence.tiers[t]
              : !activeDef
                ? t !== "lesser"
                : t === "lesser"
                  ? false
                  : activeDef.hasTierVariants || t === "normal";
            return (
              <button
                key={t}
                className={`${styles.typeBtn} ${isActive ? styles.typeBtnActive : ""}`}
                disabled={!supportsThisTier}
                onClick={() => setTierType(t)}
                title={
                  supportsThisTier
                    ? activeEssence
                      ? `${ESSENCE_TIER_LABEL[t]} Essence of ${activeEssence.name}`
                      : t === "greater"
                        ? "Min modifier level floor (Greater)"
                        : t === "perfect"
                          ? "Min modifier level floor (Perfect)"
                          : undefined
                    : activeEssence
                      ? `No ${ESSENCE_TIER_LABEL[t]} variant for this essence`
                      : `${activeDef?.label ?? "this currency"} has no ${t} variant`
                }
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            );
          })}
          <span className={styles.spend}>
            <span className={styles.subtle}>Currency used:</span>
            <strong>{totalSpend}</strong>
          </span>
        </div>

        <div className={styles.body}>
          {/* Item panel — clickable as a craft zone when any currency/essence is armed. */}
          <div
            className={`${styles.itemPanel} ${(activeDef || activeEssence) && canArmedApply ? styles.itemPanelArmed : ""} ${(activeDef || activeEssence) && !canArmedApply ? styles.itemPanelBlocked : ""}`}
            onClick={(activeDef || activeEssence) && canArmedApply ? handleApply : undefined}
            style={(() => {
              if (canArmedApply) {
                const icon = activeDef
                  ? activeDef.icon
                  : activeEssence?.tiers[tierType as EssenceTier]?.iconPath
                    ? `/assets/${activeEssence!.tiers[tierType as EssenceTier]!.iconPath}`
                    : null;
                if (icon) return { cursor: `url(${icon}) 16 16, pointer` };
              } else if (activeDef || activeEssence) {
                return { cursor: "not-allowed" };
              }
              return undefined;
            })()}
            title={
              !activeDef && !activeEssence
                ? undefined
                : canArmedApply
                  ? `Click to apply ${
                      activeEssence
                        ? `${ESSENCE_TIER_LABEL[tierType]} Essence of ${activeEssence.name}`
                        : `${activeDef!.hasTierVariants && tierType !== "normal" ? TIER_PREFIX[tierType] : ""}${activeDef!.label}`
                    }`
                  : `${
                      activeEssence
                        ? `${ESSENCE_TIER_LABEL[tierType]} Essence of ${activeEssence.name}`
                        : activeDef!.label
                    } can't be applied in the item's current state`
            }
          >
            <div className={styles.itemCard}>
              {base.iconPath ? (
                <img className={styles.itemIcon} src={`/assets/${base.iconPath}`} alt={base.name} />
              ) : (
                <div className={styles.itemIconFallback}>?</div>
              )}
              <div className={styles.itemInfo}>
                <div className={`${styles.itemName} ${rarityClass}`}>{base.name}</div>
                <div className={styles.itemClass}>
                  {base.itemClass}
                  <span className={styles.rarityTag}>
                    {" · "}{item.corrupted ? "Corrupted " : ""}{item.rarity[0].toUpperCase() + item.rarity.slice(1)}
                  </span>
                </div>
                <div className={styles.ilvlRow} onClick={(e) => e.stopPropagation()}>
                  <label className={styles.ilvlLabel}>Item Level</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={item.itemLevel}
                    onChange={(e) => setItemLevel(Number(e.target.value))}
                    className={styles.ilvlInput}
                  />
                  <span className={styles.affixCounter}>
                    P{item.prefixes.length} · S{item.suffixes.length}
                    {item.corruptedImplicit ? " · C1" : ""}
                    {item.extraRuneSockets > 0 ? ` · +${item.extraRuneSockets}⬛` : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Mod list */}
            <div className={styles.modList}>
              {corruptedMod?.mod && (
                <div className={`${styles.modRow} ${styles.modCorrupted}`}>
                  <span className={styles.modBadge}>IMP</span>
                  <span className={styles.modTier}>{modTierLabel(corruptedMod.mod, base)}</span>
                  <span className={styles.modText}>{renderRolledText(formatRolledWithRange(corruptedMod.mod, corruptedMod.em.roll))}</span>
                </div>
              )}
              {prefixMods.length === 0 && suffixMods.length === 0 && !corruptedMod && (
                <div className={styles.empty}>Pick a currency from above, then click the item to craft.</div>
              )}
              {prefixMods.map((p, i) => p.mod && (
                <div key={`p${i}`} className={`${styles.modRow} ${styles.modPrefix}`}>
                  <span className={styles.modBadge}>P</span>
                  <span className={styles.modTier}>{modTierLabel(p.mod, base)}</span>
                  <span className={styles.modName}>{p.mod.name}</span>
                  <span className={styles.modText}>{renderRolledText(formatRolledWithRange(p.mod, p.em.roll))}</span>
                </div>
              ))}
              {suffixMods.map((s, i) => s.mod && (
                <div key={`s${i}`} className={`${styles.modRow} ${styles.modSuffix}`}>
                  <span className={styles.modBadge}>S</span>
                  <span className={styles.modTier}>{modTierLabel(s.mod, base)}</span>
                  <span className={styles.modName}>{s.mod.name}</span>
                  <span className={styles.modText}>{renderRolledText(formatRolledWithRange(s.mod, s.em.roll))}</span>
                </div>
              ))}
            </div>

            <div className={styles.itemActions}>
              <button
                className={styles.secondaryBtn}
                onClick={handleScour}
                disabled={item.corrupted || (item.prefixes.length + item.suffixes.length === 0)}
              >
                Scour
              </button>
            </div>
          </div>

          {/* History panel */}
          <div className={styles.historyPanel}>
            <div className={styles.historyHeader}>
              <span className={styles.historyTitle}>History</span>
              {history.length > 0 && <span className={styles.subtle}>{history.length} events</span>}
            </div>
            <div className={styles.historyList}>
              {history.length === 0 && (
                <div className={styles.empty}>Actions will appear here.</div>
              )}
              {history.map((ev) => {
                const def = currencyByKey.get(ev.currencyKey as CurrencyKey);
                return (
                  <div
                    key={ev.id}
                    className={styles.historyEvent}
                    onClick={() => handleRestore(ev.id)}
                    title="Click to restore state from this point (newer events will be removed)"
                  >
                    <div className={styles.historyEventHeader}>
                      {(ev.iconSrc ?? def?.icon) && (
                        <img className={styles.historyIcon} src={ev.iconSrc ?? def!.icon} alt="" />
                      )}
                      <span className={styles.historyEventName}>
                        {!ev.iconSrc && ev.tierType && ev.tierType !== "normal" ? TIER_PREFIX[ev.tierType] : ""}
                        {ev.iconSrc ? (ev.message ?? "") : (def?.label ?? ev.currencyKey)}
                      </span>
                      {!ev.iconSrc && ev.message && (
                        <span className={styles.historyEventMessage}>— {ev.message}</span>
                      )}
                    </div>
                    {ev.currencyKey !== "divine" && ev.removed.map((line, i) => (
                      <HistoryLine key={`r${i}`} line={line} kind="removed" showRollQuality={false} />
                    ))}
                    {ev.added.map((line, i) => (
                      <HistoryLine key={`a${i}`} line={line} kind="added" showRollQuality={ev.currencyKey === "divine"} isDivine={ev.currencyKey === "divine"} />
                    ))}
                    {ev.added.length === 0 && ev.removed.length === 0 && (
                      <div className={styles.historyLine}>
                        <span className={styles.subtle}>No effect</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Compact: collapse the roll+range into single line text without newlines. */
function cleanLineText(text: string): string {
  return cleanModText(text).replace(/\n/g, " · ");
}

/** Split rolled mod text into React nodes so `(min-max)` ranges render dimmer. */
function renderRolledText(text: string) {
  return cleanLineText(text).split(/(\(-?\d+(?:\.\d+)?-\d+(?:\.\d+)?\))/g).map((part, i) => {
    if (/^\(-?\d+(?:\.\d+)?-\d+(?:\.\d+)?\)$/.test(part)) {
      return <span key={i} className={styles.rollRange}>{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

function HistoryLine({ line, kind, showRollQuality, isDivine }: { line: HistoryLineMod; kind: "added" | "removed"; showRollQuality: boolean; isDivine?: boolean }) {
  const showRoll = showRollQuality && line.rollDenominator > 0;
  const chanceTxt = !isDivine && line.pickChance != null
    ? `(${(line.pickChance * 100).toFixed(line.pickChance < 0.01 ? 3 : 2)}%)`
    : null;

  let cls: string;
  if (isDivine && line.oldRollPercent != null) {
    const delta = line.rollPercent - line.oldRollPercent;
    cls = delta > 0 ? styles.historyLineAdded
        : delta < 0 ? styles.historyLineRemoved
        : styles.historyLineNeutral;
  } else {
    cls = kind === "added" ? styles.historyLineAdded : styles.historyLineRemoved;
  }

  return (
    <div className={`${styles.historyLine} ${cls}`}>
      {!isDivine && <span className={styles.historyDelta}>{kind === "added" ? "+" : "−"}</span>}
      <span className={styles.historyLineText}>
        {line.tier && <span className={styles.historyLineTier}>{line.tier}</span>}
        {cleanLineText(line.text)}
        {showRoll && (
          <span className={styles.historyRoll}>
            {" "}
            {line.oldRollPercent != null && `${line.oldRollPercent}% → `}
            {line.rollPercent}% ({line.rollNumerator}/{line.rollDenominator})
          </span>
        )}
        {chanceTxt && <span className={styles.historyChance}> {chanceTxt}</span>}
      </span>
    </div>
  );
}
