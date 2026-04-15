import type { BuildGemEntry } from "../../types/buildPlan";
import { gemById } from "../../data/gems";
import { cleanModText } from "../../data/mods";
import styles from "./GemTooltip.module.css";

interface GemTooltipProps {
  gem: BuildGemEntry;
}

export function GemTooltip({ gem }: GemTooltipProps) {
  const gemData = gem.gemId ? gemById.get(gem.gemId) : undefined;

  const craftingLevel = gem.craftingLevel ?? gemData?.craftingLevel;
  const supportText = gemData?.supportText;

  return (
    <div className={styles.tooltip}>
      <div className={styles.name}>{gem.name}</div>

      {craftingLevel != null && (
        <div className={styles.level}>
          Crafting Level:{" "}
          <span className={styles.levelValue}>{craftingLevel}</span>
        </div>
      )}

      {supportText && (
        <div className={styles.supportText}>{cleanModText(supportText)}</div>
      )}
    </div>
  );
}
