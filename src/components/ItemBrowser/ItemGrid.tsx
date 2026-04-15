import { useState, useCallback } from "react";
import type { BaseItem } from "../../types/itemDatabase";
import { useCustomizationsStore } from "../../store/customizationsStore";
import type { WatchlistEntry } from "../../types";
import styles from "./ItemGrid.module.css";

interface ItemGridProps {
  items: BaseItem[];
  selectedItemId: string | null;
  onSelectItem: (item: BaseItem) => void;
}

function formatDamage(item: BaseItem): string | null {
  const p = item.properties;
  if (p.physicalDamageMin != null && p.physicalDamageMax != null) {
    return `${p.physicalDamageMin}-${p.physicalDamageMax}`;
  }
  return null;
}

function formatDefences(item: BaseItem): string[] {
  const out: string[] = [];
  if (item.properties.armour) {
    const a = item.properties.armour;
    out.push(`${a.min === a.max ? a.min : `${a.min}-${a.max}`} AR`);
  }
  if (item.properties.evasion) {
    const e = item.properties.evasion;
    out.push(`${e.min === e.max ? e.min : `${e.min}-${e.max}`} EV`);
  }
  if (item.properties.energyShield) {
    const es = item.properties.energyShield;
    out.push(`${es.min === es.max ? es.min : `${es.min}-${es.max}`} ES`);
  }
  return out;
}

function formatRequirements(item: BaseItem): string {
  const parts: string[] = [];
  if (item.requirements.strength > 0)
    parts.push(`${item.requirements.strength} Str`);
  if (item.requirements.dexterity > 0)
    parts.push(`${item.requirements.dexterity} Dex`);
  if (item.requirements.intelligence > 0)
    parts.push(`${item.requirements.intelligence} Int`);
  return parts.join(", ");
}

export function ItemGrid({ items, selectedItemId, onSelectItem }: ItemGridProps) {
  const [iconErrors, setIconErrors] = useState<Set<string>>(new Set());
  const watchlist = useCustomizationsStore((s) => s.watchlist ?? []);
  const addToWatchlist = useCustomizationsStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useCustomizationsStore((s) => s.removeFromWatchlist);
  const watchedIds = new Set(watchlist.map((w) => w.id));

  const toggleWatch = useCallback((item: BaseItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (watchedIds.has(item.id)) {
      removeFromWatchlist(item.id);
    } else {
      const entry: WatchlistEntry = {
        id: item.id,
        name: item.name,
        type: "item",
        iconPath: item.iconPath,
        unlockLevel: item.requirements.level,
      };
      addToWatchlist(entry);
    }
  }, [watchedIds, addToWatchlist, removeFromWatchlist]);

  function handleIconError(id: string) {
    setIconErrors((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  if (items.length === 0) {
    return <div className={styles.empty}>No items in this category</div>;
  }

  return (
    <div className={styles.grid}>
      {items.map((item) => {
        const damage = formatDamage(item);
        const defences = formatDefences(item);
        const reqs = formatRequirements(item);
        const isSelected = selectedItemId === item.id;

        return (
          <button
            key={item.id}
            className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
            onClick={() => onSelectItem(item)}
          >
            {/* Icon area with level badge and watch toggle */}
            <div className={styles.iconArea}>
              <span className={styles.levelBadge}>Lvl {item.dropLevel}</span>
              <span
                className={`${styles.watchBtn} ${watchedIds.has(item.id) ? styles.watchBtnActive : ""}`}
                onClick={(e) => toggleWatch(item, e)}
                title={watchedIds.has(item.id) ? "Stop tracking" : "Track for level-up alerts"}
              >
                {watchedIds.has(item.id) ? "\u{1F441}" : "\u{1F441}"}
              </span>
              <div className={styles.iconWrap}>
                {!iconErrors.has(item.id) && item.iconPath ? (
                  <img
                    className={styles.icon}
                    src={`/assets/${item.iconPath}`}
                    alt={item.name}
                    loading="lazy"
                    onError={() => handleIconError(item.id)}
                  />
                ) : (
                  <div className={styles.iconFallback}>?</div>
                )}
              </div>
            </div>

            {/* Name */}
            <div className={styles.name}>{item.name}</div>

            {/* Stat line */}
            {damage && <div className={styles.stat}>{damage} dmg</div>}
            {defences.length > 0 && (
              <div className={styles.stat}>{defences.join(" / ")}</div>
            )}

            {/* Implicit mods */}
            {item.implicits.length > 0 && (
              <div className={styles.implicit}>{item.implicits[0]}</div>
            )}

            {/* Requirements */}
            {reqs && <div className={styles.reqs}>{reqs}</div>}
          </button>
        );
      })}
    </div>
  );
}
