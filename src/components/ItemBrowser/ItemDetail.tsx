import { useState, useMemo, useEffect, useRef } from "react";
import type { BaseItem, ItemMod } from "../../types/itemDatabase";
import { ITEM_CLASS_DISPLAY_NAMES } from "../../types/itemDatabase";
import { cleanModText, modById } from "../../data/mods";
import { augmentById } from "../../data/augments";
import {
  type Augment,
  searchAugmentFamilies,
  getAugmentEffect,
  getAugmentBonded,
  itemClassToAugmentCategory,
  defaultSocketCount,
} from "../../data/augments";
import { ModTable } from "./ModTable";
import styles from "./ItemDetail.module.css";

export interface CraftState {
  quality: number;
  modRolls: Record<string, number>;
  augmentIds: string[];
}

export interface InitialCraftState {
  selectedModIds?: string[];
  quality?: number;
  modRolls?: Record<string, number>;
  augmentIds?: string[];
}

interface ItemDetailProps {
  item: BaseItem;
  onModsChange?: (mods: ItemMod[]) => void;
  onCraftStateChange?: (state: CraftState) => void;
  initialState?: InitialCraftState;
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

/** Replace (min-max) ranges in mod text with resolved values */
function resolveModRoll(mod: ItemMod, pct?: number): string {
  const text = cleanModText(mod.text);
  return text.replace(/\((-?\d+(?:\.\d+)?)[–—-](-?\d+(?:\.\d+)?)\)/g, (_m, a, b) => {
    const min = Number(a), max = Number(b);
    const isFrac = !Number.isInteger(min) || !Number.isInteger(max);
    const fmt = (n: number) => isFrac ? n.toFixed(2).replace(/\.?0+$/, "") : String(Math.round(n));
    if (pct != null) return fmt(min + (max - min) * pct / 100);
    return fmt((min + max) / 2);
  });
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

export function ItemDetail({ item, onModsChange, onCraftStateChange, initialState }: ItemDetailProps) {
  const [iconError, setIconError] = useState(false);

  // Craft planner state — lifted from ModTable so we can render it in the top area
  const [selectedMods, setSelectedMods] = useState<Map<string, ItemMod>>(() => {
    const map = new Map<string, ItemMod>();
    if (initialState?.selectedModIds) {
      for (const id of initialState.selectedModIds) {
        const mod = modById.get(id);
        if (mod) map.set(id, mod);
      }
    }
    return map;
  });

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

  const [quality, setQuality] = useState(initialState?.quality ?? 20);
  const [modRolls, setModRolls] = useState<Record<string, number>>(initialState?.modRolls ?? {}); // modId → 0-100 percentile

  // Augment socket state
  const augCategory = itemClassToAugmentCategory(item.itemClass);
  const socketCount = defaultSocketCount(item.itemClass);
  const [sockets, setSockets] = useState<(Augment | null)[]>(() => {
    const base: (Augment | null)[] = Array(socketCount).fill(null);
    if (initialState?.augmentIds) {
      initialState.augmentIds.forEach((id, i) => {
        if (i < base.length && id) base[i] = augmentById.get(id) ?? null;
      });
    }
    return base;
  });
  const [socketSearch, setSocketSearch] = useState("");
  const [editingSocket, setEditingSocket] = useState<number | null>(null);

  // Sync initial selectedMods up to parent on mount so action buttons enable correctly
  useEffect(() => {
    onModsChange?.([...selectedMods.values()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const socketDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editingSocket == null) return;
    function handleClick(e: MouseEvent) {
      if (socketDropdownRef.current && !socketDropdownRef.current.contains(e.target as Node)) {
        setEditingSocket(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [editingSocket]);

  // Notify parent of craft state changes
  useEffect(() => {
    onCraftStateChange?.({
      quality,
      modRolls,
      augmentIds: sockets.map((s) => s?.id ?? ""),
    });
  }, [quality, modRolls, sockets, onCraftStateChange]);

  const augFamilyResults = useMemo(() => {
    if (editingSocket == null || !augCategory) return [];
    return searchAugmentFamilies(socketSearch, augCategory);
  }, [socketSearch, editingSocket, augCategory]);

  const props = item.properties;
  const isWeapon = props.physicalDamageMin != null && props.physicalDamageMax != null;
  const hasDefences = props.armour != null || props.evasion != null || props.energyShield != null;

  // Parse augment effect text for numeric bonuses
  function parseAugmentBonuses(socketList: (Augment | null)[], category: string) {
    let incPhysDmg = 0;
    let incArmour = 0;
    let incEvasion = 0;
    let incES = 0;

    for (const aug of socketList) {
      if (!aug) continue;
      const texts = getAugmentEffect(aug, category);
      for (const t of texts) {
        const pctMatch = t.match(/(\d+)%\s+increased\s+(.+)/i);
        if (!pctMatch) continue;
        const val = Number(pctMatch[1]);
        const what = pctMatch[2].toLowerCase();
        if (what.includes("physical damage")) incPhysDmg += val;
        if (what.includes("armour") || what.includes("armor")) incArmour += val;
        if (what.includes("evasion")) incEvasion += val;
        if (what.includes("energy shield")) incES += val;
      }
    }
    return { incPhysDmg, incArmour, incEvasion, incES };
  }

  // Calculate modified stats from quality + selected mods + augment sockets
  const modifiedStats = useMemo(() => {
    const mods = [...selectedMods.values()];
    const augBonuses = augCategory ? parseAugmentBonuses(sockets, augCategory) : { incPhysDmg: 0, incArmour: 0, incEvasion: 0, incES: 0 };

    // Extract local stat values from selected mods
    function rollValue(mod: ItemMod, s: { min: number; max: number }): number {
      const pct = modRolls[mod.id];
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

    const result: {
      physMin?: number; physMax?: number;
      armour?: number; evasion?: number; energyShield?: number;
      aps?: number;
    } = {};

    if (isWeapon && props.physicalDamageMin != null && props.physicalDamageMax != null) {
      const flatMin = sumStat("local_minimum_added_physical_damage");
      const flatMax = sumStat("local_maximum_added_physical_damage");
      const incPhys = sumStat("local_physical_damage_+%") + augBonuses.incPhysDmg;
      const modMult = 1 + incPhys / 100;
      const qualMult = 1 + quality / 100;
      result.physMin = Math.round((props.physicalDamageMin + flatMin) * modMult * qualMult);
      result.physMax = Math.round((props.physicalDamageMax + flatMax) * modMult * qualMult);

      if (props.attackTime != null) {
        const incSpeed = sumStat("local_attack_speed_+%");
        const modifiedTime = props.attackTime / (1 + incSpeed / 100);
        result.aps = 1000 / modifiedTime;
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

      if (props.armour) {
        const base = (props.armour.min + props.armour.max) / 2;
        result.armour = Math.round((base + flatAr) * (1 + incAr / 100) * qualMult);
      }
      if (props.evasion) {
        const base = (props.evasion.min + props.evasion.max) / 2;
        result.evasion = Math.round((base + flatEv) * (1 + incEv / 100) * qualMult);
      }
      if (props.energyShield) {
        const base = (props.energyShield.min + props.energyShield.max) / 2;
        result.energyShield = Math.round((base + flatEs) * (1 + incEs / 100) * qualMult);
      }
    }

    return result;
  }, [selectedMods, quality, modRolls, item, isWeapon, hasDefences, props, sockets, augCategory]);

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
  const selectedCorrupted = useMemo(
    () => [...selectedMods.values()].filter((m) => m.generationType === "corrupted"),
    [selectedMods]
  );
  const hasSelections = selectedMods.size > 0;

  // Compute PoE-style display name and rarity from the selection
  const rarity: "normal" | "magic" | "rare" = useMemo(() => {
    const p = selectedPrefixes.length;
    const s = selectedSuffixes.length;
    if (p === 0 && s === 0) return "normal";
    if (p <= 1 && s <= 1) return "magic";
    return "rare";
  }, [selectedPrefixes.length, selectedSuffixes.length]);

  const displayName = useMemo(() => {
    if (rarity === "normal") return item.name;
    if (rarity === "magic") {
      const prefix = selectedPrefixes[0]?.name?.trim();
      const suffix = selectedSuffixes[0]?.name?.trim();
      return [prefix, item.name, suffix].filter(Boolean).join(" ");
    }
    // Rare names are randomly generated in-game; we keep the base name.
    return item.name;
  }, [rarity, selectedPrefixes, selectedSuffixes, item.name]);

  const isCorrupted = selectedCorrupted.length > 0;

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
              <div
                className={`${styles.itemName} ${styles[`rarity_${rarity}`]} ${isCorrupted ? styles.rarityCorrupted : ""}`}
              >
                {displayName}
              </div>
              <div className={styles.itemClass}>
                {displayClassName(item.itemClass)}
                {rarity !== "normal" && <span className={styles.rarityTag}> · {rarity[0].toUpperCase() + rarity.slice(1)}{isCorrupted ? " · Corrupted" : ""}</span>}
                {rarity === "normal" && isCorrupted && <span className={styles.rarityTag}> · Corrupted</span>}
              </div>

              <div className={styles.statsLine}>
                {isWeapon && (
                  <>
                    <span className={styles.stat}>
                      {props.physicalDamageMin}-{props.physicalDamageMax}
                      {modifiedStats.physMin != null && (
                        <span className={styles.modifiedValue}>
                          {" "}({modifiedStats.physMin}-{modifiedStats.physMax})
                        </span>
                      )}
                      {" "}<span className={styles.statLabel}>Damage</span>
                    </span>
                    {props.attackTime != null && (
                      <span className={styles.stat}>
                        {formatAps(props.attackTime)}
                        {modifiedStats.aps != null && (
                          <span className={styles.modifiedValue}>
                            {" "}({modifiedStats.aps.toFixed(2)})
                          </span>
                        )}
                        {" "}<span className={styles.statLabel}>APS</span>
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
                        {formatDefence(props.armour, "")}
                        {modifiedStats.armour != null && (
                          <span className={styles.modifiedValue}> ({modifiedStats.armour})</span>
                        )}
                        {" "}<span className={styles.statLabel}>Armour</span>
                      </span>
                    )}
                    {props.evasion && (
                      <span className={styles.stat}>
                        {formatDefence(props.evasion, "")}
                        {modifiedStats.evasion != null && (
                          <span className={styles.modifiedValue}> ({modifiedStats.evasion})</span>
                        )}
                        {" "}<span className={styles.statLabel}>Evasion</span>
                      </span>
                    )}
                    {props.energyShield && (
                      <span className={styles.stat}>
                        {formatDefence(props.energyShield, "")}
                        {modifiedStats.energyShield != null && (
                          <span className={styles.modifiedValue}> ({modifiedStats.energyShield})</span>
                        )}
                        {" "}<span className={styles.statLabel}>ES</span>
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Quality + roll mode */}
              {(isWeapon || hasDefences) && (
                <div className={styles.qualityRow}>
                  <span className={styles.qualityLabel}>Quality</span>
                  <input
                    type="range"
                    className={styles.qualitySlider}
                    min={0}
                    max={20}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                  />
                  <span className={styles.qualityValue}>{quality}%</span>
                </div>
              )}

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

            {/* Augment sockets — circular column to the right */}
            {augCategory && (
              <div className={styles.socketColumn}>
                <div className={styles.socketCircles}>
                  {sockets.map((aug, i) => (
                    <div key={i} className={styles.socketSlot}>
                      {aug ? (
                        <div className={styles.socketFilledWrap}>
                          <button
                            className={styles.socketCircleFilled}
                            onClick={() => { setEditingSocket(i); setSocketSearch(""); }}
                            onContextMenu={(e) => { e.preventDefault(); setSockets((prev) => { const next = [...prev]; next[i] = null; return next; }); }}
                            title="Click to change · Right-click to remove"
                          >
                            {aug.iconPath ? (
                              <img
                                className={styles.socketIcon}
                                src={`/assets/${aug.iconPath}`}
                                alt={aug.name}
                              />
                            ) : (
                              <span className={styles.socketIconFallback}>
                                {aug.typeId === "Rune" ? "R" : aug.typeId === "SoulCore" ? "S" : aug.typeId === "Idol" ? "I" : "A"}
                              </span>
                            )}
                          </button>
                          <span className={styles.socketLabel}>{aug.name}</span>
                          <span className={styles.socketHoverTip}>
                            <span className={styles.socketEffectName}>{aug.name}</span>
                            {augCategory && getAugmentEffect(aug, augCategory).map((t, j) => (
                              <span key={j} className={styles.socketEffectLine}>{t}</span>
                            ))}
                            {augCategory && getAugmentBonded(aug, augCategory).map((t, j) => (
                              <span key={`b${j}`} className={styles.socketBondedLine}>{t}</span>
                            ))}
                          </span>
                        </div>
                      ) : (
                        <button
                          className={styles.socketCircleEmpty}
                          onClick={() => { setEditingSocket(i); setSocketSearch(""); }}
                          title={`Socket ${i + 1}`}
                        >
                          +
                        </button>
                      )}
                      {editingSocket === i && (
                        <div className={styles.socketDropdown} ref={socketDropdownRef}>
                          <input
                            className={styles.socketSearchInput}
                            type="text"
                            placeholder="Search augments..."
                            value={socketSearch}
                            onChange={(e) => setSocketSearch(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Escape") setEditingSocket(null); }}
                            autoFocus
                          />
                          <div className={styles.socketResults}>
                            {augFamilyResults.map((fam) => {
                              const display = fam.regular ?? fam.lesser ?? fam.greater;
                              if (!display) return null;
                              return (
                                <div key={fam.baseName} className={styles.socketFamilyRow}>
                                  {display.iconPath && (
                                    <img
                                      className={styles.socketResultIcon}
                                      src={`/assets/${display.iconPath}`}
                                      alt=""
                                    />
                                  )}
                                  <div className={styles.socketFamilyInfo}>
                                    <span className={styles.socketResultName}>{fam.baseName}</span>
                                    <span className={styles.socketResultEffect}>
                                      {getAugmentEffect(display, augCategory!).join(", ")}
                                    </span>
                                  </div>
                                  <div className={styles.socketTierBtns}>
                                    {fam.lesser && (
                                      <button
                                        className={styles.socketTierBtn}
                                        onClick={() => {
                                          setSockets((prev) => { const next = [...prev]; next[i] = fam.lesser!; return next; });
                                          setEditingSocket(null);
                                        }}
                                      >
                                        L
                                      </button>
                                    )}
                                    {fam.regular && (
                                      <button
                                        className={`${styles.socketTierBtn} ${styles.socketTierBtnActive}`}
                                        onClick={() => {
                                          setSockets((prev) => { const next = [...prev]; next[i] = fam.regular!; return next; });
                                          setEditingSocket(null);
                                        }}
                                      >
                                        R
                                      </button>
                                    )}
                                    {fam.greater && (
                                      <button
                                        className={styles.socketTierBtn}
                                        onClick={() => {
                                          setSockets((prev) => { const next = [...prev]; next[i] = fam.greater!; return next; });
                                          setEditingSocket(null);
                                        }}
                                      >
                                        G
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                      <div className={styles.plannerModTop}>
                        <span className={styles.plannerTier}>
                          {findTierLabel(mod, allModsList)}
                        </span>
                        <span className={styles.plannerModText}>
                          {resolveModRoll(mod, modRolls[mod.id])}
                        </span>
                        <button
                          className={styles.plannerRemove}
                          onClick={() => removeMod(mod.id)}
                        >
                          ×
                        </button>
                      </div>
                      {mod.stats.some((s) => s.min !== s.max) && (
                        <div className={styles.plannerModRoll}>
                          <input
                            type="range"
                            className={styles.modRollSlider}
                            min={0}
                            max={100}
                            value={modRolls[mod.id] ?? 50}
                            onChange={(e) => setModRolls((prev) => ({ ...prev, [mod.id]: Number(e.target.value) }))}
                          />
                        </div>
                      )}
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
                      <div className={styles.plannerModTop}>
                        <span className={styles.plannerTier}>
                          {findTierLabel(mod, allModsList)}
                        </span>
                        <span className={styles.plannerModText}>
                          {resolveModRoll(mod, modRolls[mod.id])}
                        </span>
                        <button
                          className={styles.plannerRemove}
                          onClick={() => removeMod(mod.id)}
                        >
                          ×
                        </button>
                      </div>
                      {mod.stats.some((s) => s.min !== s.max) && (
                        <div className={styles.plannerModRoll}>
                          <input
                            type="range"
                            className={styles.modRollSlider}
                            min={0}
                            max={100}
                            value={modRolls[mod.id] ?? 50}
                            onChange={(e) => setModRolls((prev) => ({ ...prev, [mod.id]: Number(e.target.value) }))}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {selectedCorrupted.length > 0 && (
                <div className={`${styles.plannerSection} ${styles.plannerSectionCorrupted}`}>
                  <div className={styles.plannerSectionLabel}>
                    Corrupted ({selectedCorrupted.length})
                  </div>
                  {selectedCorrupted.map((mod) => (
                    <div key={mod.id} className={styles.plannerMod}>
                      <div className={styles.plannerModTop}>
                        <span className={styles.plannerModText}>
                          {resolveModRoll(mod, modRolls[mod.id])}
                        </span>
                        <button
                          className={styles.plannerRemove}
                          onClick={() => removeMod(mod.id)}
                        >
                          ×
                        </button>
                      </div>
                      {mod.stats.some((s) => s.min !== s.max) && (
                        <div className={styles.plannerModRoll}>
                          <input
                            type="range"
                            className={styles.modRollSlider}
                            min={0}
                            max={100}
                            value={modRolls[mod.id] ?? 50}
                            onChange={(e) => setModRolls((prev) => ({ ...prev, [mod.id]: Number(e.target.value) }))}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
