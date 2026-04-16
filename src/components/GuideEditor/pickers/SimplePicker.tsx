import { useState } from "react";
import styles from "./Pickers.module.css";

interface Props {
  label: string;
  format: (value: string) => string;
  onInsert: (raw: string) => void;
  suggestions?: string[];
}

export function SimplePicker({ label, format, onInsert, suggestions = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  return (
    <div className={styles.wrap}>
      <button className={styles.btn} onClick={() => setOpen(!open)}>{label} ▾</button>
      {open && (
        <div className={styles.popover} style={{ minWidth: 180 }}>
          <input
            className={styles.search}
            placeholder={`${label} value`}
            value={v}
            onChange={(e) => setV(e.currentTarget.value)}
            autoFocus
          />
          {suggestions.filter((s) => !v || s.includes(v.toLowerCase())).slice(0, 20).map((s) => (
            <div
              key={s}
              className={styles.row}
              onClick={() => { onInsert(format(s)); setOpen(false); setV(""); }}
            >
              {s}
            </div>
          ))}
          <button
            className={styles.gridItem}
            style={{ width: "100%", marginTop: 4 }}
            onClick={() => { if (v) { onInsert(format(v)); setOpen(false); setV(""); } }}
          >
            Insert
          </button>
        </div>
      )}
    </div>
  );
}
