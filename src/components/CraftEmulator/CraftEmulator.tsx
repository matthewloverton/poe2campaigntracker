import { useState, useCallback, useMemo } from "react";
import type { BaseItem, ItemMod } from "../../types/itemDatabase";
import { modById, cleanModText } from "../../data/mods";
import {
  type EmulatedItem,
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

interface CurrencyDef {
  key: CurrencyKey;
  label: string;
  shortHint: string;
  className: string;
  apply: (item: EmulatedItem, base: BaseItem) => EmulatedItem;
  canApply: (item: EmulatedItem) => boolean;
}

const CURRENCIES: CurrencyDef[] = [
  {
    key: "transmute",
    label: "Orb of Transmutation",
    shortHint: "Normal → Magic (1 mod)",
    className: "transmute",
    apply: (i, b) => transmute(i, b),
    canApply: (i) => i.rarity === "normal" && !i.corrupted,
  },
  {
    key: "augment",
    label: "Orb of Augmentation",
    shortHint: "Magic +1 mod",
    className: "augment",
    apply: (i, b) => augment(i, b),
    canApply: (i) =>
      i.rarity === "magic" && !i.corrupted && (i.prefixes.length < 1 || i.suffixes.length < 1),
  },
  {
    key: "regal",
    label: "Regal Orb",
    shortHint: "Magic → Rare (+1 mod)",
    className: "regal",
    apply: (i, b) => regal(i, b),
    canApply: (i) => i.rarity === "magic" && !i.corrupted,
  },
  {
    key: "alchemy",
    label: "Orb of Alchemy",
    shortHint: "Normal → Rare (4 mods)",
    className: "alchemy",
    apply: (i, b) => alchemy(i, b),
    canApply: (i) => i.rarity === "normal" && !i.corrupted,
  },
  {
    key: "exalt",
    label: "Exalted Orb",
    shortHint: "Rare +1 mod",
    className: "exalt",
    apply: (i, b) => exalt(i, b),
    canApply: (i) =>
      i.rarity === "rare" && !i.corrupted && (i.prefixes.length < 3 || i.suffixes.length < 3),
  },
  {
    key: "chaos",
    label: "Chaos Orb",
    shortHint: "Rare: remove 1 + add 1",
    className: "chaos",
    apply: (i, b) => chaos(i, b),
    canApply: (i) => i.rarity === "rare" && !i.corrupted && i.prefixes.length + i.suffixes.length > 0,
  },
  {
    key: "annul",
    label: "Orb of Annulment",
    shortHint: "Remove random mod",
    className: "annul",
    apply: (i) => annul(i),
    canApply: (i) => !i.corrupted && i.prefixes.length + i.suffixes.length > 0,
  },
  {
    key: "divine",
    label: "Divine Orb",
    shortHint: "Reroll values",
    className: "divine",
    apply: (i) => divine(i),
    canApply: (i) => i.prefixes.length + i.suffixes.length + (i.corruptedImplicit ? 1 : 0) > 0,
  },
  {
    key: "vaal",
    label: "Vaal Orb",
    shortHint: "Corrupt the item",
    className: "vaal",
    apply: (i, b) => vaal(i, b),
    canApply: (i) => !i.corrupted,
  },
];

function formatRolledText(mod: ItemMod, roll: number): string {
  const text = cleanModText(mod.text);
  return text.replace(/\((-?\d+)[–—-](-?\d+)\)/g, (_m, a, b) => {
    const min = Number(a), max = Number(b);
    return String(Math.round(min + (max - min) * roll / 100));
  });
}

export function CraftEmulator({ base, onClose }: Props) {
  const [item, setItem] = useState<EmulatedItem>(() => emptyItem(base, 82));
  const [spend, setSpend] = useState<Record<CurrencyKey, number>>({
    transmute: 0, augment: 0, regal: 0, alchemy: 0, exalt: 0, chaos: 0, annul: 0, divine: 0, vaal: 0,
  });
  const [history, setHistory] = useState<string[]>([]);

  const handleApply = useCallback((c: CurrencyDef) => {
    if (!c.canApply(item)) return;
    const next = c.apply(item, base);
    if (next === item) return; // no-op
    setItem(next);
    setSpend((s) => ({ ...s, [c.key]: s[c.key] + 1 }));
    setHistory((h) => [c.label, ...h].slice(0, 30));
  }, [item, base]);

  const handleReset = useCallback(() => {
    setItem(emptyItem(base, item.itemLevel));
    setHistory([]);
  }, [base, item.itemLevel]);

  const handleScour = useCallback(() => {
    setItem((i) => scour(i));
    setHistory((h) => ["Scoured to base", ...h].slice(0, 30));
  }, []);

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

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>Craft Emulator</span>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
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
                </div>
              </div>
            </div>

            {/* Mod list */}
            <div className={styles.modList}>
              {corruptedMod?.mod && (
                <div className={`${styles.modRow} ${styles.modCorrupted}`}>
                  <span className={styles.modBadge}>IMP</span>
                  <span className={styles.modText}>{formatRolledText(corruptedMod.mod, corruptedMod.em.roll)}</span>
                </div>
              )}
              {prefixMods.length === 0 && suffixMods.length === 0 && !corruptedMod && (
                <div className={styles.empty}>Use currency below to start crafting.</div>
              )}
              {prefixMods.map((p, i) => p.mod && (
                <div key={`p${i}`} className={`${styles.modRow} ${styles.modPrefix}`}>
                  <span className={styles.modBadge}>P</span>
                  <span className={styles.modName}>{p.mod.name}</span>
                  <span className={styles.modText}>{formatRolledText(p.mod, p.em.roll)}</span>
                </div>
              ))}
              {suffixMods.map((s, i) => s.mod && (
                <div key={`s${i}`} className={`${styles.modRow} ${styles.modSuffix}`}>
                  <span className={styles.modBadge}>S</span>
                  <span className={styles.modName}>{s.mod.name}</span>
                  <span className={styles.modText}>{formatRolledText(s.mod, s.em.roll)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Currency panel */}
          <div className={styles.currencyPanel}>
            <div className={styles.sectionTitle}>Currency</div>
            <div className={styles.currencyGrid}>
              {CURRENCIES.map((c) => {
                const disabled = !c.canApply(item);
                return (
                  <button
                    key={c.key}
                    className={`${styles.currencyBtn} ${styles[`cur_${c.className}`]}`}
                    disabled={disabled}
                    onClick={() => handleApply(c)}
                    title={c.label}
                  >
                    <span className={styles.curLabel}>{c.label}</span>
                    <span className={styles.curHint}>{c.shortHint}</span>
                    {spend[c.key] > 0 && <span className={styles.curCount}>×{spend[c.key]}</span>}
                  </button>
                );
              })}
            </div>

            <div className={styles.totalsRow}>
              <span className={styles.totalLabel}>Currency used</span>
              <span className={styles.totalValue}>{totalSpend}</span>
            </div>

            <div className={styles.actionsRow}>
              <button className={styles.secondaryBtn} onClick={handleScour} disabled={item.corrupted || (item.prefixes.length + item.suffixes.length === 0)}>
                Scour
              </button>
              <button className={styles.secondaryBtn} onClick={handleReset}>
                Reset (base + counters)
              </button>
            </div>

            {history.length > 0 && (
              <>
                <div className={styles.sectionTitle}>Recent actions</div>
                <ol className={styles.history}>
                  {history.map((h, i) => (
                    <li key={i} className={styles.historyItem}>{h}</li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
