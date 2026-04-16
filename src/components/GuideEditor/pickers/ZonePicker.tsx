import { useState, useMemo } from "react";
import { areaById } from "../../../data/areas";
import styles from "./Pickers.module.css";

interface Props {
  onInsert: (raw: string) => void;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

export function ZonePicker({ onInsert, open, onOpenChange }: Props) {
  const [q, setQ] = useState("");

  const entries = useMemo(() => Array.from(areaById.entries()), []);
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return entries.slice(0, 80);
    return entries
      .filter(([id, a]) => id.includes(needle) || a.name.toLowerCase().includes(needle))
      .slice(0, 80);
  }, [q, entries]);

  return (
    <div className={styles.wrap}>
      <button className={styles.btn} onClick={() => onOpenChange(!open)}>Zone ▾</button>
      {open && (
        <div className={styles.popover}>
          <input
            className={styles.search}
            placeholder="Search zones…"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            autoFocus
          />
          {matches.map(([id, area]) => (
            <div
              key={id}
              className={styles.row}
              onClick={() => {
                onInsert(`areaid${id} ;; ${area.name.toLowerCase()}`);
                onOpenChange(false);
              }}
            >
              {area.name}
              <span style={{ opacity: 0.4, marginLeft: 6, fontSize: "0.6rem" }}>{id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
