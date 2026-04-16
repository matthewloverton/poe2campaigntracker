import { useState } from "react";
import styles from "./Pickers.module.css";

const ICONS = [
  "0", "1", "2", "3", "5", "6", "7",
  "arena", "artificer", "checkpoint", "exa", "gcp",
  "in-out2", "jeweller", "portal", "quest_2", "regal",
  "ring", "rune", "skill", "spirit", "support", "town", "waypoint",
];

interface Props {
  onInsert: (raw: string) => void;
}

export function IconPicker({ onInsert }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.wrap}>
      <button className={styles.btn} onClick={() => setOpen(!open)}>Icon ▾</button>
      {open && (
        <div className={styles.popover}>
          <div className={styles.grid}>
            {ICONS.map((name) => (
              <button
                key={name}
                className={styles.gridItem}
                onClick={() => { onInsert(`(img:${name})`); setOpen(false); }}
                title={name}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
