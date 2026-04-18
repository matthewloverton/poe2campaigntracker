import { useGuideStore } from "../../store/guideStore";
import { useLevelStore } from "../../store/levelStore";
import { areaById } from "../../data/areas";
import styles from "./LevelIndicator.module.css";

function getLevelColor(charLevel: number, zoneMin: number, zoneMax: number): string {
  if (charLevel === 0) return "var(--text-secondary)";
  const avg = (zoneMin + zoneMax) / 2;
  const diff = Math.abs(charLevel - avg);
  if (diff <= 1) return "var(--color-green)";
  if (diff <= 2) return "var(--color-yellow)";
  return "var(--color-red)";
}

export function LevelIndicator() {
  const charLevel = useLevelStore((s) => s.level);
  const characterName = useLevelStore((s) => s.characterName);
  const currentPage = useGuideStore((s) => s.pages[s.currentPageIndex]);

  const area = currentPage ? areaById.get(currentPage.targetAreaId) : null;
  const rec = area?.recommendation;

  const levelColor = rec ? getLevelColor(charLevel, rec.min, rec.max) : "var(--text-secondary)";

  return (
    <div className={styles.indicator}>
      {charLevel > 0 ? (
        <span className={styles.level} style={{ color: levelColor }}>
          Lv {charLevel}
        </span>
      ) : (
        <span className={styles.level} style={{ color: "var(--text-secondary)" }}>
          Lv —
        </span>
      )}
      {characterName && (
        <span className={styles.charName}>{characterName}</span>
      )}
    </div>
  );
}
