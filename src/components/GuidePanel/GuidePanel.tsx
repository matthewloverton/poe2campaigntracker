import { useState, useEffect } from "react";
import { useGuideStore } from "../../store/guideStore";
import { areaById } from "../../data/areas";
import { getZoneLayouts } from "../../data/zoneLayouts";
import { StepRenderer } from "../StepRenderer";
import { InlineNote } from "../InlineNote/InlineNote";
import { StepReminder } from "../StepReminder/StepReminder";
import styles from "./GuidePanel.module.css";
import noteStyles from "../InlineNote/InlineNote.module.css";

export function GuidePanel() {
  const { pages, currentPageIndex, nextPage, prevPage, goToAct } = useGuideStore();
  const currentZoneId = useGuideStore((s) => s.currentZoneId);
  const currentPage = pages[currentPageIndex];

  // Track which step index is being forced into note-edit mode
  const [editingNoteStep, setEditingNoteStep] = useState<number | null>(null);
  const [layoutIndex, setLayoutIndex] = useState(0);

  if (!currentPage) return <div className={styles.panel}>No guide data loaded.</div>;

  const progress = ((currentPageIndex + 1) / pages.length) * 100;
  const actLabel = currentPage.act <= 4 ? `Act ${currentPage.act}` : `Postgame ${currentPage.act - 4}`;

  // Current zone from log watcher, or previous page's target, or "the riverbank" for page 1
  const currentZoneName = currentZoneId
    ? areaById.get(currentZoneId)?.name
    : currentPageIndex > 0
      ? pages[currentPageIndex - 1].targetZoneName
      : "the riverbank";
  const destinationName = currentPage.targetZoneName;
  const layoutImages = currentZoneName ? getZoneLayouts(currentZoneName) : [];

  // Reset carousel when zone changes
  useEffect(() => { setLayoutIndex(0); }, [currentZoneName]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.actZone}>
          <span className={styles.actLabel}>{actLabel}</span>
          {currentZoneName ? (
            <>
              <span className={styles.currentZone}>{currentZoneName}</span>
              <span className={styles.arrow}>→</span>
              <span className={styles.destZone}>{destinationName || "?"}</span>
            </>
          ) : (
            <span className={styles.destZone}>{destinationName || "Unknown Zone"}</span>
          )}
        </div>
        <div className={styles.pageInfo}>Page {currentPageIndex + 1} / {pages.length}</div>
      </div>
      <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${progress}%` }} /></div>
      <div className={styles.steps}>
        {currentPage.steps.map((step, i) => {
          const isOptional = step.raw.startsWith("optional:");
          // Check if this hint follows an optional step
          const prevStep = i > 0 ? currentPage.steps[i - 1] : null;
          const isOptionalHint = step.isHint && prevStep != null &&
            (prevStep.raw.startsWith("optional:") || prevStep.isHint);
          const isForceEdit = editingNoteStep === i;
          return (
            <div key={i} className={styles.stepWrapper}>
              <StepRenderer
                tokens={step.tokens}
                isHint={step.isHint}
                isOptional={isOptional}
                isOptionalHint={isOptionalHint}
                isLast={i === currentPage.steps.length - 1}
              />
              <InlineNote
                pageIndex={currentPage.globalIndex}
                stepIndex={i}
                forceEdit={isForceEdit}
                onEditDone={() => setEditingNoteStep(null)}
              />
              <button
                className={noteStyles.addNoteBtn}
                onClick={() => setEditingNoteStep(i)}
                tabIndex={-1}
              >
                + add note
              </button>
              <StepReminder pageIndex={currentPage.globalIndex} stepIndex={i} />
            </div>
          );
        })}
      </div>
      {layoutImages.length > 0 && (
        <div className={styles.layoutSection}>
          <div className={styles.layoutHeader}>
            <span>Zone Layout</span>
            {layoutImages.length > 1 && (
              <span className={styles.layoutCount}>{(layoutIndex % layoutImages.length) + 1}/{layoutImages.length}</span>
            )}
          </div>
          <div className={styles.layoutImageWrap}>
            {layoutImages.length > 1 && (
              <button
                className={`${styles.layoutNavBtn} ${styles.layoutNavBtnLeft}`}
                onClick={() => setLayoutIndex((layoutIndex - 1 + layoutImages.length) % layoutImages.length)}
              >
                ◀
              </button>
            )}
            <img
              className={styles.layoutImage}
              src={layoutImages[layoutIndex % layoutImages.length]}
              alt="Zone layout"
            />
            {layoutImages.length > 1 && (
              <button
                className={`${styles.layoutNavBtn} ${styles.layoutNavBtnRight}`}
                onClick={() => setLayoutIndex((layoutIndex + 1) % layoutImages.length)}
              >
                ▶
              </button>
            )}
          </div>
        </div>
      )}
      <div className={styles.nav}>
        <button className={styles.navBtn} onClick={prevPage} disabled={currentPageIndex === 0}>◀ Prev</button>
        <select className={styles.actSelect} value={currentPage.act} onChange={(e) => goToAct(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 7].map((act) => (
            <option key={act} value={act}>{act <= 4 ? `Act ${act}` : `Postgame ${act - 4}`}</option>
          ))}
        </select>
        <button className={styles.navBtn} onClick={nextPage} disabled={currentPageIndex === pages.length - 1}>Next ▶</button>
      </div>
    </div>
  );
}
