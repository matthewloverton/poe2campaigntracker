import { useState, useMemo } from "react";
import type { BaseItem, ItemMod } from "../../types/itemDatabase";
import { ITEM_CLASS_DISPLAY_NAMES } from "../../types/itemDatabase";
import { cleanModText } from "../../data/mods";
import { ModTable } from "./ModTable";
import styles from "./ItemDetail.module.css";

interface ItemDetailProps {
  item: BaseItem;
  onSaveCraft?: (item: BaseItem, selectedMods: ItemMod[]) => void;
  onModsChange?: (mods: ItemMod[]) => void;
}

function formatAps(attackTime: number): string {
  return (1000 / attackTime).toFixed(2);
}

function formatCrit(critChance: number): string {
  return (critChance / 100).toFixed(1);
}

function formatDefence(def: { min: number; max: number }, label: string): string {
  if (def.min === def.max) return `${def.min} ${label}`;
  return `${def.min}-${def.max} ${label}`;
}

function displayClassName(cls: string): string {
  return ITEM_CLASS_DISPLAY_NAMES[cls] ?? cls;
}

/** Find which tier number a mod is within its group */
function findTierLabel(mod: ItemMod, allMods: ItemMod[]): string {
  const sametype = allMods
    .filter((m) => m.type === mod.type)
    .sort((a, b) => a.requiredLevel - b.requiredLevel);
  const idx = sametype.findIndex((m) => m.id === mod.id);
  if (idx < 0) return "";
  return `T${sametype.length - idx}`;
}

export function ItemDetail({ item, onSaveCraft, onModsChange }: ItemDetailProps) {
  const [iconError, setIconError] = useState(false);

  // Craft planner state — lifted from ModTable so we can render it in the top area
  const [selectedMods, setSelectedMods] = useState<Map<string, ItemMod>>(new Map());

  // Notify parent when selected mods change
  const updateMods = (mods: Map<string, ItemMod>) => {
    setSelectedMods(mods);
    onModsChange?.([...mods.values()]);
  };
  const removeMod = (modId: string) => {
    const next = new Map(selectedMods);
    next.delete(modId);
    updateMods(next);
  };
  // Keep a ref to all mods for tier label computation
  const [allModsList, setAllModsList] = useState<ItemMod[]>([]);

  const props = item.properties;
  const isWeapon = props.physicalDamageMin != null && props.physicalDamageMax != null;
  const hasDefences = props.armour != null || props.evasion != null || props.energyShield != null;

  const reqs: string[] = [];
  if (item.requirements.level > 0) reqs.push(`Level ${item.requirements.level}`);
  if (item.requirements.strength > 0) reqs.push(`${item.requirements.strength} Str`);
  if (item.requirements.dexterity > 0) reqs.push(`${item.requirements.dexterity} Dex`);
  if (item.requirements.intelligence > 0) reqs.push(`${item.requirements.intelligence} Int`);

  const selectedPrefixes = useMemo(
    () => [...selectedMods.values()].filter((m) => m.generationType === "prefix"),
    [selectedMods]
  );
  const selectedSuffixes = useMemo(
    () => [...selectedMods.values()].filter((m) => m.generationType === "suffix"),
    [selectedMods]
  );
  const hasSelections = selectedMods.size > 0;

  return (
    <div className={styles.detail}>
      {/* Top area: item card + craft planner side by side */}
      <div className={styles.topArea}>
        {/* Item card */}
        <div className={styles.card}>
          <div className={styles.cardTop}>
            {!iconError && item.iconPath ? (
              <img
                className={styles.icon}
                src={`/assets/${item.iconPath}`}
                alt={item.name}
                onError={() => setIconError(true)}
              />
            ) : (
              <div className={styles.iconFallback}>?</div>
            )}
            <div className={styles.cardInfo}>
              <div className={styles.itemName}>{item.name}</div>
              <div className={styles.itemClass}>{displayClassName(item.itemClass)}</div>

              <div className={styles.statsLine}>
                {isWeapon && (
                  <>
                    <span className={styles.stat}>
                      {props.physicalDamageMin}-{props.physicalDamageMax}{" "}
                      <span className={styles.statLabel}>Damage</span>
                    </span>
                    {props.attackTime != null && (
                      <span className={styles.stat}>
                        {formatAps(props.attackTime)}{" "}
                        <span className={styles.statLabel}>APS</span>
                      </span>
                    )}
                    {props.criticalStrikeChance != null && (
                      <span className={styles.stat}>
                        {formatCrit(props.criticalStrikeChance)}%{" "}
                        <span className={styles.statLabel}>Crit</span>
                      </span>
                    )}
                  </>
                )}
                {hasDefences && (
                  <>
                    {props.armour && (
                      <span className={styles.stat}>
                        {formatDefence(props.armour, "")}{" "}
                        <span className={styles.statLabel}>Armour</span>
                      </span>
                    )}
                    {props.evasion && (
                      <span className={styles.stat}>
                        {formatDefence(props.evasion, "")}{" "}
                        <span className={styles.statLabel}>Evasion</span>
                      </span>
                    )}
                    {props.energyShield && (
                      <span className={styles.stat}>
                        {formatDefence(props.energyShield, "")}{" "}
                        <span className={styles.statLabel}>ES</span>
                      </span>
                    )}
                  </>
                )}
              </div>

              {reqs.length > 0 && (
                <div className={styles.reqLine}>
                  Requires:{" "}
                  {reqs.map((r, i) => (
                    <span key={i}>
                      {i > 0 && ", "}
                      <span className={styles.reqValue}>{r}</span>
                    </span>
                  ))}
                </div>
              )}

              {item.implicits.length > 0 && (
                <div className={styles.implicits}>
                  {item.implicits.map((imp, i) => (
                    <div key={i} className={styles.implicit}>{imp}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Craft planner */}
        <div className={styles.planner}>
          <div className={styles.plannerHeader}>
            <span className={styles.plannerTitle}>Craft Planner</span>
            {hasSelections && (
              <button
                className={styles.plannerClear}
                onClick={() => updateMods(new Map())}
              >
                Clear
              </button>
            )}
          </div>
          {hasSelections ? (
            <div className={styles.plannerContent}>
              {selectedPrefixes.length > 0 && (
                <div className={styles.plannerSection}>
                  <div className={styles.plannerSectionLabel}>
                    Prefixes ({selectedPrefixes.length}/3)
                  </div>
                  {selectedPrefixes.map((mod) => (
                    <div key={mod.id} className={styles.plannerMod}>
                      <span className={styles.plannerTier}>
                        {findTierLabel(mod, allModsList)}
                      </span>
                      <span className={styles.plannerModText}>
                        {cleanModText(mod.text)}
                      </span>
                      <button
                        className={styles.plannerRemove}
                        onClick={() => removeMod(mod.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {selectedSuffixes.length > 0 && (
                <div className={styles.plannerSection}>
                  <div className={styles.plannerSectionLabel}>
                    Suffixes ({selectedSuffixes.length}/3)
                  </div>
                  {selectedSuffixes.map((mod) => (
                    <div key={mod.id} className={styles.plannerMod}>
                      <span className={styles.plannerTier}>
                        {findTierLabel(mod, allModsList)}
                      </span>
                      <span className={styles.plannerModText}>
                        {cleanModText(mod.text)}
                      </span>
                      <button
                        className={styles.plannerRemove}
                        onClick={() => removeMod(mod.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {hasSelections && onSaveCraft && (
                <button
                  className={styles.saveCraftBtn}
                  onClick={() => onSaveCraft(item, [...selectedMods.values()])}
                >
                  Save to Build Plan
                </button>
              )}
            </div>
          ) : (
            <div className={styles.plannerEmpty}>
              Click a mod tier below to plan your craft
            </div>
          )}
        </div>
      </div>

      {/* Mod table */}
      <div className={styles.modArea}>
        <ModTable
          item={item}
          selectedMods={selectedMods}
          onSelectedModsChange={updateMods}
          onAllModsLoaded={setAllModsList}
        />
      </div>
    </div>
  );
}
