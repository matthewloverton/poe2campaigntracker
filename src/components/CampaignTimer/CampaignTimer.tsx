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

  const currentActSplit = actSplits[currentAct];
  const actElapsed =
    currentActSplit && timerState === "running"
      ? Date.now() - currentActSplit.startedAt
      : 0;

  return (
    <div className={styles.timer}>
      <span className={styles.time}>{formatTime(elapsed)}</span>
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
  );
}
