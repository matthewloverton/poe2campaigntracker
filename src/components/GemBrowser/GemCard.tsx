import type { GemEntry } from "../../types/itemDatabase";
import { GEM_COLOR_CSS } from "../../types/itemDatabase";
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

  const frameBorder = `2px solid ${colorVar}`;
  const spiritShadow =
    gem.gemType === "spirit" ? `0 0 6px ${colorVar}` : undefined;

  return (
    <button
      className={`${styles.card} ${selected ? styles.cardSelected : ""}`}
      onClick={onClick}
      type="button"
    >
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
      <span className={styles.name}>{gem.name}</span>
    </button>
  );
}
