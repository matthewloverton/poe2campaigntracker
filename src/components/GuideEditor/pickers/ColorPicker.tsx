import { useState } from "react";
import styles from "./Pickers.module.css";

const SWATCHES = [
  { label: "red", value: "red" },
  { label: "yellow", value: "yellow" },
  { label: "purple", value: "cc99ff" },
  { label: "magenta", value: "ff00ff" },
  { label: "green", value: "50c878" },
  { label: "teal", value: "4ecdc4" },
];

interface Props {
  onInsert: (raw: string) => void;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

export function ColorPicker({ onInsert, open, onOpenChange }: Props) {
  const [hex, setHex] = useState("");

  return (
    <div className={styles.wrap}>
      <button className={styles.btn} onClick={() => onOpenChange(!open)}>Color ▾</button>
      {open && (
        <div className={styles.popover} style={{ minWidth: 180 }}>
          <div className={styles.grid}>
            {SWATCHES.map((s) => (
              <button
                key={s.value}
                className={styles.gridItem}
                onClick={() => { onInsert(`(color:${s.value})`); onOpenChange(false); }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <input
            className={styles.search}
            style={{ marginTop: 6 }}
            placeholder="custom hex (no #)"
            value={hex}
            onChange={(e) => setHex(e.currentTarget.value)}
          />
          <button
            className={styles.gridItem}
            style={{ width: "100%", marginTop: 4 }}
            onClick={() => { if (hex) { onInsert(`(color:${hex})`); onOpenChange(false); } }}
          >
            Insert custom
          </button>
        </div>
      )}
    </div>
  );
}
