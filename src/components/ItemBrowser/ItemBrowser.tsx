import { useState, useMemo, useCallback, useRef } from "react";
import type { BaseItem, ItemMod, UniqueItem } from "../../types/itemDatabase";
import {
  ITEM_CLASS_GROUPS,
  ITEM_CLASS_DISPLAY_NAMES,
} from "../../types/itemDatabase";
import { itemsByClass, searchItems, itemById } from "../../data/items";
import { modById, cleanModText } from "../../data/mods";
import { getUniquesByClass } from "../../data/uniques";
import { useCustomizationsStore } from "../../store/customizationsStore";
import type { FavouriteCraft } from "../../types";
import { ItemGrid } from "./ItemGrid";
import { ItemDetail, type CraftState, type InitialCraftState } from "./ItemDetail";
import { confirmDialog } from "../Dialog/Dialog";
import { CraftEmulator } from "../CraftEmulator/CraftEmulator";
import styles from "./ItemBrowser.module.css";

/* ── Constants ────────────────────────────────────────────── */

type TabId = "Weapons" | "Armour" | "Jewelry" | "Off-hand";
const TABS: TabId[] = ["Weapons", "Armour", "Jewelry", "Off-hand"];

const DEFENCE_FILTERS: { tag: string; label: string }[] = [
  { tag: "str_armour", label: "Armour" },
  { tag: "dex_armour", label: "Evasion" },
  { tag: "int_armour", label: "Energy Shield" },
  { tag: "str_dex_armour", label: "Armour/Evasion" },
  { tag: "str_int_armour", label: "Armour/ES" },
  { tag: "dex_int_armour", label: "Evasion/ES" },
];

/* ── Helpers ──────────────────────────────────────────────── */

function displayName(cls: string): string {
  return ITEM_CLASS_DISPLAY_NAMES[cls] ?? cls + "s";
}

function tabForClass(cls: string): TabId {
  for (const [tab, classes] of Object.entries(ITEM_CLASS_GROUPS)) {
    if (classes.includes(cls)) return tab as TabId;
  }
  return "Weapons";
}

function firstSubCategory(tab: TabId): string {
  return ITEM_CLASS_GROUPS[tab][0];
}

function getDefenceFiltersForSlot(slot: string): { tag: string; label: string }[] {
  const items = itemsByClass.get(slot) ?? [];
  return DEFENCE_FILTERS.filter((f) =>
    items.some((item) => item.tags.includes(f.tag))
  );
}

/* ── Props ────────────────────────────────────────────────── */

interface ItemBrowserProps {
  onClose: () => void;
  onSelectItem?: (item: BaseItem) => void;
  onSelectUnique?: (unique: UniqueItem) => void;
  onSaveCraft?: (item: BaseItem, selectedMods: ItemMod[]) => void;
  onSaveCraftFull?: (item: BaseItem, mods: ItemMod[], craftState: CraftState) => void;
  initialItemClass?: string;
  allowedClasses?: string[];
}

/* ── Component ────────────────────────────────────────────── */

export function ItemBrowser({
  onClose,
  onSelectItem,
  onSelectUnique,
  onSaveCraft,
  onSaveCraftFull,
  initialItemClass,
  allowedClasses,
}: ItemBrowserProps) {
  // Derive initial tab + sub-category from initialItemClass or allowedClasses
  const initTab: TabId = initialItemClass
    ? tabForClass(initialItemClass)
    : allowedClasses?.length
      ? tabForClass(allowedClasses[0])
      : "Weapons";
  const initSub: string = initialItemClass
    ?? (allowedClasses?.length ? allowedClasses[0] : firstSubCategory(initTab));

  const [activeTab, setActiveTab] = useState<TabId>(initTab);
  const [activeSubCategory, setActiveSubCategory] = useState(initSub);
  const [defenceFilter, setDefenceFilter] = useState<string | null>(null);
  const [showUniques, setShowUniques] = useState(false);
  const [showTracked, setShowTracked] = useState(false);
  const [showFavourites, setShowFavourites] = useState(false);
  const [selectedItem, setSelectedItem] = useState<BaseItem | null>(null);
  const [selectedUnique, setSelectedUnique] = useState<UniqueItem | null>(null);
  const [restoreState, setRestoreState] = useState<{ favId: string; init: InitialCraftState } | null>(null);
  const [currentFavId, setCurrentFavId] = useState<string | null>(null);
  const [emulateBase, setEmulateBase] = useState<BaseItem | null>(null);
  const [search, setSearch] = useState("");
  const [craftMods, setCraftMods] = useState<ItemMod[]>([]);
  const craftStateRef = useRef<CraftState>({ quality: 20, modRolls: {}, augmentIds: [] });
  const watchlist = useCustomizationsStore((s) => s.watchlist ?? []);
  const favouriteCrafts = useCustomizationsStore((s) => s.favouriteCrafts ?? []);
  const addFavouriteCraft = useCustomizationsStore((s) => s.addFavouriteCraft);
  const removeFavouriteCraft = useCustomizationsStore((s) => s.removeFavouriteCraft);
  const trackedItemIds = new Set(watchlist.filter((w) => w.type === "item").map((w) => w.id));

  // Sub-categories: if allowedClasses provided, only show those; otherwise use tab groups
  const subCategories = allowedClasses ?? ITEM_CLASS_GROUPS[activeTab];

  // Unique items for current sub-category
  const uniqueItems = useMemo(() => {
    return getUniquesByClass(activeSubCategory);
  }, [activeSubCategory]);

  // Items for current view
  const filteredItems = useMemo(() => {
    if (showTracked) {
      return watchlist
        .filter((w) => w.type === "item")
        .map((w) => itemById.get(w.id))
        .filter(Boolean) as BaseItem[];
    }
    if (search.trim()) {
      let results = searchItems(search);
      if (allowedClasses) {
        const allowed = new Set(allowedClasses);
        results = results.filter((item) => allowed.has(item.itemClass));
      }
      return results;
    }
    if (showUniques) return []; // uniques shown separately
    let items = itemsByClass.get(activeSubCategory) ?? [];
    if (activeTab === "Armour" && defenceFilter) {
      items = items.filter((item) => item.tags.includes(defenceFilter));
    }
    return items;
  }, [search, activeSubCategory, activeTab, defenceFilter, showUniques, showTracked, allowedClasses, watchlist]);

  // Available defence filters for current armour slot
  const availableDefenceFilters = useMemo(() => {
    if (activeTab !== "Armour") return [];
    return getDefenceFiltersForSlot(activeSubCategory);
  }, [activeTab, activeSubCategory]);

  // Tab change
  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setActiveSubCategory(firstSubCategory(tab));
    setDefenceFilter(null);
    setShowUniques(false);
    setSelectedItem(null);
    setSelectedUnique(null);
    setSearch("");
  }, []);

  // Sub-category change
  const handleSubCategoryChange = useCallback((cls: string) => {
    setActiveSubCategory(cls);
    setDefenceFilter(null);
    setShowUniques(false);
    setSelectedItem(null);
    setSelectedUnique(null);
  }, []);

  // Item click
  const handleItemClick = useCallback((item: BaseItem) => {
    setSelectedItem(item);
    setRestoreState(null);
    setCurrentFavId(null);
  }, []);

  // Back from detail
  const handleBack = useCallback(() => {
    setSelectedItem(null);
    setSelectedUnique(null);
    setRestoreState(null);
    setCurrentFavId(null);
  }, []);

  // Favourite click → restore craft
  const handleFavouriteClick = useCallback((fav: FavouriteCraft) => {
    const item = itemById.get(fav.baseItemId);
    if (!item) return;
    setRestoreState({
      favId: fav.id,
      init: {
        selectedModIds: fav.selectedModIds,
        quality: fav.quality,
        modRolls: fav.modRolls,
        augmentIds: fav.augmentIds,
      },
    });
    setSelectedItem(item);
    setCurrentFavId(fav.id);
  }, []);

  // Toggle favourite on current craft
  const handleStarCraft = useCallback((baseItem: BaseItem, mods: ItemMod[], state: CraftState) => {
    if (currentFavId) {
      // Already favourited → remove
      removeFavouriteCraft(currentFavId);
      setCurrentFavId(null);
      return;
    }
    const entry: FavouriteCraft = {
      id: crypto.randomUUID(),
      baseItemId: baseItem.id,
      selectedModIds: mods.map((m) => m.id),
      quality: state.quality,
      modRolls: state.modRolls,
      augmentIds: state.augmentIds,
      createdAt: new Date().toISOString(),
    };
    addFavouriteCraft(entry);
    setCurrentFavId(entry.id);
  }, [addFavouriteCraft, removeFavouriteCraft, currentFavId]);

  const handleRemoveFavourite = useCallback(async (fav: FavouriteCraft) => {
    const item = itemById.get(fav.baseItemId);
    const name = item?.name ?? "this craft";
    if (await confirmDialog(`Remove "${name}" from favourites?`, { title: "Remove Favourite", confirmLabel: "Remove", danger: true })) {
      removeFavouriteCraft(fav.id);
    }
  }, [removeFavouriteCraft]);

  // Unique click
  const handleUniqueClick = useCallback((unique: UniqueItem) => {
    setSelectedUnique(unique);
  }, []);

  // Counts per sub-category
  const subCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cls of subCategories) {
      counts[cls] = (itemsByClass.get(cls) ?? []).length;
    }
    return counts;
  }, [subCategories]);

  const isSearching = search.trim().length > 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>Item Database</span>
        <div className={styles.searchWrap}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedItem(null);
              setSelectedUnique(null);
            }}
          />
        </div>
        <div className={styles.headerRight}>
          {favouriteCrafts.length > 0 && (
            <button
              className={`${styles.headerFavBtn} ${showFavourites ? styles.headerFavBtnActive : ""}`}
              onClick={() => {
                setShowFavourites(!showFavourites);
                setShowUniques(false);
                setShowTracked(false);
                setDefenceFilter(null);
                setSelectedItem(null);
                setSelectedUnique(null);
              }}
              title="Favourite crafts"
            >
              ★ {favouriteCrafts.length}
            </button>
          )}
          <button className={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>
      </div>

      {emulateBase && (
        <CraftEmulator base={emulateBase} onClose={() => setEmulateBase(null)} />
      )}

      {/* Top tabs (hidden when filtering to specific classes) */}
      {!allowedClasses && (
        <div className={styles.tabBar}>
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
              onClick={() => handleTabChange(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Body: sidebar + content */}
      <div className={styles.body}>
        {/* Sidebar — sub-categories */}
        {!isSearching && (
          <div className={styles.sidebar}>
            <div className={styles.sidebarList}>
              {subCategories.map((cls) => (
                <button
                  key={cls}
                  className={`${styles.subCatBtn} ${
                    activeSubCategory === cls ? styles.subCatBtnActive : ""
                  }`}
                  onClick={() => handleSubCategoryChange(cls)}
                >
                  <span className={styles.subCatName}>{displayName(cls)}</span>
                  <span className={styles.subCatCount}>
                    {subCategoryCounts[cls]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main content area */}
        <div className={styles.content}>
          {/* Filter row */}
          {!isSearching && !selectedItem && !selectedUnique && (
            <div className={styles.filterRow}>
              {/* Base items filter */}
              <button
                className={`${styles.filterBtn} ${
                  !showUniques && defenceFilter === null ? styles.filterBtnActive : ""
                }`}
                onClick={() => { setShowUniques(false); setShowTracked(false); setDefenceFilter(null); }}
              >
                All
              </button>

              {/* Defence type filters (armour tab only) */}
              {activeTab === "Armour" && availableDefenceFilters.map((f) => (
                <button
                  key={f.tag}
                  className={`${styles.filterBtn} ${
                    !showUniques && defenceFilter === f.tag ? styles.filterBtnActive : ""
                  }`}
                  onClick={() => {
                    setShowUniques(false);
                    setShowTracked(false);
                    setDefenceFilter(defenceFilter === f.tag ? null : f.tag);
                  }}
                >
                  {f.label}
                </button>
              ))}

              {/* Uniques filter */}
              {uniqueItems.length > 0 && (
                <button
                  className={`${styles.filterBtn} ${styles.filterBtnUniques} ${
                    showUniques ? styles.filterBtnActive : ""
                  }`}
                  onClick={() => {
                    setShowUniques(!showUniques);
                    setShowTracked(false);
                    setDefenceFilter(null);
                  }}
                >
                  Uniques ({uniqueItems.length})
                </button>
              )}

              {trackedItemIds.size > 0 && (
                <button
                  className={`${styles.filterBtn} ${styles.filterBtnUniques} ${
                    showTracked ? styles.filterBtnActive : ""
                  }`}
                  onClick={() => {
                    setShowTracked(!showTracked);
                    setShowUniques(false);
                    setShowFavourites(false);
                    setDefenceFilter(null);
                  }}
                >
                  Tracked ({trackedItemIds.size})
                </button>
              )}

            </div>
          )}

          {/* Grid or Detail */}
          <div className={styles.contentScroll}>
            {selectedItem ? (
              <div className={styles.detailView}>
                <div className={styles.detailTopBar}>
                  <button className={styles.backBtn} onClick={handleBack}>
                    &larr; Back to{" "}
                    {isSearching
                      ? "Results"
                      : displayName(activeSubCategory)}
                  </button>
                  <div className={styles.detailTopBarActions}>
                    <button
                      className={styles.emulateBtn}
                      onClick={() => setEmulateBase(selectedItem)}
                      title="Open craft emulator for this base"
                    >
                      ⚒ Emulate
                    </button>
                    <button
                      className={`${styles.starBtn} ${currentFavId ? styles.starBtnActive : ""}`}
                      disabled={!currentFavId && craftMods.length === 0}
                      title={
                        currentFavId
                          ? "Remove from Favourites"
                          : craftMods.length === 0
                            ? "Select at least one mod to favourite"
                            : "Save to Favourites"
                      }
                      onClick={() => handleStarCraft(selectedItem, craftMods, craftStateRef.current)}
                    >
                      {currentFavId ? "★ Favourited" : "☆ Favourite"}
                    </button>
                    {!onSelectItem && onSaveCraft && (
                      <button
                        className={styles.saveBuildBtn}
                        disabled={craftMods.length === 0}
                        onClick={() => onSaveCraft(selectedItem, craftMods)}
                      >
                        Save to Build Plan
                      </button>
                    )}
                    {onSelectItem && (
                      <button
                        className={styles.selectBtn}
                        onClick={() => {
                          if (onSaveCraftFull) {
                            onSaveCraftFull(selectedItem, craftMods, craftStateRef.current);
                          } else if (onSaveCraft && craftMods.length > 0) {
                            onSaveCraft(selectedItem, craftMods);
                          } else {
                            onSelectItem(selectedItem);
                          }
                        }}
                      >
                        Select
                      </button>
                    )}
                  </div>
                </div>
                <ItemDetail
                  key={restoreState?.favId ?? selectedItem.id}
                  item={selectedItem}
                  onModsChange={setCraftMods}
                  onCraftStateChange={(s) => { craftStateRef.current = s; }}
                  initialState={restoreState?.init}
                />
              </div>
            ) : selectedUnique ? (
              <div className={styles.detailView}>
                <div className={styles.detailTopBar}>
                  <button className={styles.backBtn} onClick={handleBack}>
                    &larr; Back to Uniques
                  </button>
                  {onSelectUnique && (
                    <button
                      className={styles.selectBtn}
                      onClick={() => onSelectUnique(selectedUnique)}
                    >
                      Select
                    </button>
                  )}
                </div>
                <div className={styles.uniqueDetail}>
                  <div className={styles.uniqueDetailCard}>
                    {selectedUnique.iconPath ? (
                      <img
                        className={styles.uniqueDetailIcon}
                        src={`/assets/${selectedUnique.iconPath}`}
                        alt={selectedUnique.name}
                      />
                    ) : (
                      <div className={styles.uniqueIconFallback}>?</div>
                    )}
                    <div className={styles.uniqueDetailInfo}>
                      <div className={styles.uniqueDetailName}>
                        {selectedUnique.name}
                      </div>
                      <div className={styles.uniqueDetailClass}>
                        {displayName(selectedUnique.itemClass)}
                      </div>
                      {selectedUnique.mods.length > 0 && (
                        <div className={styles.uniqueDetailMods}>
                          {selectedUnique.mods.map((mod, i) => (
                            <div key={i} className={styles.uniqueDetailMod}>
                              {mod}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : showFavourites ? (
              <div className={styles.uniquesGrid}>
                {favouriteCrafts.map((fav) => {
                  const base = itemById.get(fav.baseItemId);
                  if (!base) return null;
                  const genOrder = { prefix: 0, suffix: 1, corrupted: 2 } as const;
                  const modLines = fav.selectedModIds
                    .map((id) => modById.get(id))
                    .filter(Boolean)
                    .sort((a, b) => genOrder[a!.generationType] - genOrder[b!.generationType])
                    .map((m) => m!.text);
                  return (
                    <div
                      key={fav.id}
                      className={styles.uniqueCard}
                      onClick={() => handleFavouriteClick(fav)}
                      onContextMenu={(e) => { e.preventDefault(); handleRemoveFavourite(fav); }}
                      title="Click to open · Right-click to remove"
                    >
                      <div className={styles.uniqueIconWrap}>
                        {base.iconPath ? (
                          <img
                            className={styles.uniqueIcon}
                            src={`/assets/${base.iconPath}`}
                            alt={base.name}
                            loading="lazy"
                          />
                        ) : (
                          <div className={styles.uniqueIconFallback}>?</div>
                        )}
                      </div>
                      <div className={styles.uniqueName}>{base.name}</div>
                      {modLines.length > 0 && (
                        <div className={styles.uniqueMods}>
                          {modLines.slice(0, 4).map((t, i) => (
                            <div key={i} className={styles.uniqueMod}>{cleanModText(t)}</div>
                          ))}
                          {modLines.length > 4 && (
                            <div className={styles.uniqueMod} style={{ opacity: 0.5 }}>+{modLines.length - 4} more</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : showUniques ? (
              <div className={styles.uniquesGrid}>
                {uniqueItems.map((u) => (
                  <div
                    key={u.id}
                    className={styles.uniqueCard}
                    onClick={() => handleUniqueClick(u)}
                  >
                    <div className={styles.uniqueIconWrap}>
                      {u.iconPath ? (
                        <img
                          className={styles.uniqueIcon}
                          src={`/assets/${u.iconPath}`}
                          alt={u.name}
                          loading="lazy"
                        />
                      ) : (
                        <div className={styles.uniqueIconFallback}>?</div>
                      )}
                    </div>
                    <div className={styles.uniqueName}>{u.name}</div>
                    {u.mods.length > 0 && (
                      <div className={styles.uniqueMods}>
                        {u.mods.map((mod, i) => (
                          <div key={i} className={styles.uniqueMod}>{mod}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <ItemGrid
                items={filteredItems}
                selectedItemId={null}
                onSelectItem={handleItemClick}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
