import { useState, useMemo } from "react";
import { useTimerStore } from "../../store/timerStore";
import { formatTime } from "../../hooks/useTimer";
import type { CompletedRun } from "../../types";
import { confirmDialog } from "../Dialog/Dialog";
import styles from "./RunHistory.module.css";

interface RunHistoryProps {
  onClose: () => void;
}

type SortMode = "recent" | "fastest";

export function RunHistory({ onClose }: RunHistoryProps) {
  const runs = useTimerStore((s) => s.runHistory);
  const deleteRun = useTimerStore((s) => s.deleteRun);
  const [sortMode, setSortMode] = useState<SortMode>("recent");

  const allActs = useMemo(() => {
    const acts = new Set<number>();
    for (const r of runs) {
      for (const key of Object.keys(r.actSplits)) {
        const n = Number(key);
        if (!Number.isNaN(n)) acts.add(n);
      }
    }
    return Array.from(acts).sort((a, b) => a - b);
  }, [runs]);

  const sortedRuns = useMemo(() => {
    const copy = [...runs];
    if (sortMode === "fastest") {
      copy.sort((a, b) => a.totalElapsed - b.totalElapsed);
    } else {
      copy.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    }
    return copy;
  }, [runs, sortMode]);

  const bestTotal = useMemo(
    () =>
      runs.length > 0 ? Math.min(...runs.map((r) => r.totalElapsed)) : null,
    [runs],
  );

  const bestPerAct = useMemo(() => {
    const best: Record<number, number> = {};
    const worst: Record<number, number> = {};
    for (const act of allActs) {
      for (const r of runs) {
        const split = r.actSplits[act];
        if (split?.elapsed == null) continue;
        if (best[act] == null || split.elapsed < best[act]) best[act] = split.elapsed;
        if (worst[act] == null || split.elapsed > worst[act]) worst[act] = split.elapsed;
      }
    }
    return { best, worst };
  }, [runs, allActs]);

  async function handleDelete(e: React.MouseEvent, runId: string) {
    e.stopPropagation();
    if (await confirmDialog("Delete this run?", { title: "Delete Run", confirmLabel: "Delete", danger: true })) {
      deleteRun(runId);
    }
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function splitClass(act: number, elapsed: number | null): string {
    if (elapsed == null) return "";
    if (runs.length < 2) return "";
    if (bestPerAct.best[act] === elapsed) return styles.splitBest;
    if (bestPerAct.worst[act] === elapsed) return styles.splitWorst;
    return "";
  }

  // Dynamic grid columns: total | date | character | level | (acts...) | delete
  const gridCols = [
    "110px",
    "120px",
    "minmax(160px, 1fr)",
    "48px",
    ...allActs.map(() => "76px"),
    "36px",
  ].join(" ");

  const rowStyle = { gridTemplateColumns: gridCols } as React.CSSProperties;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Run History</span>
        <div className={styles.sortBar}>
          <button
            className={`${styles.sortBtn} ${sortMode === "recent" ? styles.sortBtnActive : ""}`}
            onClick={() => setSortMode("recent")}
          >
            Most Recent
          </button>
          <button
            className={`${styles.sortBtn} ${sortMode === "fastest" ? styles.sortBtnActive : ""}`}
            onClick={() => setSortMode("fastest")}
          >
            Fastest
          </button>
        </div>
        <span className={styles.count}>
          {runs.length} run{runs.length !== 1 ? "s" : ""}
        </span>
        <button className={styles.closeBtn} onClick={onClose}>
          &times;
        </button>
      </div>

      <div className={styles.body}>
        {runs.length === 0 ? (
          <div className={styles.empty}>
            No completed runs yet. Finish a run and reset the timer to save it.
          </div>
        ) : (
          <div className={styles.table}>
            <div className={styles.headerRow} style={rowStyle}>
              <div className={styles.cellHead}>Total</div>
              <div className={styles.cellHead}>Date</div>
              <div className={styles.cellHead}>Character</div>
              <div className={`${styles.cellHead} ${styles.cellCenter}`}>Lv</div>
              {allActs.map((act) => (
                <div
                  key={act}
                  className={`${styles.cellHead} ${styles.cellCenter}`}
                >
                  A{act}
                </div>
              ))}
              <div className={styles.cellHead}></div>
            </div>

            {sortedRuns.map((run: CompletedRun) => {
              const isBest =
                bestTotal != null &&
                run.totalElapsed === bestTotal &&
                runs.length > 1;
              return (
                <div
                  key={run.id}
                  className={`${styles.row} ${isBest ? styles.rowBest : ""}`}
                  style={rowStyle}
                >
                  <div className={styles.cellTotal}>
                    {isBest && <span className={styles.bestStar}>★</span>}
                    <span className={styles.timeValue}>
                      {formatTime(run.totalElapsed)}
                    </span>
                  </div>
                  <div className={styles.cellDate}>{formatDate(run.date)}</div>
                  <div className={styles.cellChar}>
                    <span className={styles.charName}>
                      {run.characterName || "—"}
                    </span>
                    {run.characterClass && (
                      <span className={styles.charClass}>
                        {run.characterClass}
                      </span>
                    )}
                  </div>
                  <div className={`${styles.cellLevel} ${styles.cellCenter}`}>
                    {run.finalLevel > 0 ? run.finalLevel : "—"}
                  </div>
                  {allActs.map((act) => {
                    const split = run.actSplits[act];
                    const elapsed = split?.elapsed ?? null;
                    return (
                      <div
                        key={act}
                        className={`${styles.cellSplit} ${styles.cellCenter} ${splitClass(act, elapsed)}`}
                      >
                        {elapsed == null ? "—" : formatTime(elapsed)}
                      </div>
                    );
                  })}
                  <div className={styles.cellCenter}>
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => handleDelete(e, run.id)}
                      title="Delete run"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
