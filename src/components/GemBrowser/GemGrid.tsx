import { useMemo } from "react";
import type { GemEntry } from "../../types/itemDatabase";
import { getGemsByTier } from "../../data/gems";
import { gemUnlockLevel } from "../../types/itemDatabase";
import { GemCard } from "./GemCard";
import styles from "./GemGrid.module.css";

function tierLabel(tier: number, gems: GemEntry[]): string {
  if (tier === 0) return "Tier 0";
  // Use the first gem's type to determine drop level
  // (mixed tiers rare, but default to active)
  const gemType = gems[0]?.gemType ?? "active";
  const dropLvl = gemUnlockLevel(tier, gemType);
  return `Tier ${tier} — Lvl ${dropLvl}+`;
}

interface GemGridProps {
  gems: GemEntry[];
  selectedGemId: string | null;
  onSelectGem: (gem: GemEntry, e: React.MouseEvent) => void;
}

export function GemGrid({ gems, selectedGemId, onSelectGem }: GemGridProps) {
  const tierMap = useMemo(() => getGemsByTier(gems), [gems]);

  const sortedTiers = useMemo(
    () => Array.from(tierMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([tier, tierGems]) => [
        tier,
        [...tierGems].sort((a, b) => a.craftingLevel - b.craftingLevel || a.name.localeCompare(b.name)),
      ] as [number, GemEntry[]]),
    [tierMap]
  );

  if (gems.length === 0) {
    return <div className={styles.empty}>No gems match the current filters</div>;
  }

  return (
    <div className={styles.container}>
      {sortedTiers.map(([tier, tierGems]) => (
        <div key={tier} className={styles.tierSection}>
          <div className={styles.tierHeader}>
            {tierLabel(tier, tierGems)}
          </div>
          <div className={styles.tierGrid}>
            {tierGems.map((gem) => (
              <GemCard
                key={gem.id}
                gem={gem}
                selected={gem.id === selectedGemId}
                onClick={(e) => onSelectGem(gem, e)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
