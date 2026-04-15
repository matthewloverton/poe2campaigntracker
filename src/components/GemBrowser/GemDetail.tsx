import { useState } from "react";
import type { GemEntry } from "../../types/itemDatabase";
import {
  GEM_COLOR_CSS,
  GEM_TYPE_LABELS,
  gemUnlockLevel,
  resolveQualityStat,
} from "../../types/itemDatabase";
import { cleanModText } from "../../data/mods";
import styles from "./GemDetail.module.css";

interface GemDetailProps {
  gem: GemEntry;
  onClose: () => void;
  onAddToBuild?: (gem: GemEntry) => void;
  addLabel?: string;
}

export function GemDetail({ gem, onClose, onAddToBuild, addLabel }: GemDetailProps) {
  const colorVar = GEM_COLOR_CSS[gem.color] ?? GEM_COLOR_CSS.w;
  const sd = gem.skillDetail;
  const isSupport = gem.gemType === "support";
  const maxLevel = sd?.maxLevel ?? 20;
  const [level, setLevel] = useState(maxLevel > 20 ? 20 : maxLevel);
  const [quality, setQuality] = useState(20);
  const [activeSetIdx, setActiveSetIdx] = useState(0);

  // Top-level data (doesn't change with tabs)
  const topLevel = sd?.levels?.[String(level)];
  // Active stat set's data (changes with tabs)
  const activeSet = sd?.statSets?.[activeSetIdx];
  const activeSetLevel = activeSet?.levels?.[String(level)];
  const activeStaticText = activeSet?.staticStatText ?? sd?.staticStatText ?? [];
  const topQualityStats = sd?.qualityStats ?? [];

  const unlockLvl = gemUnlockLevel(gem.craftingLevel, gem.gemType);

  // Cost always from top-level (same across all tabs)
  const costStr = topLevel?.costs
    ? Object.entries(topLevel.costs)
        .map(([resource, amount]) => `${amount} ${resource}`)
        .join(", ")
    : null;

  const cooldownStr =
    sd?.cooldown != null
      ? `${(sd.cooldown / 1000).toFixed(2)}s${sd.storedUses ? ` (${sd.storedUses} Uses)` : ""}`
      : null;

  const attackSpeedStr =
    sd?.attackSpeedMultiplier != null
      ? `${100 + sd.attackSpeedMultiplier}% of Base`
      : null;

  // Damage from active tab (changes per stat set)
  const activeDamage = activeSetLevel?.damageMultiplier ?? topLevel?.damageMultiplier;
  const damageStr = activeDamage != null ? `${activeDamage}%` : null;

  const reqParts: string[] = [];
  if (gem.requirementWeights.strength > 0) reqParts.push("Str");
  if (gem.requirementWeights.dexterity > 0) reqParts.push("Dex");
  if (gem.requirementWeights.intelligence > 0) reqParts.push("Int");

  const resolvedQuality = topQualityStats.map((qs) => resolveQualityStat(qs, quality)).filter(Boolean);

  return (
    <div className={styles.panel}>
      <button className={styles.closeBtn} onClick={onClose} type="button">
        &times;
      </button>

      {/* Header */}
      <div className={styles.header}>
        <span className={styles.name} style={{ color: colorVar }}>
          {gem.name}
        </span>
        <span className={styles.typeLabel}>
          {GEM_TYPE_LABELS[gem.gemType] ?? gem.gemType}
        </span>
      </div>

      {isSupport ? (
        /* ── Support gem layout ──────────────────────────────── */
        <>
          {reqParts.length > 0 && (
            <div className={styles.supportReqs}>
              Support Requirements: {reqParts.join(", ")}
            </div>
          )}

          {(gem.supportText || sd?.description) && (
            <div className={styles.description}>
              {cleanModText(gem.supportText || sd?.description || "")}
            </div>
          )}

          {sd?.staticStatText && sd.staticStatText.length > 0 && (
            <div className={styles.statTextBlock}>
              {sd.staticStatText.map((text, i) => (
                <div key={i} className={styles.statTextLine}>{text}</div>
              ))}
            </div>
          )}

          <div className={styles.unlockLine}>
            Unlocks: Level {unlockLvl}
          </div>

          {resolvedQuality.length > 0 && (
            <div className={styles.qualitySection}>
              <div className={styles.qualityHeader}>
                Additional effects from {quality}% quality:
              </div>
              {resolvedQuality.map((text, i) => (
                <div key={i} className={styles.qualityLine}>{text}</div>
              ))}
              <div className={styles.qualitySlider}>
                <input
                  type="range"
                  className={styles.slider}
                  min={0}
                  max={20}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                />
                <span className={styles.sliderValue}>{quality}%</span>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── Active/Spirit gem layout ────────────────────────── */
        <>
          {gem.tags.length > 0 && (
            <div className={styles.tagsLine}>
              {gem.tags
                .filter((t) => !t.startsWith("grants_") && t !== "strength" && t !== "dexterity" && t !== "intelligence")
                .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
                .join(", ")}
            </div>
          )}

          <div className={styles.statsBlock}>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Level</span>
              <span className={styles.statValue}>{level}</span>
            </div>
            {costStr && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Cost</span>
                <span className={styles.statValue}>{costStr}</span>
              </div>
            )}
            {cooldownStr && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Cooldown Time</span>
                <span className={styles.statValue}>{cooldownStr}</span>
              </div>
            )}
            {attackSpeedStr && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Attack Speed</span>
                <span className={styles.statValue}>{attackSpeedStr}</span>
              </div>
            )}
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Unlocks</span>
              <span className={styles.statValue}>Level {unlockLvl}</span>
            </div>
          </div>

          {sd?.description && (
            <div className={styles.description}>{sd.description}</div>
          )}

          {/* Stat set tabs (when multiple, e.g. Permafrost Bolts / Ammunition) */}
          {sd?.statSets && sd.statSets.length > 1 && (
            <div className={styles.statSetTabs}>
              {sd.statSets.map((ss, i) => (
                <button
                  key={i}
                  className={`${styles.statSetTab} ${activeSetIdx === i ? styles.statSetTabActive : ""}`}
                  onClick={() => setActiveSetIdx(i)}
                  type="button"
                >
                  {ss.name}
                </button>
              ))}
            </div>
          )}

          {damageStr && (
            <div className={styles.statRow}>
              <span className={styles.statLabel}>Attack Damage</span>
              <span className={styles.statValue}>{damageStr}</span>
            </div>
          )}

          {activeStaticText.length > 0 && (
            <div className={styles.statTextBlock}>
              {activeStaticText.map((text, i) => (
                <div key={i} className={styles.statTextLine}>{text}</div>
              ))}
            </div>
          )}

          {(activeSetLevel?.statText ?? topLevel?.statText)?.length ? (
            <div className={styles.statTextBlock}>
              {(activeSetLevel?.statText ?? topLevel?.statText ?? []).map((text, i) => (
                <div key={i} className={styles.statTextLine}>{text}</div>
              ))}
            </div>
          ) : null}

          {resolvedQuality.length > 0 && (
            <div className={styles.qualitySection}>
              <div className={styles.qualityHeader}>
                Additional effects from {quality}% quality:
              </div>
              {resolvedQuality.map((text, i) => (
                <div key={i} className={styles.qualityLine}>{text}</div>
              ))}
              <div className={styles.qualitySlider}>
                <input
                  type="range"
                  className={styles.slider}
                  min={0}
                  max={20}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                />
                <span className={styles.sliderValue}>{quality}%</span>
              </div>
            </div>
          )}

          {sd && maxLevel > 1 && (
            <div className={styles.sliderSection}>
              <label className={styles.sliderLabel}>
                Level {level} / {maxLevel}
              </label>
              <input
                className={styles.slider}
                type="range"
                min={1}
                max={maxLevel}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
              />
            </div>
          )}
        </>
      )}

      {onAddToBuild && (
        <button
          className={styles.addBtn}
          type="button"
          onClick={() => onAddToBuild(gem)}
        >
          {addLabel ?? "Add to Build"}
        </button>
      )}
    </div>
  );
}
