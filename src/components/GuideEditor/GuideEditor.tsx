import { useState } from "react";
import styles from "./GuideEditor.module.css";
import { GuideTree } from "./GuideTree";

export interface GuideEditorSelection {
  guideId: string | null;
  act: number | null;     // 1-based; null when not selected
  entryIdx: number | null; // page index within the act; null when act or guide selected
}

interface GuideEditorProps {
  onClose: () => void;
}

export function GuideEditor({ onClose }: GuideEditorProps) {
  const [selection, setSelection] = useState<GuideEditorSelection>({
    guideId: null,
    act: null,
    entryIdx: null,
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Guides</span>
        <button className={styles.closeBtn} onClick={onClose}>
          &times;
        </button>
      </div>
      <div className={styles.body}>
        <div className={styles.leftPane}>
          <GuideTree selection={selection} onSelect={setSelection} />
        </div>
        <div className={styles.rightPane}>
          {/* Selection-driven panes in Tasks 9-11 */}
          <div style={{ padding: 12, color: "var(--text-secondary)" }}>
            {selection.guideId === null
              ? "Select a guide, act, or page."
              : `Guide: ${selection.guideId}`}
          </div>
        </div>
      </div>
    </div>
  );
}
