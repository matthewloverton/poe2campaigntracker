import { useState } from "react";
import { searchGems } from "../../data/gems";
import type { GemEntry } from "../../types/itemDatabase";
import { GEM_TYPE_LABELS, GEM_COLOR_CSS } from "../../types/itemDatabase";
import styles from "./BuildPlan.module.css";

type GemTypeFilter = "All" | "active" | "support" | "spirit";

const FILTER_LABELS: Record<GemTypeFilter, string> = {
  All: "All",
  active: "Skill",
  support: "Support",
  spirit: "Spirit",
};

interface GemSearchProps {
  onSelect: (gem: GemEntry) => void;
  onClose: () => void;
  defaultCategory?: GemTypeFilter;
}

export function GemSearch({ onSelect, onClose, defaultCategory }: GemSearchProps) {
  const [query, setQuery] = useState("");
  const [gemType, setGemType] = useState<GemTypeFilter>(defaultCategory ?? "All");

  const results = searchGems(
    query,
    gemType === "All" ? undefined : { gemType },
  ).slice(0, 20);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div className={styles.gsOverlay} onClick={handleOverlayClick}>
      <div className={styles.gsModal}>
        <div className={styles.gsModalHeader}>
          <span className={styles.gsModalTitle}>Add Gem</span>
          <button className={styles.gsCloseBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.gsSearchRow}>
          <input
            className={styles.gsSearchInput}
            type="text"
            placeholder="Search gems…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <select
            className={styles.gsCategorySelect}
            value={gemType}
            onChange={(e) => setGemType(e.target.value as GemTypeFilter)}
          >
            {(["All", "active", "support", "spirit"] as GemTypeFilter[]).map((c) => (
              <option key={c} value={c}>{FILTER_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div className={styles.gsResultsList}>
          {results.length === 0 ? (
            <div className={styles.gsNoResults}>No gems found</div>
          ) : (
            results.map((gem) => {
              const badgeClass = gem.gemType === "active" ? "skill" : gem.gemType;
              return (
                <button
                  key={`${gem.gemType}-${gem.name}`}
                  className={styles.gsResultRow}
                  onClick={() => onSelect(gem)}
                >
                  <img
                    src={`/assets/${gem.iconPath}`}
                    alt=""
                    width={20}
                    height={20}
                    style={{
                      borderRadius: gem.gemType === "support" ? "50%" : 3,
                      border: `1.5px solid ${GEM_COLOR_CSS[gem.color]}`,
                      objectFit: "contain",
                      flexShrink: 0,
                    }}
                  />
                  <span className={styles.gsGemName}>{gem.name}</span>
                  <span className={`${styles.gsCategoryBadge} ${styles[`gsCat_${badgeClass}`]}`}>
                    {GEM_TYPE_LABELS[gem.gemType]}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
