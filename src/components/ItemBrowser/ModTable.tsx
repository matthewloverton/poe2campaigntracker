import { useState, useMemo } from "react";
import type { BaseItem, ItemMod } from "../../types/itemDatabase";
import { getModsForItem, groupModsByType, cleanModText } from "../../data/mods";
import type { ModGroup } from "../../data/mods";
import styles from "./ModTable.module.css";

interface ModTableProps {
  item: BaseItem;
  selectedMods: Map<string, ItemMod>;
  onSelectedModsChange: (mods: Map<string, ItemMod>) => void;
  onAllModsLoaded?: (mods: ItemMod[]) => void;
}

/** Format tag: energy_shield → Energy Shield, dot_multi → Dot Multi */
function formatTag(tag: string): string {
  return tag.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Assign a number to each mutual-exclusion group that contains >1 mod type */
function buildGroupNumbers(groups: ModGroup[]): Map<string, number> {
  const exclusionMap = new Map<string, string[]>();
  for (const g of groups) {
    const exGroup = g.tiers[0].group;
    const list = exclusionMap.get(exGroup) ?? [];
    list.push(g.type);
    exclusionMap.set(exGroup, list);
  }
  const groupNums = new Map<string, number>();
  let num = 1;
  for (const [, types] of exclusionMap) {
    if (types.length > 1) {
      for (const type of types) {
        groupNums.set(type, num);
      }
      num++;
    }
  }
  return groupNums;
}

export function ModTable({ item, selectedMods, onSelectedModsChange, onAllModsLoaded }: ModTableProps) {
  const [ilvlEnabled, setIlvlEnabled] = useState(true);
  const [ilvl, setIlvl] = useState(item.dropLevel);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [narrowTab, setNarrowTab] = useState<"prefixes" | "suffixes">("prefixes");

  // Tag filter
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const { prefixes, suffixes } = useMemo(() => getModsForItem(item), [item]);

  // Report all mods to parent for tier label computation
  useMemo(() => {
    onAllModsLoaded?.([...prefixes, ...suffixes]);
  }, [prefixes, suffixes, onAllModsLoaded]);

  // Collect all available tags for this item's mods
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const m of [...prefixes, ...suffixes]) {
      for (const t of m.tags) tags.add(t);
    }
    return [...tags].sort();
  }, [prefixes, suffixes]);

  // Filter by active tags before grouping
  const filteredPrefixes = useMemo(() => {
    if (activeTags.size === 0) return prefixes;
    return prefixes.filter((m) => m.tags.some((t) => activeTags.has(t)));
  }, [prefixes, activeTags]);

  const filteredSuffixes = useMemo(() => {
    if (activeTags.size === 0) return suffixes;
    return suffixes.filter((m) => m.tags.some((t) => activeTags.has(t)));
  }, [suffixes, activeTags]);

  const prefixGroups = useMemo(() => groupModsByType(filteredPrefixes), [filteredPrefixes]);
  const suffixGroups = useMemo(() => groupModsByType(filteredSuffixes), [filteredSuffixes]);

  const prefixGroupNums = useMemo(() => buildGroupNumbers(prefixGroups), [prefixGroups]);
  const suffixGroupNums = useMemo(() => buildGroupNumbers(suffixGroups), [suffixGroups]);

  // Which mod types have a selected tier
  const selectedTypes = useMemo(() => {
    const types = new Set<string>();
    for (const mod of selectedMods.values()) {
      types.add(mod.type);
    }
    return types;
  }, [selectedMods]);

  // Blocked types from mutual exclusion
  const blockedTypes = useMemo(() => {
    const blocked = new Set<string>();
    const allGroups = [...prefixGroups, ...suffixGroups];
    const typeToExGroup = new Map<string, string>();
    for (const g of allGroups) {
      typeToExGroup.set(g.type, g.tiers[0].group);
    }
    for (const selType of selectedTypes) {
      const exGroup = typeToExGroup.get(selType);
      if (!exGroup) continue;
      for (const g of allGroups) {
        if (g.tiers[0].group === exGroup && g.type !== selType) {
          blocked.add(g.type);
        }
      }
    }
    return blocked;
  }, [selectedTypes, prefixGroups, suffixGroups]);

  // Selected counts
  const selectedPrefixes = useMemo(() => {
    return [...selectedMods.values()].filter((m) => m.generationType === "prefix");
  }, [selectedMods]);

  const selectedSuffixes = useMemo(() => {
    return [...selectedMods.values()].filter((m) => m.generationType === "suffix");
  }, [selectedMods]);

  function toggleGroup(type: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function selectTier(mod: ItemMod) {
    const next = new Map(selectedMods);

    // If this exact mod is already selected, deselect it
    if (next.has(mod.id)) {
      next.delete(mod.id);
      onSelectedModsChange(next);
      return;
    }

    // Check prefix/suffix cap
    const count = mod.generationType === "prefix" ? selectedPrefixes.length : selectedSuffixes.length;

    // Remove any existing selection from the same type (switching tiers)
    const existingOfType = [...next.values()].find((m) => m.type === mod.type);
    if (existingOfType) {
      next.delete(existingOfType.id);
    } else if (count >= 3) {
      return; // at cap and not switching tiers
    }

    next.set(mod.id, mod);
    onSelectedModsChange(next);
  }

  function renderGroups(groups: ModGroup[], groupNums: Map<string, number>) {
    if (groups.length === 0) {
      return <div className={styles.empty}>No mods available</div>;
    }

    return groups.map((group) => {
      const isOpen = openGroups.has(group.type);
      const isBlocked = blockedTypes.has(group.type);
      const hasSelection = selectedTypes.has(group.type);
      const groupNum = groupNums.get(group.type);

      return (
        <div key={group.type} className={isBlocked ? styles.groupBlocked : ""}>
          <div className={`${styles.groupRow} ${hasSelection ? styles.groupSelected : ""}`}>
            {groupNum != null && (
              <span className={styles.exclusionBadge} title={`Exclusion group ${groupNum} — only one of these can be selected`}>
                {groupNum}
              </span>
            )}

            <button
              className={styles.groupBtn}
              onClick={() => toggleGroup(group.type)}
            >
              <span
                className={`${styles.groupChevron} ${
                  isOpen ? styles.groupChevronOpen : ""
                }`}
              >
                &#9654;
              </span>
              <span className={styles.groupLabel}>{group.label}</span>
              {group.tiers[0].tags.length > 0 && (
                <span className={styles.groupTags}>
                  {group.tiers[0].tags.map((tag) => (
                    <span key={tag} className={styles.craftingTag}>{formatTag(tag)}</span>
                  ))}
                </span>
              )}
              <span className={styles.groupCount}>
                {group.tiers.length} tier{group.tiers.length !== 1 ? "s" : ""}
              </span>
            </button>
          </div>

          {isOpen &&
            group.tiers.map((mod, i) => {
              const ilvlDimmed = ilvlEnabled && mod.requiredLevel > ilvl;
              const isSelected = selectedMods.has(mod.id);
              const canSelect = !isBlocked && !ilvlDimmed;
              const genType = mod.generationType;
              const count = genType === "prefix" ? selectedPrefixes.length : selectedSuffixes.length;
              const atCap = !selectedTypes.has(mod.type) && count >= 3;

              return (
                <button
                  key={mod.id}
                  className={`${styles.tierRow} ${
                    ilvlDimmed ? styles.tierDimmed : ""
                  } ${isSelected ? styles.tierSelected : ""} ${
                    canSelect && !atCap ? styles.tierClickable : ""
                  }`}
                  onClick={() => canSelect && !atCap && selectTier(mod)}
                  disabled={!canSelect || (atCap && !isSelected)}
                >
                  <span className={styles.tierNum}>T{group.tiers.length - i}</span>
                  <span className={styles.tierName}>{mod.name}</span>
                  <span className={styles.tierText}>{cleanModText(mod.text)}</span>
                  <span className={styles.tierLevel}>
                    Lv{mod.requiredLevel}
                  </span>
                </button>
              );
            })}
        </div>
      );
    });
  }

  return (
    <div className={styles.modTable}>
      {/* iLvl filter */}
      <div className={styles.ilvlRow}>
        <input
          type="checkbox"
          id="ilvl-filter"
          className={styles.ilvlCheckbox}
          checked={ilvlEnabled}
          onChange={(e) => setIlvlEnabled(e.target.checked)}
        />
        <label htmlFor="ilvl-filter" className={styles.ilvlLabel}>
          iLvl filter
        </label>
        <input
          type="range"
          className={styles.ilvlSlider}
          value={ilvl}
          onChange={(e) => setIlvl(Number(e.target.value))}
          disabled={!ilvlEnabled}
          min={1}
          max={100}
        />
        <input
          type="number"
          className={styles.ilvlInput}
          value={ilvl}
          onChange={(e) => setIlvl(Number(e.target.value))}
          disabled={!ilvlEnabled}
          min={1}
          max={100}
        />
        <button
          className={`${styles.ilvlPreset} ${ilvl === 83 ? styles.ilvlPresetActive : ""}`}
          onClick={() => { setIlvlEnabled(true); setIlvl(83); }}
        >
          83
        </button>
        <button
          className={`${styles.ilvlPreset} ${ilvl === 86 ? styles.ilvlPresetActive : ""}`}
          onClick={() => { setIlvlEnabled(true); setIlvl(86); }}
        >
          86
        </button>
      </div>

      {/* Tag filters */}
      {availableTags.length > 0 && (
        <div className={styles.tagFilterRow}>
          {availableTags.map((tag) => {
            const isActive = activeTags.has(tag);
            return (
              <button
                key={tag}
                className={`${styles.tagFilterBtn} ${isActive ? styles.tagFilterBtnActive : ""}`}
                onClick={() => {
                  setActiveTags((prev) => {
                    const next = new Set(prev);
                    if (next.has(tag)) next.delete(tag);
                    else next.add(tag);
                    return next;
                  });
                }}
              >
                {formatTag(tag)}
              </button>
            );
          })}
          {activeTags.size > 0 && (
            <button
              className={styles.tagFilterClear}
              onClick={() => setActiveTags(new Set())}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Narrow-only tab bar */}
      <div className={styles.narrowTabBar}>
        <button
          className={`${styles.narrowTab} ${narrowTab === "prefixes" ? styles.narrowTabActive : ""}`}
          onClick={() => setNarrowTab("prefixes")}
        >
          Prefixes ({prefixGroups.length})
        </button>
        <button
          className={`${styles.narrowTab} ${narrowTab === "suffixes" ? styles.narrowTabActive : ""}`}
          onClick={() => setNarrowTab("suffixes")}
        >
          Suffixes ({suffixGroups.length})
        </button>
      </div>

      <div className={styles.columns}>
        <div className={`${styles.column} ${narrowTab !== "prefixes" ? styles.columnHiddenNarrow : ""}`}>
          <div className={styles.columnHeader}>Prefixes ({prefixGroups.length})</div>
          <div className={styles.modList}>
            {renderGroups(prefixGroups, prefixGroupNums)}
          </div>
        </div>

        <div className={`${styles.column} ${narrowTab !== "suffixes" ? styles.columnHiddenNarrow : ""}`}>
          <div className={styles.columnHeader}>Suffixes ({suffixGroups.length})</div>
          <div className={styles.modList}>
            {renderGroups(suffixGroups, suffixGroupNums)}
          </div>
        </div>
      </div>
    </div>
  );
}
