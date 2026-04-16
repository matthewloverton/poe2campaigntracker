import { useState } from "react";
import { useGuidesStore } from "../../store/guidesStore";
import { useGuideStore } from "../../store/guideStore";
import { guidePages, storedGuideToPages } from "../../data/guide";
import type { GuideEditorSelection } from "./GuideEditor";
import styles from "./GuideTree.module.css";

interface Props {
  selection: GuideEditorSelection;
  onSelect: (s: GuideEditorSelection) => void;
}

export function GuideTree({ selection, onSelect }: Props) {
  const guides = useGuidesStore((s) => s.guides);
  const createFromDefault = useGuidesStore((s) => s.createGuideFromDefault);
  const activeGuideId = useGuideStore((s) => s.activeGuide);
  const [expandedGuides, setExpandedGuides] = useState<Set<string>>(new Set());
  const [expandedActs, setExpandedActs] = useState<Set<string>>(new Set()); // key "guideId:act"

  function toggleGuide(id: string) {
    setExpandedGuides((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAct(guideId: string, act: number) {
    const key = `${guideId}:${act}`;
    setExpandedActs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Acts present in the bundled default guide (1-7 game acts/postgame, but only those with pages)
  const defaultActs = Array.from({ length: 7 }, (_, i) => i + 1).filter((act) =>
    guidePages.some((p) => p.act === act),
  );

  const renderGuideNode = (
    id: string,
    name: string,
    acts: { act: number; pages: { entryIdx: number; label: string }[] }[],
    readOnly: boolean,
  ) => {
    const expanded = expandedGuides.has(id);
    const isActive = activeGuideId === id;
    return (
      <div key={id} className={styles.guideNode}>
        <div
          className={`${styles.guideHeader} ${selection.guideId === id && selection.act == null ? styles.selected : ""}`}
          onClick={() => onSelect({ guideId: id, act: null, entryIdx: null })}
        >
          <button
            className={styles.expandBtn}
            onClick={(e) => { e.stopPropagation(); toggleGuide(id); }}
          >
            {expanded ? "▾" : "▸"}
          </button>
          <span className={styles.guideName}>{name}</span>
          {readOnly && <span className={styles.lockIcon}>🔒</span>}
          {isActive && <span className={styles.activeBadge}>● playing</span>}
        </div>
        {expanded && acts.map(({ act, pages }) => {
          const actKey = `${id}:${act}`;
          const actExpanded = expandedActs.has(actKey);
          const label = act <= 4 ? `Act ${act}` : `Postgame ${act - 4}`;
          return (
            <div key={act} className={styles.actNode}>
              <div
                className={`${styles.actHeader} ${selection.guideId === id && selection.act === act && selection.entryIdx == null ? styles.selected : ""}`}
                onClick={() => onSelect({ guideId: id, act, entryIdx: null })}
              >
                <button
                  className={styles.expandBtn}
                  onClick={(e) => { e.stopPropagation(); toggleAct(id, act); }}
                >
                  {actExpanded ? "▾" : "▸"}
                </button>
                <span className={styles.actName}>{label}</span>
              </div>
              {actExpanded && pages.map((p) => (
                <div
                  key={p.entryIdx}
                  className={`${styles.pageNode} ${selection.guideId === id && selection.act === act && selection.entryIdx === p.entryIdx ? styles.selected : ""}`}
                  onClick={() => onSelect({ guideId: id, act, entryIdx: p.entryIdx })}
                >
                  <span className={styles.pageLabel}>{p.label || "(empty)"}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  /** Page is labelled by the zone you START in (= prior page's destination). */
  function startZoneLabel(
    flatPages: { act: number; pageIndex: number; targetZoneName: string }[],
    act: number,
    pageIndex: number,
  ): string {
    const idx = flatPages.findIndex(
      (p) => p.act === act && p.pageIndex === pageIndex,
    );
    if (idx <= 0) return "the riverbank";
    return flatPages[idx - 1].targetZoneName ?? "";
  }

  return (
    <div className={styles.tree}>
      {/* Default guide */}
      {renderGuideNode(
        "default",
        "Default",
        defaultActs.map((act) => ({
          act,
          pages: guidePages
            .filter((p) => p.act === act)
            .map((_p, i) => ({
              entryIdx: i,
              label: startZoneLabel(guidePages, act, i),
            })),
        })),
        true,
      )}

      {/* User guides */}
      {guides.map((g) => {
        const derived = storedGuideToPages(g);
        const actNumbers = Array.from(new Set(derived.map((p) => p.act))).sort((a, b) => a - b);
        return renderGuideNode(
          g.id,
          g.name,
          actNumbers.map((act) => ({
            act,
            pages: g.acts[act - 1]?.entries.map((_, i) => ({
              entryIdx: i,
              label: startZoneLabel(derived, act, i),
            })) ?? [],
          })),
          false,
        );
      })}

      <button
        className={styles.newGuideBtn}
        onClick={() => {
          const id = createFromDefault("New Guide");
          onSelect({ guideId: id, act: null, entryIdx: null });
          setExpandedGuides((s) => new Set(s).add(id));
        }}
      >
        + New Guide (from Default)
      </button>

      <button
        className={styles.newGuideBtn}
        onClick={() => {
          const raw = prompt("Paste guide JSON:");
          if (!raw) return;
          const id = useGuidesStore.getState().importGuide(raw);
          if (id) {
            onSelect({ guideId: id, act: null, entryIdx: null });
          } else {
            alert("Invalid guide JSON.");
          }
        }}
      >
        Import Guide
      </button>
    </div>
  );
}
