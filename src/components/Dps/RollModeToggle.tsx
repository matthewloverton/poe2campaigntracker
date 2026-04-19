import type { RollMode } from "../../lib/dps";
import styles from "./RollModeToggle.module.css";

interface RollModeToggleProps {
  value: RollMode;
  onChange: (mode: RollMode) => void;
}

const MODES: RollMode[] = ["actual", "max"];

export function RollModeToggle({ value, onChange }: RollModeToggleProps) {
  return (
    <div className={styles.pill} role="radiogroup" aria-label="Roll mode">
      {MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          className={`${styles.option} ${value === mode ? styles.active : ""}`}
          onClick={() => onChange(mode)}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}
