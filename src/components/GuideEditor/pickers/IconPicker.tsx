import styles from "./Pickers.module.css";

const ICONS = [
  "0", "1", "2", "3", "5", "6", "7",
  "arena", "artificer", "checkpoint", "exa", "gcp",
  "in-out2", "jeweller", "portal", "quest_2", "regal",
  "ring", "rune", "skill", "spirit", "support", "town", "waypoint",
];

interface Props {
  onInsert: (raw: string) => void;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

export function IconPicker({ onInsert, open, onOpenChange }: Props) {
  return (
    <div className={styles.wrap}>
      <button className={styles.btn} onClick={() => onOpenChange(!open)}>Icon ▾</button>
      {open && (
        <div className={styles.popover}>
          <div className={styles.grid}>
            {ICONS.map((name) => (
              <button
                key={name}
                className={styles.gridItem}
                onClick={() => { onInsert(`(img:${name})`); onOpenChange(false); }}
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
