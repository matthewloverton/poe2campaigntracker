import { useState } from "react";
import { useTimerStore } from "../../store/timerStore";
import { useLevelStore } from "../../store/levelStore";
import { useTimerTick, formatTime } from "../../hooks/useTimer";
import styles from "./CampaignTimer.module.css";

interface CampaignTimerProps {
  onShowHistory?: () => void;
}

export function CampaignTimer({ onShowHistory }: CampaignTimerProps) {
  const timerState = useTimerStore((s) => s.state);
  const currentAct = useTimerStore((s) => s.currentAct);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const reset = useTimerStore((s) => s.reset);
  const actSplits = useTimerStore((s) => s.actSplits);
  const runCount = useTimerStore((s) => s.runHistory.length);
  const characterName = useLevelStore((s) => s.characterName);
  const characterClass = useLevelStore((s) => s.characterClass);
  const level = useLevelStore((s) => s.level);
  const elapsed = useTimerTick();
  const [showSplits, setShowSplits] = useState(false);

  const currentActSplit = actSplits[currentAct];
  // Derive act-elapsed from total-elapsed so pauses are excluded consistently.
  // Floor both sides to whole seconds so the act display ticks on the same
  // second boundaries as the total display (prevents phase-offset flicker).
  const actElapsed =
    currentActSplit && timerState !== "stopped"
      ? Math.max(
          0,
          (Math.floor(elapsed / 1000) -
            Math.floor((currentActSplit.startedAtTotal ?? 0) / 1000)) *
            1000,
        )
      : 0;

  const completedSplits = Object.entries(actSplits)
    .map(([act, split]) => ({ act: Number(act), ...split }))
    .filter((s) => s.elapsed != null)
    .sort((a, b) => a.act - b.act);

  return (
    <div className={styles.wrapper}>
      <div className={styles.timer}>
        <span
          className={styles.time}
          onClick={() => setShowSplits(!showSplits)}
          style={{ cursor: "pointer" }}
          title="Click to view splits"
        >
          {formatTime(elapsed)}
        </span>
        <span className={styles.divider}>|</span>
        <span className={styles.act}>A{currentAct}</span>
        <span className={styles.divider}>|</span>
        <span className={styles.actTime}>{formatTime(actElapsed)}</span>
        <div className={styles.controls}>
          {timerState === "stopped" && (
            <button className={styles.btn} onClick={start} title="Start">
              ▶
            </button>
          )}
          {timerState === "running" && (
            <button className={styles.btn} onClick={pause} title="Pause">
              ⏸
            </button>
          )}
          {timerState === "paused" && (
            <button className={styles.btn} onClick={resume} title="Resume">
              ▶
            </button>
          )}
          {timerState !== "stopped" && (
            <button
              className={styles.btn}
              onClick={() => {
                if (confirm("Reset timer and save run?")) {
                  reset(characterName, characterClass, level);
                }
              }}
              title="Reset & save run"
            >
              ↺
            </button>
          )}
          {(runCount > 0 || timerState === "stopped") && onShowHistory && (
            <button
              className={styles.btn}
              onClick={onShowHistory}
              title="Run history"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showSplits && completedSplits.length > 0 && (
        <div className={styles.splitsDropdown}>
          {completedSplits.map((s) => (
            <div key={s.act} className={styles.splitRow}>
              <span className={styles.splitAct}>Act {s.act}</span>
              <span className={styles.splitTime}>{formatTime(s.elapsed!)}</span>
            </div>
          ))}
          {timerState !== "stopped" && (
            <div className={`${styles.splitRow} ${styles.splitCurrent}`}>
              <span className={styles.splitAct}>Act {currentAct}</span>
              <span className={styles.splitTime}>{formatTime(actElapsed)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
