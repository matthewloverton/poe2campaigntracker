import type { CalcBreakdown } from "../../lib/dps";
import styles from "./DpsBreakdown.module.css";

interface DpsBreakdownProps {
  breakdown: CalcBreakdown;
}

export function DpsBreakdown({ breakdown }: DpsBreakdownProps) {
  return (
    <div className={styles.breakdown}>
      <ul className={styles.stages}>
        {breakdown.stages.map((stage, i) => (
          <li
            key={i}
            className={`${styles.stage} ${styles[`kind_${stage.kind}`] ?? ""}`}
          >
            <span className={styles.label}>{stage.label}</span>
            {stage.value !== undefined && (
              <span className={styles.stageValue}>
                {typeof stage.value === "number"
                  ? Number.isInteger(stage.value)
                    ? stage.value.toLocaleString()
                    : stage.value.toFixed(2)
                  : stage.value}
              </span>
            )}
          </li>
        ))}
      </ul>
      {breakdown.sources.length > 0 && (
        <div className={styles.sources}>
          Sources:{" "}
          {breakdown.sources.map((s) => `${s.count} ${s.type}`).join(", ")}
        </div>
      )}
    </div>
  );
}
