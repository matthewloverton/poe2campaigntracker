import styles from "./DpsValue.module.css";

export function formatDps(dps: number): string {
  if (dps >= 1_000_000) return `${(dps / 1_000_000).toFixed(2)}M`;
  if (dps >= 10_000) return Math.round(dps).toLocaleString();
  if (dps >= 1) return dps.toFixed(0);
  return "0";
}

interface DpsValueProps {
  dps: number;
  suffix?: string;
}

export function DpsValue({ dps, suffix = "DPS" }: DpsValueProps) {
  return (
    <span className={styles.value}>
      <span className={styles.number}>{formatDps(dps)}</span>
      {suffix && <span className={styles.suffix}>{suffix}</span>}
    </span>
  );
}
