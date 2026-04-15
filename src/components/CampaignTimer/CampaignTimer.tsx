import { useState } from "react";
import { useTimerStore } from "../../store/timerStore";
import { useTimerTick, formatTime } from "../../hooks/useTimer";
import styles from "./CampaignTimer.module.css";

export function CampaignTimer() {
  const timerState = useTimerStore((s) => s.state);
  const currentAct = useTimerStore((s) => s.currentAct);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const reset = useTimerStore((s) => s.reset);
  const actSplits = useTimerStore((s) => s.actSplits);
  const elapsed = useTimerTick();
  const [showSplits, setShowSplits] = useState(false);

  const currentActSplit = actSplits[currentAct];
  const actElapsed =
    currentActSplit && timerState === "running"
      ? Date.now() - currentActSplit.startedAt
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
                if (confirm("Reset timer?")) reset();
              }}
              title="Reset"
            >
              ↺
            </button>
          )}
        </div>
      </div>

      {showSplits && completedSplits.length > 0 && (
        <div className={styles.splits}>
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
