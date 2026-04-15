import { useState, useMemo, useCallback, useRef } from "react";
import type { GemEntry } from "../../types/itemDatabase";
import {
  GEM_CRAFTING_TYPE_LABELS,
} from "../../types/itemDatabase";
import { searchGems, gemById } from "../../data/gems";
import { useCustomizationsStore } from "../../store/customizationsStore";
import { GemGrid } from "./GemGrid";
import { GemDetail } from "./GemDetail";
import styles from "./GemBrowser.module.css";

type SidebarCategory =
  | { kind: "skills"; craftingType: string | null }
  | { kind: "supports"; craftingType: string | null }
  | { kind: "lineage" };

interface GemBrowserProps {
  onClose: () => void;
  onSelectGem?: (gem: GemEntry) => void;
  defaultSection?: "skills" | "supports" | "lineage";
  selectLabel?: string;
}

const CRAFTING_TYPE_KEYS = Object.keys(GEM_CRAFTING_TYPE_LABELS);

function isLineage(gem: GemEntry): boolean {
  return gem.tags.includes("lineage");
}

function categoryKey(cat: SidebarCategory): string {
  if (cat.kind === "lineage") return "lineage";
  return `${cat.kind}:${cat.craftingType ?? "all"}`;
}

export function GemBrowser({ onClose, onSelectGem, defaultSection, selectLabel }: GemBrowserProps) {
  const lockedSection = defaultSection ?? null; // null = show all sections
  const [query, setQuery] = useState("");
  const initSection = defaultSection ?? "skills";
  const initCategory: SidebarCategory = initSection === "lineage"
    ? { kind: "lineage" }
    : { kind: initSection, craftingType: null };
  const [category, setCategory] = useState<SidebarCategory>(initCategory);
  const [selectedGem, setSelectedGem] = useState<GemEntry | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [showTracked, setShowTracked] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const watchlist = useCustomizationsStore((s) => s.watchlist ?? []);
  const trackedGemIds = new Set(watchlist.filter((w) => w.type === "gem").map((w) => w.id));

  const filteredGems = useMemo(() => {
    if (showTracked) {
      return watchlist
        .filter((w) => w.type === "gem")
        .map((w) => gemById.get(w.id))
        .filter(Boolean) as GemEntry[];
    }
    if (query.trim()) {
      return searchGems(query);
    }

    if (category.kind === "lineage") {
      return searchGems("").filter((g) => isLineage(g));
    }

    const isSkills = category.kind === "skills";
    const results = searchGems("", {
      craftingType: category.craftingType ?? undefined,
    });

    if (isSkills) {
      return results.filter((g) => (g.gemType === "active" || g.gemType === "spirit") && !isLineage(g));
    } else {
      return results.filter((g) => g.gemType === "support" && !isLineage(g));
    }
  }, [query, category, showTracked, watchlist]);

  // Counts for sidebar
  const counts = useMemo(() => {
    const all = searchGems("");
    const skills = all.filter((g) => (g.gemType === "active" || g.gemType === "spirit") && !isLineage(g));
    const supports = all.filter((g) => g.gemType === "support" && !isLineage(g));
    const lineageGems = all.filter((g) => isLineage(g));

    const result: Record<string, number> = {
      "skills:all": skills.length,
      "supports:all": supports.length,
      lineage: lineageGems.length,
    };
    for (const ct of CRAFTING_TYPE_KEYS) {
      result[`skills:${ct}`] = skills.filter((g) => g.craftingTypes.includes(ct)).length;
      result[`supports:${ct}`] = supports.filter((g) => g.craftingTypes.includes(ct)).length;
    }
    return result;
  }, []);

  const handleClickGem = useCallback((gem: GemEntry, e: React.MouseEvent) => {
    if (selectedGem?.id === gem.id) {
      setSelectedGem(null);
      setTooltipPos(null);
      return;
    }
    setTooltipPos({ x: e.clientX, y: e.clientY });
    setSelectedGem(gem);
  }, [selectedGem]);

  const handleCloseDetail = useCallback(() => {
    setSelectedGem(null);
    setTooltipPos(null);
  }, []);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  const activeKey = categoryKey(category);

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} ref={modalRef}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>Gem Database</span>
          <div className={styles.headerControls}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search gems..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowTracked(false); }}
            />
            {trackedGemIds.size > 0 && (
              <button
                className={`${styles.segBtn} ${showTracked ? styles.segBtnActive : ""}`}
                onClick={() => { setShowTracked(!showTracked); setQuery(""); }}
              >
                Tracked ({trackedGemIds.size})
              </button>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose} type="button">
            &times;
          </button>
        </div>

        {/* Body: sidebar + grid */}
        <div className={styles.body}>
          <div className={styles.sidebar}>
            {/* Skills section */}
            {(!lockedSection || lockedSection === "skills") && <>
            <div className={styles.sidebarSection}>Skills</div>
            <button
              className={`${styles.sidebarBtn} ${activeKey === "skills:all" ? styles.sidebarBtnActive : ""}`}
              onClick={() => setCategory({ kind: "skills", craftingType: null })}
            >
              <span className={styles.sidebarName}>All Skills</span>
              <span className={styles.sidebarCount}>{counts["skills:all"]}</span>
            </button>
            {CRAFTING_TYPE_KEYS.map((ct) => (
              counts[`skills:${ct}`] > 0 && (
                <button
                  key={`skills:${ct}`}
                  className={`${styles.sidebarBtn} ${activeKey === `skills:${ct}` ? styles.sidebarBtnActive : ""}`}
                  onClick={() => setCategory({ kind: "skills", craftingType: ct })}
                >
                  <span className={styles.sidebarName}>{GEM_CRAFTING_TYPE_LABELS[ct]}</span>
                  <span className={styles.sidebarCount}>{counts[`skills:${ct}`]}</span>
                </button>
              )
            ))}

            </>}

            {/* Supports section */}
            {(!lockedSection || lockedSection === "supports") && <>
            <div className={styles.sidebarSection}>Supports</div>
            <button
              className={`${styles.sidebarBtn} ${activeKey === "supports:all" ? styles.sidebarBtnActive : ""}`}
              onClick={() => setCategory({ kind: "supports", craftingType: null })}
            >
              <span className={styles.sidebarName}>All Supports</span>
              <span className={styles.sidebarCount}>{counts["supports:all"]}</span>
            </button>
            {CRAFTING_TYPE_KEYS.map((ct) => (
              counts[`supports:${ct}`] > 0 && (
                <button
                  key={`supports:${ct}`}
                  className={`${styles.sidebarBtn} ${activeKey === `supports:${ct}` ? styles.sidebarBtnActive : ""}`}
                  onClick={() => setCategory({ kind: "supports", craftingType: ct })}
                >
                  <span className={styles.sidebarName}>{GEM_CRAFTING_TYPE_LABELS[ct]}</span>
                  <span className={styles.sidebarCount}>{counts[`supports:${ct}`]}</span>
                </button>
              )
            ))}

            </>}

            {/* Lineage supports */}
            {(!lockedSection || lockedSection === "supports") && <>
            <div className={styles.sidebarSection}>Lineage</div>
            <button
              className={`${styles.sidebarBtn} ${activeKey === "lineage" ? styles.sidebarBtnActive : ""}`}
              onClick={() => setCategory({ kind: "lineage" })}
            >
              <span className={styles.sidebarName}>Lineage Supports</span>
              <span className={styles.sidebarCount}>{counts.lineage}</span>
            </button>
            </>}
          </div>

          <div className={styles.content}>
            <div className={styles.gridScroll}>
              <GemGrid
                gems={filteredGems}
                selectedGemId={selectedGem?.id ?? null}
                onSelectGem={handleClickGem}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating tooltip */}
      {selectedGem && tooltipPos && (
        <div className={styles.tooltipOverlay}>
          <div
            className={styles.tooltipPane}
            style={{
              left: modalRef.current ? modalRef.current.getBoundingClientRect().right + 8 : undefined,
              top: modalRef.current ? modalRef.current.getBoundingClientRect().top : 10,
              maxHeight: modalRef.current ? modalRef.current.getBoundingClientRect().height : window.innerHeight - 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <GemDetail
              gem={selectedGem}
              onClose={handleCloseDetail}
              onAddToBuild={onSelectGem ? (gem) => onSelectGem(gem) : undefined}
              addLabel={selectLabel}
            />
          </div>
        </div>
      )}
    </div>
  );
}
