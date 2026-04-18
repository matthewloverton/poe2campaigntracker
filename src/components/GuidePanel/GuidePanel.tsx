import { useState, useEffect, useRef, createRef } from "react";
import { useGuideStore } from "../../store/guideStore";
import { areaById, areaByName } from "../../data/areas";
import { getZoneLayouts } from "../../data/zoneLayouts";
import { StepRenderer } from "../StepRenderer";
import { InlineNote } from "../InlineNote/InlineNote";
import { StepReminder, type StepReminderHandle } from "../StepReminder/StepReminder";
import styles from "./GuidePanel.module.css";

export function GuidePanel() {
  const { pages, currentPageIndex, nextPage, prevPage, goToAct } = useGuideStore();
  const currentZoneId = useGuideStore((s) => s.currentZoneId);
  const currentPage = pages[currentPageIndex];

  const [editingNoteStep, setEditingNoteStep] = useState<number | null>(null);
  const [openReminderStep, setOpenReminderStep] = useState<number | null>(null);
  const [layoutIndex, setLayoutIndex] = useState(0);
  const reminderRefs = useRef<React.RefObject<StepReminderHandle | null>[]>([]);

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

  const formatRec = (rec?: { min: number; max: number }): string | null => {
    if (!rec) return null;
    return rec.min === rec.max ? `${rec.min}` : `${rec.min}-${rec.max}`;
  };
  const currentArea = currentZoneName ? areaByName.get(currentZoneName.toLowerCase()) : undefined;
  const destArea = destinationName ? areaByName.get(destinationName.toLowerCase()) : undefined;
  const currentRec = formatRec(currentArea?.recommendation);
  const destRec = formatRec(destArea?.recommendation);

  // Reset carousel when zone changes
  useEffect(() => { setLayoutIndex(0); }, [currentZoneName]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.actLabel}>{actLabel}</span>
          <span className={styles.pageInfo}>Page {currentPageIndex + 1} / {pages.length}</span>
        </div>
        <div className={styles.zoneRow}>
          <div className={`${styles.zonePill} ${styles.zoneCurrent}`}>
            <span className={styles.zoneName}>{currentZoneName || "Unknown"}</span>
            <span className={styles.zoneLevel}>{currentRec ? `(${currentRec})` : "(—)"}</span>
          </div>
          <span className={styles.zoneArrow}>→</span>
          <div className={`${styles.zonePill} ${styles.zoneDest}`}>
            <span className={styles.zoneName}>{destinationName || "?"}</span>
            <span className={styles.zoneLevel}>{destRec ? `(${destRec})` : "(—)"}</span>
          </div>
        </div>
      </div>
      <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${progress}%` }} /></div>
      <div className={styles.steps}>
        {(() => {
          // Ensure refs array matches step count
          while (reminderRefs.current.length < currentPage.steps.length) {
            reminderRefs.current.push(createRef());
          }
          return null;
        })()}
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
              <StepReminder
                ref={reminderRefs.current[i]}
                pageIndex={currentPage.globalIndex}
                stepIndex={i}
                onOpenChange={(open) => setOpenReminderStep(open ? i : null)}
              />
              {openReminderStep !== i && (
                <div className={styles.insertLine}>
                  <button
                    className={styles.insertBtn}
                    onClick={() => reminderRefs.current[i]?.current?.openForm()}
                    tabIndex={-1}
                    title="Add reminder"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              )}
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
