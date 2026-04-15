import { useCallback } from "react";
import type { GemEntry } from "../../types/itemDatabase";
import { GEM_COLOR_CSS, gemUnlockLevel } from "../../types/itemDatabase";
import { useCustomizationsStore } from "../../store/customizationsStore";
import type { WatchlistEntry } from "../../types";
import styles from "./GemCard.module.css";

interface GemCardProps {
  gem: GemEntry;
  selected?: boolean;
  onClick: (e: React.MouseEvent) => void;
}

const FRAME_CLASS: Record<string, string> = {
  active: styles.iconFrameActive,
  support: styles.iconFrameSupport,
  spirit: styles.iconFrameSpirit,
};

export function GemCard({ gem, selected, onClick }: GemCardProps) {
  const colorVar = GEM_COLOR_CSS[gem.color] ?? GEM_COLOR_CSS.w;
  const watchlist = useCustomizationsStore((s) => s.watchlist ?? []);
  const addToWatchlist = useCustomizationsStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useCustomizationsStore((s) => s.removeFromWatchlist);
  const isWatched = watchlist.some((w) => w.id === gem.id);

  const toggleWatch = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isWatched) {
      removeFromWatchlist(gem.id);
    } else {
      const entry: WatchlistEntry = {
        id: gem.id,
        name: gem.name,
        type: "gem",
        iconPath: gem.iconPath,
        unlockLevel: gemUnlockLevel(gem.craftingLevel, gem.gemType),
      };
      addToWatchlist(entry);
    }
  }, [isWatched, gem, addToWatchlist, removeFromWatchlist]);

  const frameBorder = `2px solid ${colorVar}`;
  const spiritShadow =
    gem.gemType === "spirit" ? `0 0 6px ${colorVar}` : undefined;

  return (
    <button
      className={`${styles.card} ${selected ? styles.cardSelected : ""}`}
      onClick={onClick}
      type="button"
    >
      <div className={styles.cardInner}>
        <div
          className={`${styles.iconFrame} ${FRAME_CLASS[gem.gemType] ?? styles.iconFrameActive}`}
          style={{
            border: frameBorder,
            boxShadow: spiritShadow,
          }}
        >
          <img
            className={styles.icon}
            src={`/assets/${gem.iconPath}`}
            alt={gem.name}
            loading="lazy"
          />
        </div>
        <span
          className={`${styles.watchBtn} ${isWatched ? styles.watchBtnActive : ""}`}
          onClick={toggleWatch}
          title={isWatched ? "Stop tracking" : "Track for level-up alerts"}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </span>
      </div>
      <span className={styles.name}>{gem.name}</span>
    </button>
  );
}
