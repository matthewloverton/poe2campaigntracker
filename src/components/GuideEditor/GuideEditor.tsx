import { useState } from "react";
import styles from "./GuideEditor.module.css";
import { GuideTree } from "./GuideTree";
import { GuidePane } from "./GuidePane";
import { ActPane } from "./ActPane";

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
          {selection.guideId == null && (
            <div style={{ padding: 16, color: "var(--text-secondary)" }}>
              Select a guide, act, or page.
            </div>
          )}
          {selection.guideId && selection.act == null && (
            <GuidePane
              guideId={selection.guideId}
              onSelectGuide={(id) => setSelection({ guideId: id, act: null, entryIdx: null })}
            />
          )}
          {selection.guideId && selection.act != null && selection.entryIdx == null && (
            <ActPane
              guideId={selection.guideId}
              act={selection.act}
              onSelectPage={(entryIdx) => setSelection({ ...selection, entryIdx })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
