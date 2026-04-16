import { useState, useCallback, useMemo } from "react";
import type { BuildGearEntry, GearSlotKey } from "../../types/buildPlan";
import { GEAR_SLOT_LABELS } from "../../types/buildPlan";
import { itemById } from "../../data/items";
import { modById, cleanModText } from "../../data/mods";
import {
  augmentById,
  getAugmentEffect,
  getAugmentBonded,
  itemClassToAugmentCategory,
} from "../../data/augments";
import type { ItemMod } from "../../types/itemDatabase";
import { encodeItem } from "../../lib/pob/encodeItem";
import styles from "./GearSlot.module.css";

interface GearSlotProps {
  slotKey: GearSlotKey;
  entry: BuildGearEntry | null;
  onClick: () => void;
  onRemove: () => void;
}

/** Replace (min-max) ranges with resolved roll values */
function resolveModRoll(mod: ItemMod, pct?: number): string {
  const text = cleanModText(mod.text);
  return text.replace(/\((-?\d+)[–—-](-?\d+)\)/g, (_m, a, b) => {
    const min = Number(a), max = Number(b);
    if (pct != null) return String(Math.round(min + (max - min) * pct / 100));
    return String(Math.round((min + max) / 2));
  });
}

/** Parse augment effect text for % increased values */
function parseAugmentInc(texts: string[]) {
  let incPhysDmg = 0, incArmour = 0, incEvasion = 0, incES = 0;
  for (const t of texts) {
    const m = t.match(/(\d+)%\s+increased\s+(.+)/i);
    if (!m) continue;
    const val = Number(m[1]);
    const what = m[2].toLowerCase();
    if (what.includes("physical damage")) incPhysDmg += val;
    if (what.includes("armour") || what.includes("armor")) incArmour += val;
    if (what.includes("evasion")) incEvasion += val;
    if (what.includes("energy shield")) incES += val;
  }
  return { incPhysDmg, incArmour, incEvasion, incES };
}

export function GearSlot({ slotKey, entry, onClick, onRemove }: GearSlotProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleMouseEnter = useCallback(() => setShowTooltip(true), []);
  const handleMouseLeave = useCallback(() => setShowTooltip(false), []);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!entry) return;
    const text = encodeItem(entry);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for environments without clipboard permission
      window.prompt("Copy this into PoB:", text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 600);
  }, [entry]);

  const label = GEAR_SLOT_LABELS[slotKey] ?? slotKey;
  const isUnique = !!entry?.uniqueId;
  const baseItem = entry?.baseItemId ? itemById.get(entry.baseItemId) : undefined;

  // Resolve mods from IDs with roll values
  const resolvedMods = useMemo(() => {
    if (!entry?.desiredModIds || entry.desiredModIds.length === 0) return null;
    return entry.desiredModIds
      .map((id) => {
        const mod = modById.get(id);
        if (!mod) return null;
        const pct = entry.modRolls?.[id];
        return { mod, text: resolveModRoll(mod, pct) };
      })
      .filter(Boolean) as { mod: ItemMod; text: string }[];
  }, [entry?.desiredModIds, entry?.modRolls]);

  // Resolve augments
  const augments = useMemo(() => {
    if (!entry?.augmentIds) return [];
    return entry.augmentIds
      .map((id) => (id ? augmentById.get(id) ?? null : null));
  }, [entry?.augmentIds]);

  // Calculate modified stats
  const modifiedStats = useMemo(() => {
    if (!baseItem) return null;
    const p = baseItem.properties;
    const quality = entry?.quality ?? 0;
    const isWeapon = p.physicalDamageMin != null && p.physicalDamageMax != null;
    const hasDefences = p.armour != null || p.evasion != null || p.energyShield != null;
    if (!isWeapon && !hasDefences) return null;

    // Sum from craft mods
    const mods = (entry?.desiredModIds ?? [])
      .map((id) => modById.get(id))
      .filter(Boolean) as ItemMod[];

    function rollValue(mod: ItemMod, s: { min: number; max: number }): number {
      const pct = entry?.modRolls?.[mod.id];
      if (pct != null) return Math.round(s.min + (s.max - s.min) * pct / 100);
      return Math.round((s.min + s.max) / 2);
    }
    function sumStat(statId: string): number {
      let total = 0;
      for (const mod of mods) {
        for (const s of mod.stats) {
          if (s.id === statId) total += rollValue(mod, s);
        }
      }
      return total;
    }

    // Sum from augments
    const augCategory = itemClassToAugmentCategory(baseItem.itemClass);
    let augTexts: string[] = [];
    if (augCategory) {
      for (const aug of augments) {
        if (aug) augTexts.push(...getAugmentEffect(aug, augCategory));
      }
    }
    const augBonuses = parseAugmentInc(augTexts);

    const result: {
      physMin?: number; physMax?: number;
      armour?: number; evasion?: number; energyShield?: number;
      aps?: number;
    } = {};

    if (isWeapon && p.physicalDamageMin != null && p.physicalDamageMax != null) {
      const flatMin = sumStat("local_minimum_added_physical_damage");
      const flatMax = sumStat("local_maximum_added_physical_damage");
      const incPhys = sumStat("local_physical_damage_+%") + augBonuses.incPhysDmg;
      const qualMult = 1 + quality / 100;
      result.physMin = Math.round((p.physicalDamageMin + flatMin) * (1 + incPhys / 100) * qualMult);
      result.physMax = Math.round((p.physicalDamageMax + flatMax) * (1 + incPhys / 100) * qualMult);
      if (p.attackTime != null) {
        const incSpeed = sumStat("local_attack_speed_+%");
        result.aps = 1000 / (p.attackTime / (1 + incSpeed / 100));
      }
    }

    if (hasDefences) {
      const incAr = sumStat("local_physical_damage_reduction_rating_+%")
        + sumStat("local_armour_and_evasion_+%")
        + sumStat("local_armour_and_energy_shield_+%")
        + sumStat("local_armour_and_evasion_and_energy_shield_+%")
        + augBonuses.incArmour;
      const incEv = sumStat("local_evasion_rating_+%")
        + sumStat("local_armour_and_evasion_+%")
        + sumStat("local_evasion_and_energy_shield_+%")
        + sumStat("local_armour_and_evasion_and_energy_shield_+%")
        + augBonuses.incEvasion;
      const incEs = sumStat("local_energy_shield_+%")
        + sumStat("local_armour_and_energy_shield_+%")
        + sumStat("local_evasion_and_energy_shield_+%")
        + sumStat("local_armour_and_evasion_and_energy_shield_+%")
        + augBonuses.incES;
      const flatAr = sumStat("local_base_physical_damage_reduction_rating");
      const flatEv = sumStat("local_base_evasion_rating");
      const flatEs = sumStat("local_energy_shield");
      const qualMult = 1 + quality / 100;

      if (p.armour) {
        const base = (p.armour.min + p.armour.max) / 2;
        result.armour = Math.round((base + flatAr) * (1 + incAr / 100) * qualMult);
      }
      if (p.evasion) {
        const base = (p.evasion.min + p.evasion.max) / 2;
        result.evasion = Math.round((base + flatEv) * (1 + incEv / 100) * qualMult);
      }
      if (p.energyShield) {
        const base = (p.energyShield.min + p.energyShield.max) / 2;
        result.energyShield = Math.round((base + flatEs) * (1 + incEs / 100) * qualMult);
      }
    }

    return result;
  }, [baseItem, entry, augments]);

  // Check if we have any modifications worth showing
  const hasModifications = (entry?.quality ?? 0) > 0
    || (resolvedMods && resolvedMods.length > 0)
    || augments.some(Boolean);

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

  // Build stat lines — base + modified in parens
  const statLines: { label: string; value: string; modified?: string }[] = [];
  if (baseItem) {
    const p = baseItem.properties;
    if (p.physicalDamageMin != null && p.physicalDamageMax != null) {
      statLines.push({
        label: "Damage",
        value: `${p.physicalDamageMin}-${p.physicalDamageMax}`,
        modified: modifiedStats?.physMin != null
          ? `${modifiedStats.physMin}-${modifiedStats.physMax}`
          : undefined,
      });
    }
    if (p.attackTime != null) {
      const aps = (1000 / p.attackTime).toFixed(2);
      statLines.push({
        label: "APS",
        value: aps,
        modified: modifiedStats?.aps != null ? modifiedStats.aps.toFixed(2) : undefined,
      });
    }
    if (p.criticalStrikeChance != null) {
      statLines.push({
        label: "Crit",
        value: `${(p.criticalStrikeChance / 100).toFixed(2)}%`,
      });
    }
    if (p.armour) {
      const base = p.armour.min === p.armour.max ? `${p.armour.min}` : `${p.armour.min}-${p.armour.max}`;
      statLines.push({
        label: "Armour",
        value: base,
        modified: modifiedStats?.armour != null ? `${modifiedStats.armour}` : undefined,
      });
    }
    if (p.evasion) {
      const base = p.evasion.min === p.evasion.max ? `${p.evasion.min}` : `${p.evasion.min}-${p.evasion.max}`;
      statLines.push({
        label: "Evasion",
        value: base,
        modified: modifiedStats?.evasion != null ? `${modifiedStats.evasion}` : undefined,
      });
    }
    if (p.energyShield) {
      const base = p.energyShield.min === p.energyShield.max ? `${p.energyShield.min}` : `${p.energyShield.min}-${p.energyShield.max}`;
      statLines.push({
        label: "ES",
        value: base,
        modified: modifiedStats?.energyShield != null ? `${modifiedStats.energyShield}` : undefined,
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

  // Augment category for effect text
  const augCategory = baseItem ? itemClassToAugmentCategory(baseItem.itemClass) : null;

  // Use resolved mod text if available, fallback to raw desiredMods
  const displayMods = resolvedMods
    ? resolvedMods.map((r) => r.text)
    : entry.desiredMods;

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

      <button
        className={styles.copyBtn}
        onClick={handleCopy}
        title="Copy item for Path of Building"
        aria-label="Copy item for Path of Building"
      >
        {copied ? "✓" : "⧉"}
      </button>

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
                  {hasModifications && s.modified && s.modified !== s.value && (
                    <span className={styles.tooltipModifiedValue}> ({s.modified})</span>
                  )}
                </div>
              ))}
              {hasModifications && (entry.quality ?? 0) > 0 && (
                <div className={styles.tooltipQuality}>
                  Quality: {entry.quality}%
                </div>
              )}
            </div>
          )}

          {reqs.length > 0 && (
            <div className={styles.tooltipReqs}>
              <span className={styles.tooltipReqLabel}>Requires:</span>
              {reqs.join(", ")}
            </div>
          )}

          {displayMods.length > 0 && (
            <ul className={styles.tooltipMods}>
              {displayMods.map((mod, i) => (
                <li key={i} className={isUnique ? styles.tooltipModUnique : styles.tooltipMod}>
                  {cleanModText(mod)}
                </li>
              ))}
            </ul>
          )}

          {/* Augment sockets */}
          {augments.some(Boolean) && augCategory && (
            <div className={styles.tooltipAugments}>
              {augments.map((aug, i) => aug && (
                <div key={i} className={styles.tooltipAugment}>
                  {aug.iconPath && (
                    <img
                      className={styles.tooltipAugIcon}
                      src={`/assets/${aug.iconPath}`}
                      alt=""
                    />
                  )}
                  <div className={styles.tooltipAugInfo}>
                    <span className={styles.tooltipAugName}>{aug.name}</span>
                    {getAugmentEffect(aug, augCategory).map((t, j) => (
                      <span key={j} className={styles.tooltipAugEffect}>{t}</span>
                    ))}
                    {getAugmentBonded(aug, augCategory).map((t, j) => (
                      <span key={`b${j}`} className={styles.tooltipAugBonded}>{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
