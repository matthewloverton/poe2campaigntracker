import { useState, useCallback } from "react";
import type { BuildGearEntry, GearSlotKey } from "../../types/buildPlan";
import { GEAR_SLOT_LABELS } from "../../types/buildPlan";
import { itemById } from "../../data/items";
import { cleanModText } from "../../data/mods";
import styles from "./GearSlot.module.css";

interface GearSlotProps {
  slotKey: GearSlotKey;
  entry: BuildGearEntry | null;
  onClick: () => void;
  onRemove: () => void;
}

export function GearSlot({ slotKey, entry, onClick, onRemove }: GearSlotProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleMouseEnter = useCallback(() => setShowTooltip(true), []);
  const handleMouseLeave = useCallback(() => setShowTooltip(false), []);

  const label = GEAR_SLOT_LABELS[slotKey] ?? slotKey;
  const isUnique = !!entry?.uniqueId;
  const baseItem = entry?.baseItemId ? itemById.get(entry.baseItemId) : undefined;

  if (!entry) {
    return (
      <div
        className={`${styles.slot} ${styles.slotEmpty}`}
        onClick={onClick}
        title={`Set ${label}`}
      >
        <span className={styles.emptyLabel}>{label}</span>
      </div>
    );
  }

  const iconSrc = entry.iconPath
    ? `/assets/${entry.iconPath}`
    : baseItem?.iconPath
      ? `/assets/${baseItem.iconPath}`
      : undefined;

  // Build stat lines for weapons
  const statLines: { label: string; value: string }[] = [];
  if (baseItem) {
    const p = baseItem.properties;
    if (p.physicalDamageMin != null && p.physicalDamageMax != null) {
      statLines.push({
        label: "Damage",
        value: `${p.physicalDamageMin}-${p.physicalDamageMax}`,
      });
    }
    if (p.attackTime != null) {
      const aps = (1000 / p.attackTime).toFixed(2);
      statLines.push({ label: "APS", value: aps });
    }
    if (p.criticalStrikeChance != null) {
      statLines.push({
        label: "Crit",
        value: `${(p.criticalStrikeChance / 100).toFixed(2)}%`,
      });
    }
    if (p.armour) {
      statLines.push({
        label: "Armour",
        value: p.armour.min === p.armour.max
          ? `${p.armour.min}`
          : `${p.armour.min}-${p.armour.max}`,
      });
    }
    if (p.evasion) {
      statLines.push({
        label: "Evasion",
        value: p.evasion.min === p.evasion.max
          ? `${p.evasion.min}`
          : `${p.evasion.min}-${p.evasion.max}`,
      });
    }
    if (p.energyShield) {
      statLines.push({
        label: "ES",
        value: p.energyShield.min === p.energyShield.max
          ? `${p.energyShield.min}`
          : `${p.energyShield.min}-${p.energyShield.max}`,
      });
    }
  }

  // Requirements
  const reqs: string[] = [];
  if (baseItem) {
    const r = baseItem.requirements;
    if (r.level) reqs.push(`Lvl ${r.level}`);
    if (r.strength) reqs.push(`${r.strength} Str`);
    if (r.dexterity) reqs.push(`${r.dexterity} Dex`);
    if (r.intelligence) reqs.push(`${r.intelligence} Int`);
  }

  return (
    <div
      className={`${styles.slot} ${styles.slotFilled} ${isUnique ? styles.slotUnique : ""}`}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {iconSrc ? (
        <img className={styles.itemImage} src={iconSrc} alt={entry.base} />
      ) : (
        <span className={styles.emptyLabel}>{entry.base || label}</span>
      )}

      {entry.priority != null && entry.priority > 0 && (
        <span className={styles.priorityBadge}>{entry.priority}</span>
      )}

      {showTooltip && (
        <div
          className={styles.tooltip}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className={isUnique ? styles.tooltipNameUnique : styles.tooltipName}>
            {baseItem?.name ?? entry.base}
          </div>
          {baseItem && (
            <div className={styles.tooltipClass}>{baseItem.itemClass}</div>
          )}

          {statLines.length > 0 && (
            <div className={styles.tooltipStats}>
              {statLines.map((s) => (
                <div key={s.label} className={styles.tooltipStat}>
                  <span className={styles.tooltipStatLabel}>{s.label}:</span>
                  {s.value}
                </div>
              ))}
            </div>
          )}

          {reqs.length > 0 && (
            <div className={styles.tooltipReqs}>
              <span className={styles.tooltipReqLabel}>Requires:</span>
              {reqs.join(", ")}
            </div>
          )}

          {entry.desiredMods.length > 0 && (
            <ul className={styles.tooltipMods}>
              {entry.desiredMods.map((mod, i) => (
                <li key={i} className={isUnique ? styles.tooltipModUnique : styles.tooltipMod}>
                  {cleanModText(mod)}
                </li>
              ))}
            </ul>
          )}

          {entry.notes && (
            <div className={styles.tooltipNotes}>{entry.notes}</div>
          )}

          <button
            className={styles.tooltipRemoveBtn}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
