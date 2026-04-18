import { useState, useCallback, useMemo } from "react";
import type { BaseItem, ItemMod } from "../../types/itemDatabase";
import { modById, modTierLabel, formatRolledWithRange, cleanModText } from "../../data/mods";
import {
  type EmulatedItem,
  type EmulatedMod,
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

type TierType = "normal" | "greater" | "perfect";

interface CurrencyDef {
  key: CurrencyKey;
  label: string;
  shortHint: string;
  className: string;
  icon: string;
  apply: (item: EmulatedItem, base: BaseItem) => EmulatedItem;
  canApply: (item: EmulatedItem) => boolean;
}

const CURRENCIES: CurrencyDef[] = [
  {
    key: "transmute",
    label: "Orb of Transmutation",
    shortHint: "Normal → Magic (1 mod)",
    className: "transmute",
    icon: "/assets/currency/transmute.webp",
    apply: (i, b) => transmute(i, b),
    canApply: (i) => i.rarity === "normal" && !i.corrupted,
  },
  {
    key: "augment",
    label: "Orb of Augmentation",
    shortHint: "Magic +1 mod",
    className: "augment",
    icon: "/assets/currency/augment.webp",
    apply: (i, b) => augment(i, b),
    canApply: (i) =>
      i.rarity === "magic" && !i.corrupted && (i.prefixes.length < 1 || i.suffixes.length < 1),
  },
  {
    key: "regal",
    label: "Regal Orb",
    shortHint: "Magic → Rare (+1 mod)",
    className: "regal",
    icon: "/assets/currency/regal.webp",
    apply: (i, b) => regal(i, b),
    canApply: (i) => i.rarity === "magic" && !i.corrupted,
  },
  {
    key: "alchemy",
    label: "Orb of Alchemy",
    shortHint: "Normal → Rare (4 mods)",
    className: "alchemy",
    icon: "/assets/currency/alchemy.webp",
    apply: (i, b) => alchemy(i, b),
    canApply: (i) => i.rarity === "normal" && !i.corrupted,
  },
  {
    key: "exalt",
    label: "Exalted Orb",
    shortHint: "Rare +1 mod",
    className: "exalt",
    icon: "/assets/currency/exalt.webp",
    apply: (i, b) => exalt(i, b),
    canApply: (i) =>
      i.rarity === "rare" && !i.corrupted && (i.prefixes.length < 3 || i.suffixes.length < 3),
  },
  {
    key: "chaos",
    label: "Chaos Orb",
    shortHint: "Rare: remove 1 + add 1",
    className: "chaos",
    icon: "/assets/currency/chaos.webp",
    apply: (i, b) => chaos(i, b),
    canApply: (i) => i.rarity === "rare" && !i.corrupted && i.prefixes.length + i.suffixes.length > 0,
  },
  {
    key: "annul",
    label: "Orb of Annulment",
    shortHint: "Remove random mod",
    className: "annul",
    icon: "/assets/currency/annul.webp",
    apply: (i) => annul(i),
    canApply: (i) => !i.corrupted && i.prefixes.length + i.suffixes.length > 0,
  },
  {
    key: "divine",
    label: "Divine Orb",
    shortHint: "Reroll values",
    className: "divine",
    icon: "/assets/currency/divine.webp",
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
    apply: (i, b) => vaal(i, b),
    canApply: (i) => !i.corrupted,
  },
];

type SlotKind = "prefix" | "suffix" | "implicit";

interface HistoryLineMod {
  kind: SlotKind;
  name: string;
  text: string;
  tier: string;
}

interface HistoryEvent {
  id: number;
  currencyKey: CurrencyKey;
  added: HistoryLineMod[];
  removed: HistoryLineMod[];
}

function modToLineWithBase(base: BaseItem, mod: ItemMod, em: EmulatedMod, kind: SlotKind): HistoryLineMod {
  return {
    kind,
    name: mod.name || "",
    text: formatRolledWithRange(mod, em.roll),
    tier: modTierLabel(mod, base),
  };
}

/** Diff two item states into +/- lines. */
function diffItems(base: BaseItem, prev: EmulatedItem, next: EmulatedItem): { added: HistoryLineMod[]; removed: HistoryLineMod[] } {
  const keyOf = (em: EmulatedMod, kind: SlotKind) => `${kind}:${em.modId}:${em.roll}`;
  const prevMap = new Map<string, { mod: ItemMod; em: EmulatedMod; kind: SlotKind }>();
  const push = (em: EmulatedMod, kind: SlotKind) => {
    const mod = modById.get(em.modId);
    if (!mod) return;
    prevMap.set(keyOf(em, kind), { mod, em, kind });
  };
  prev.prefixes.forEach((m) => push(m, "prefix"));
  prev.suffixes.forEach((m) => push(m, "suffix"));
  if (prev.corruptedImplicit) push(prev.corruptedImplicit, "implicit");

  const nextMap = new Map<string, { mod: ItemMod; em: EmulatedMod; kind: SlotKind }>();
  const pushNext = (em: EmulatedMod, kind: SlotKind) => {
    const mod = modById.get(em.modId);
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
  const [tierType, setTierType] = useState<TierType>("normal");
  const [spend, setSpend] = useState<Record<CurrencyKey, number>>({
    transmute: 0, augment: 0, regal: 0, alchemy: 0, exalt: 0, chaos: 0, annul: 0, divine: 0, vaal: 0,
  });
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [nextEventId, setNextEventId] = useState(1);

  const activeDef = selectedCurrency != null
    ? CURRENCIES.find((c) => c.key === selectedCurrency) ?? null
    : null;

  const canArmedApply = activeDef != null && activeDef.canApply(item);

  const handleApply = useCallback(() => {
    if (!activeDef) return;
    if (!activeDef.canApply(item)) return;
    const next = activeDef.apply(item, base);
    if (next === item) return;
    const diff = diffItems(base, item, next);
    setItem(next);
    setSpend((s) => ({ ...s, [activeDef.key]: s[activeDef.key] + 1 }));
    setHistory((h) => [{ id: nextEventId, currencyKey: activeDef.key, ...diff }, ...h].slice(0, 80));
    setNextEventId((n) => n + 1);
  }, [activeDef, item, base, nextEventId]);

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
    };
    setItem(next);
    setHistory((h) => [ev, ...h].slice(0, 80));
    setNextEventId((n) => n + 1);
  }, [item, nextEventId]);

  const setItemLevel = useCallback((lvl: number) => {
    setItem((i) => ({ ...i, itemLevel: Math.max(1, Math.min(100, lvl)) }));
  }, []);

  const totalSpend = useMemo(
    () => Object.values(spend).reduce((acc, n) => acc + n, 0),
    [spend],
  );

  // Resolve mods for display
  const prefixMods = item.prefixes.map((m) => ({ em: m, mod: modById.get(m.modId) }));
  const suffixMods = item.suffixes.map((m) => ({ em: m, mod: modById.get(m.modId) }));
  const corruptedMod = item.corruptedImplicit
    ? { em: item.corruptedImplicit, mod: modById.get(item.corruptedImplicit.modId) }
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
                onClick={() => setSelectedCurrency(active ? null : c.key)}
                title={`${c.label} — ${c.shortHint}`}
              >
                <img className={styles.stripIcon} src={c.icon} alt="" />
                {spend[c.key] > 0 && <span className={styles.stripCount}>{spend[c.key]}</span>}
              </button>
            );
          })}
        </div>

        {/* Tier-type row */}
        <div className={styles.typeRow}>
          <span className={styles.typeLabel}>TYPE</span>
          {(["normal", "greater", "perfect"] as TierType[]).map((t) => {
            const isActive = tierType === t;
            const isDisabled = t !== "normal";
            return (
              <button
                key={t}
                className={`${styles.typeBtn} ${isActive ? styles.typeBtnActive : ""}`}
                disabled={isDisabled}
                onClick={() => setTierType(t)}
                title={isDisabled ? "Greater / Perfect tiers coming in a later update" : undefined}
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
          {/* Item panel */}
          <div className={styles.itemPanel}>
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
                <div className={styles.ilvlRow}>
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
                    P{item.prefixes.length} · S{item.suffixes.length}{item.corruptedImplicit ? " · C1" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Craftable click-target */}
            <button
              className={`${styles.craftTarget} ${activeDef ? styles.craftTargetArmed : ""} ${activeDef && !canArmedApply ? styles.craftTargetBlocked : ""}`}
              onClick={handleApply}
              disabled={!canArmedApply}
              title={
                !activeDef
                  ? "Select a currency from the strip above"
                  : canArmedApply
                    ? `Use ${activeDef.label} on this item`
                    : `${activeDef.label} can't be applied in the item's current state`
              }
            >
              {activeDef ? (
                <>
                  <img src={activeDef.icon} className={styles.craftTargetIcon} alt="" />
                  <span className={styles.craftTargetLabel}>
                    {canArmedApply ? `Use ${activeDef.label}` : "Not applicable"}
                  </span>
                </>
              ) : (
                <span className={styles.craftTargetLabel}>Select currency to craft</span>
              )}
            </button>

            {/* Mod list */}
            <div className={styles.modList}>
              {corruptedMod?.mod && (
                <div className={`${styles.modRow} ${styles.modCorrupted}`}>
                  <span className={styles.modBadge}>IMP</span>
                  <span className={styles.modTier}>{modTierLabel(corruptedMod.mod)}</span>
                  <span className={styles.modText}>{formatRolledWithRange(corruptedMod.mod, corruptedMod.em.roll)}</span>
                </div>
              )}
              {prefixMods.length === 0 && suffixMods.length === 0 && !corruptedMod && (
                <div className={styles.empty}>Pick a currency from above, then click the item to craft.</div>
              )}
              {prefixMods.map((p, i) => p.mod && (
                <div key={`p${i}`} className={`${styles.modRow} ${styles.modPrefix}`}>
                  <span className={styles.modBadge}>P</span>
                  <span className={styles.modTier}>{modTierLabel(p.mod)}</span>
                  <span className={styles.modName}>{p.mod.name}</span>
                  <span className={styles.modText}>{formatRolledWithRange(p.mod, p.em.roll)}</span>
                </div>
              ))}
              {suffixMods.map((s, i) => s.mod && (
                <div key={`s${i}`} className={`${styles.modRow} ${styles.modSuffix}`}>
                  <span className={styles.modBadge}>S</span>
                  <span className={styles.modTier}>{modTierLabel(s.mod)}</span>
                  <span className={styles.modName}>{s.mod.name}</span>
                  <span className={styles.modText}>{formatRolledWithRange(s.mod, s.em.roll)}</span>
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
                const def = currencyByKey.get(ev.currencyKey);
                return (
                  <div key={ev.id} className={styles.historyEvent}>
                    <div className={styles.historyEventHeader}>
                      {def && <img className={styles.historyIcon} src={def.icon} alt="" />}
                      <span className={styles.historyEventName}>{def?.label ?? ev.currencyKey}</span>
                    </div>
                    {ev.removed.map((line, i) => (
                      <div key={`r${i}`} className={`${styles.historyLine} ${styles.historyLineRemoved}`}>
                        <span className={styles.historyDelta}>−</span>
                        <span className={styles.historyLineText}>
                          {line.tier && <span className={styles.historyLineTier}>{line.tier}</span>}
                          {cleanLineText(line.text)}
                        </span>
                      </div>
                    ))}
                    {ev.added.map((line, i) => (
                      <div key={`a${i}`} className={`${styles.historyLine} ${styles.historyLineAdded}`}>
                        <span className={styles.historyDelta}>+</span>
                        <span className={styles.historyLineText}>
                          {line.tier && <span className={styles.historyLineTier}>{line.tier}</span>}
                          {cleanLineText(line.text)}
                        </span>
                      </div>
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
