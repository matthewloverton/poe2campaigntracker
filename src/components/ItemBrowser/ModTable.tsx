import { useState, useMemo } from "react";
import type { BaseItem, ItemMod, ModSource } from "../../types/itemDatabase";
import { getModsForItem, groupModsByType, cleanModText, modWeightOnItem } from "../../data/mods";
import type { ModGroup } from "../../data/mods";
import { essenceModsForItem } from "../../data/essences";
import styles from "./ModTable.module.css";

const SOURCE_TABS: { key: ModSource; label: string }[] = [
  { key: "normal", label: "Normal" },
  { key: "essence", label: "Essence" },
  { key: "desecrated", label: "Desecrated" },
  { key: "corrupted", label: "Corrupted" },
];

interface ModTableProps {
  item: BaseItem;
  selectedMods: Map<string, ItemMod>;
  onSelectedModsChange: (mods: Map<string, ItemMod>) => void;
  onAllModsLoaded?: (mods: ItemMod[]) => void;
}

const HIDDEN_TAGS = new Set(["unveiled_mod", "poison", "bleed"]);

/** Display groupings for tag filter pills (in order). Tags outside these groups fall into "other". */
const TAG_GROUPS: { key: string; tags: string[] }[] = [
  { key: "damage",   tags: ["physical", "fire", "cold", "lightning", "elemental", "chaos", "damage", "caster"] },
  { key: "defences", tags: ["life", "mana", "energy_shield", "armour", "evasion", "resistance", "defences", "block"] },
  { key: "offence",  tags: ["attack", "critical", "speed", "minion"] },
  { key: "charges",  tags: ["endurance_charge", "frenzy_charge", "power_charge"] },
  { key: "misc",     tags: ["resource", "attribute", "gem", "flask", "life_flask", "charm", "ailment", "aura", "curse"] },
  { key: "abyss",    tags: ["ulaman", "kurgal", "amanamu", "kulemak", "watcher"] },
];

function tagGroupIndex(tag: string): number {
  for (let i = 0; i < TAG_GROUPS.length; i++) {
    if (TAG_GROUPS[i].tags.includes(tag)) return i;
  }
  return TAG_GROUPS.length; // "other" bucket at the end
}

/** Canonicalize tag key: strip _mod suffix, collapse *_damage → base element */
function canonTag(tag: string): string {
  let clean = tag
    .replace(/_mod$/i, "")
    .replace(/_abyss_special_prefix$/i, "")
    .replace(/_abyss_suffix$/i, "");
  const m = clean.match(/^(elemental|physical|chaos|caster)_damage$/i);
  if (m) clean = m[1].toLowerCase();
  if (clean === "flat_life_regen") clean = "life";
  return clean;
}

/** Format tag: energy_shield → Energy Shield, dot_multi → Dot Multi */
function formatTag(tag: string): string {
  return canonTag(tag).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** PoE-style colour for a tag. Returns {fg, bg, border} CSS colour strings. */
function tagColor(tag: string): { fg: string; bg: string; border: string } | null {
  const t = canonTag(tag);
  const map: Record<string, { fg: string; bg: string; border: string }> = {
    fire:           { fg: "#ff7a5c", bg: "rgba(255,122,92,0.12)",  border: "rgba(255,122,92,0.45)" },
    cold:           { fg: "#7ec9ff", bg: "rgba(126,201,255,0.12)", border: "rgba(126,201,255,0.45)" },
    lightning:      { fg: "#ffd34e", bg: "rgba(255,211,78,0.12)",  border: "rgba(255,211,78,0.45)" },
    elemental:      { fg: "#e8c97a", bg: "rgba(232,201,122,0.12)", border: "rgba(232,201,122,0.45)" },
    chaos:          { fg: "#d487ff", bg: "rgba(212,135,255,0.12)", border: "rgba(212,135,255,0.45)" },
    physical:       { fg: "#d8d3c4", bg: "rgba(216,211,196,0.10)", border: "rgba(216,211,196,0.35)" },
    life:           { fg: "#ff6b6b", bg: "rgba(255,107,107,0.12)", border: "rgba(255,107,107,0.45)" },
    mana:           { fg: "#6aa3ff", bg: "rgba(106,163,255,0.12)", border: "rgba(106,163,255,0.45)" },
    energy_shield:  { fg: "#4ecdc4", bg: "rgba(78,205,196,0.12)",  border: "rgba(78,205,196,0.45)" },
    armour:         { fg: "#c5a572", bg: "rgba(197,165,114,0.12)", border: "rgba(197,165,114,0.45)" },
    evasion:        { fg: "#8ad67a", bg: "rgba(138,214,122,0.12)", border: "rgba(138,214,122,0.45)" },
    resistance:     { fg: "#c9a84c", bg: "rgba(201,168,76,0.12)",  border: "rgba(201,168,76,0.45)" },
    attack:         { fg: "#ffb36b", bg: "rgba(255,179,107,0.12)", border: "rgba(255,179,107,0.45)" },
    caster:         { fg: "#b48aff", bg: "rgba(180,138,255,0.12)", border: "rgba(180,138,255,0.45)" },
    speed:          { fg: "#f5e07a", bg: "rgba(245,224,122,0.10)", border: "rgba(245,224,122,0.40)" },
    attribute:      { fg: "#e0c070", bg: "rgba(224,192,112,0.10)", border: "rgba(224,192,112,0.40)" },
    critical:       { fg: "#ff8fd9", bg: "rgba(255,143,217,0.12)", border: "rgba(255,143,217,0.45)" },
    minion:         { fg: "#8effb3", bg: "rgba(142,255,179,0.10)", border: "rgba(142,255,179,0.40)" },
    defences:       { fg: "#a8b0c0", bg: "rgba(168,176,192,0.10)", border: "rgba(168,176,192,0.35)" },
    gem:            { fg: "#86e0ff", bg: "rgba(134,224,255,0.10)", border: "rgba(134,224,255,0.40)" },
    resource:       { fg: "#e8b96a", bg: "rgba(232,185,106,0.10)", border: "rgba(232,185,106,0.40)" },
    damage:         { fg: "#e8d0b8", bg: "rgba(232,208,184,0.10)", border: "rgba(232,208,184,0.35)" },
    ailment:        { fg: "#c9d47a", bg: "rgba(201,212,122,0.10)", border: "rgba(201,212,122,0.40)" },
    aura:           { fg: "#a8cfff", bg: "rgba(168,207,255,0.10)", border: "rgba(168,207,255,0.40)" },
    curse:          { fg: "#c08fff", bg: "rgba(192,143,255,0.10)", border: "rgba(192,143,255,0.40)" },
    block:          { fg: "#c0c8d4", bg: "rgba(192,200,212,0.10)", border: "rgba(192,200,212,0.35)" },
    charm:          { fg: "#ffc88a", bg: "rgba(255,200,138,0.10)", border: "rgba(255,200,138,0.40)" },
    flask:          { fg: "#e07070", bg: "rgba(224,112,112,0.10)", border: "rgba(224,112,112,0.40)" },
    life_flask:     { fg: "#e07070", bg: "rgba(224,112,112,0.10)", border: "rgba(224,112,112,0.40)" },
    endurance_charge: { fg: "#ffb86b", bg: "rgba(255,184,107,0.10)", border: "rgba(255,184,107,0.40)" },
    frenzy_charge:    { fg: "#6be098", bg: "rgba(107,224,152,0.10)", border: "rgba(107,224,152,0.40)" },
    power_charge:     { fg: "#6aa3ff", bg: "rgba(106,163,255,0.10)", border: "rgba(106,163,255,0.40)" },
    // Abyss lords — desecrated-mod source signifiers
    ulaman:   { fg: "#8fe7a3", bg: "rgba(143,231,163,0.10)", border: "rgba(143,231,163,0.45)" },
    kurgal:   { fg: "#9fd87a", bg: "rgba(159,216,122,0.10)", border: "rgba(159,216,122,0.45)" },
    amanamu:  { fg: "#c6e07a", bg: "rgba(198,224,122,0.10)", border: "rgba(198,224,122,0.45)" },
    kulemak:  { fg: "#7ad6c2", bg: "rgba(122,214,194,0.10)", border: "rgba(122,214,194,0.45)" },
    watcher:  { fg: "#b8ff9e", bg: "rgba(184,255,158,0.10)", border: "rgba(184,255,158,0.45)" },
  };
  return map[t] ?? null;
}

function formatTagTitle(tag: string): string {
  return formatTag(tag);
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
  const [sourceTab, setSourceTab] = useState<ModSource>("normal");

  // Tag filter
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const { prefixes, suffixes, corrupted } = useMemo(() => {
    if (sourceTab === "essence") {
      const all = essenceModsForItem(item);
      return {
        prefixes: all.filter((m) => m.generationType === "prefix"),
        suffixes: all.filter((m) => m.generationType === "suffix"),
        corrupted: [] as ItemMod[],
      };
    }
    return getModsForItem(item, sourceTab);
  }, [item, sourceTab]);

  // All mods across all sources — used for tab counts AND tier-label computation.
  const allSourceMods = useMemo(() => {
    const counts: Record<ModSource, number> = { normal: 0, desecrated: 0, corrupted: 0, essence: 0 };
    const combined: ItemMod[] = [];
    for (const s of SOURCE_TABS) {
      if (s.key === "essence") {
        const mods = essenceModsForItem(item);
        counts.essence = mods.length;
        combined.push(...mods);
        continue;
      }
      const mods = getModsForItem(item, s.key);
      counts[s.key] = mods.prefixes.length + mods.suffixes.length + mods.corrupted.length;
      combined.push(...mods.prefixes, ...mods.suffixes, ...mods.corrupted);
    }
    return { counts, combined };
  }, [item]);

  const sourceCounts = allSourceMods.counts;

  // Report all mods to parent for tier label computation
  useMemo(() => {
    onAllModsLoaded?.(allSourceMods.combined);
  }, [allSourceMods, onAllModsLoaded]);

  // Collect all available tags for this item's mods (deduped by canonical form)
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const m of [...prefixes, ...suffixes, ...corrupted]) {
      for (const t of m.tags) {
        if (HIDDEN_TAGS.has(t)) continue;
        tags.add(canonTag(t));
      }
    }
    return [...tags].sort();
  }, [prefixes, suffixes, corrupted]);

  // Filter by active tags before grouping (compare canonical forms)
  const filteredPrefixes = useMemo(() => {
    if (activeTags.size === 0) return prefixes;
    return prefixes.filter((m) => m.tags.some((t) => activeTags.has(canonTag(t))));
  }, [prefixes, activeTags]);

  const filteredSuffixes = useMemo(() => {
    if (activeTags.size === 0) return suffixes;
    return suffixes.filter((m) => m.tags.some((t) => activeTags.has(canonTag(t))));
  }, [suffixes, activeTags]);

  const filteredCorrupted = useMemo(() => {
    if (activeTags.size === 0) return corrupted;
    return corrupted.filter((m) => m.tags.some((t) => activeTags.has(canonTag(t))));
  }, [corrupted, activeTags]);

  const prefixGroups = useMemo(() => groupModsByType(filteredPrefixes), [filteredPrefixes]);
  const suffixGroups = useMemo(() => groupModsByType(filteredSuffixes), [filteredSuffixes]);
  const corruptedGroups = useMemo(() => groupModsByType(filteredCorrupted), [filteredCorrupted]);

  const prefixGroupNums = useMemo(() => buildGroupNumbers(prefixGroups), [prefixGroups]);
  const suffixGroupNums = useMemo(() => buildGroupNumbers(suffixGroups), [suffixGroups]);
  const corruptedGroupNums = useMemo(() => buildGroupNumbers(corruptedGroups), [corruptedGroups]);

  // Which mod types have a selected tier — scoped to the current source tab
  // so a corrupted selection doesn't light up the identically-typed normal mod.
  const selectedTypes = useMemo(() => {
    const types = new Set<string>();
    for (const mod of selectedMods.values()) {
      if (mod.source === sourceTab) types.add(mod.type);
    }
    return types;
  }, [selectedMods, sourceTab]);

  // Blocked types from mutual exclusion (within the current source tab)
  const blockedTypes = useMemo(() => {
    const blocked = new Set<string>();
    const allGroups = [...prefixGroups, ...suffixGroups, ...corruptedGroups];
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
  }, [selectedTypes, prefixGroups, suffixGroups, corruptedGroups]);

  // Selected counts
  const selectedPrefixes = useMemo(() => {
    return [...selectedMods.values()].filter((m) => m.generationType === "prefix");
  }, [selectedMods]);

  const selectedSuffixes = useMemo(() => {
    return [...selectedMods.values()].filter((m) => m.generationType === "suffix");
  }, [selectedMods]);

  const selectedCorrupted = useMemo(() => {
    return [...selectedMods.values()].filter((m) => m.generationType === "corrupted");
  }, [selectedMods]);

  function capForGenType(gen: ItemMod["generationType"]): number {
    if (gen === "corrupted") return 1;
    return 3;
  }

  function countForGenType(gen: ItemMod["generationType"]): number {
    if (gen === "prefix") return selectedPrefixes.length;
    if (gen === "suffix") return selectedSuffixes.length;
    return selectedCorrupted.length;
  }

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

    // Check cap for this generation type
    const count = countForGenType(mod.generationType);
    const cap = capForGenType(mod.generationType);

    // Remove any existing selection from the same type + source (switching tiers)
    const existingOfType = [...next.values()].find((m) => m.type === mod.type && m.source === mod.source);
    if (existingOfType) {
      next.delete(existingOfType.id);
    } else if (count >= cap) {
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
              {(() => {
                const visible = [...new Set(
                  group.tiers[0].tags
                    .filter((t) => !HIDDEN_TAGS.has(t))
                    .map(canonTag)
                )];
                if (visible.length === 0) return null;
                return (
                  <span className={styles.groupTags}>
                    {visible.map((tag) => {
                      const c = tagColor(tag);
                      const style: React.CSSProperties = c
                        ? { color: c.fg, background: c.bg, borderColor: c.border, borderWidth: 1, borderStyle: "solid" }
                        : {};
                      return (
                        <span key={tag} className={styles.craftingTag} style={style}>{formatTag(tag)}</span>
                      );
                    })}
                  </span>
                );
              })()}
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
              const count = countForGenType(mod.generationType);
              const cap = capForGenType(mod.generationType);
              const atCap = !selectedTypes.has(mod.type) && count >= cap;

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
                  <span className={styles.tierNum}>
                    {mod.source === "essence" ? "ESS" : `T${group.tiers.length - i}`}
                  </span>
                  <span className={styles.tierName}>{mod.name}</span>
                  <span className={styles.tierText}>{cleanModText(mod.text)}</span>
                  <span className={styles.tierLevel}>
                    Lv{mod.requiredLevel}
                  </span>
                  <span className={styles.tierWeight} title="Spawn weight">
                    {modWeightOnItem(mod, item)}
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
      {/* Source tabs */}
      <div className={styles.sourceTabBar}>
        {SOURCE_TABS.map((t) => {
          const active = sourceTab === t.key;
          const themeClass = t.key === "desecrated"
            ? styles.sourceTabDesecrated
            : t.key === "corrupted"
              ? styles.sourceTabCorrupted
              : t.key === "essence"
                ? styles.sourceTabEssence
                : "";
          return (
            <button
              key={t.key}
              className={`${styles.sourceTab} ${themeClass} ${active ? styles.sourceTabActive : ""}`}
              onClick={() => setSourceTab(t.key)}
              disabled={sourceCounts[t.key] === 0}
            >
              {t.label}
              <span className={styles.sourceTabCount}>{sourceCounts[t.key]}</span>
            </button>
          );
        })}
      </div>

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
          className={`${styles.ilvlPreset} ${ilvl === item.dropLevel ? styles.ilvlPresetActive : ""}`}
          onClick={() => { setIlvlEnabled(true); setIlvl(item.dropLevel); }}
          title={`Base drop level: ${item.dropLevel}`}
        >
          Base
        </button>
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
          {(() => {
            // Bucket tags by group while preserving group order and intra-group sort order
            const buckets: string[][] = Array.from({ length: TAG_GROUPS.length + 1 }, () => []);
            for (const tag of availableTags) buckets[tagGroupIndex(tag)].push(tag);
            // Intra-group: preserve declared order when defined, else alphabetical
            buckets.forEach((bucket, i) => {
              if (i < TAG_GROUPS.length) {
                const order = TAG_GROUPS[i].tags;
                bucket.sort((a, b) => order.indexOf(a) - order.indexOf(b));
              } else {
                bucket.sort();
              }
            });

            const renderBtn = (tag: string) => {
              const isActive = activeTags.has(tag);
              const c = tagColor(tag);
              const style: React.CSSProperties = c && isActive
                ? { color: c.fg, background: c.bg, borderColor: c.border }
                : c
                  ? { color: c.fg, borderColor: c.border }
                  : {};
              return (
                <button
                  key={tag}
                  className={`${styles.tagFilterBtn} ${isActive ? styles.tagFilterBtnActive : ""}`}
                  style={style}
                  title={formatTagTitle(tag)}
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
            };

            const nonEmpty = buckets.map((b, i) => ({ tags: b, idx: i })).filter((b) => b.tags.length > 0);
            return nonEmpty.map((b, outerIdx) => (
              <span key={b.idx} className={styles.tagFilterGroup}>
                {outerIdx > 0 && <span className={styles.tagFilterDivider} aria-hidden />}
                {b.tags.map(renderBtn)}
              </span>
            ));
          })()}
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

      {sourceTab === "corrupted" ? (
        <div className={styles.columns}>
          <div className={styles.column}>
            <div className={styles.columnHeader}>Corrupted ({corruptedGroups.length})</div>
            <div className={styles.modList}>
              {renderGroups(corruptedGroups, corruptedGroupNums)}
            </div>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
