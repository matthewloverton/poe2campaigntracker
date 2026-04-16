import { useMemo } from "react";
import { tokenize } from "../../lib/tokenizer";
import { StepRenderer } from "../StepRenderer";
import { useGuidesStore } from "../../store/guidesStore";
import styles from "./StepRow.module.css";

interface Props {
  guideId: string;
  act: number;
  entryIdx: number;
  stepIdx: number;
  raw: string;
}

export function StepRow({ guideId, act, entryIdx, stepIdx, raw }: Props) {
  const setStepLine = useGuidesStore((s) => s.setStepLine);
  const toggleHint = useGuidesStore((s) => s.toggleStepHint);
  const toggleOptional = useGuidesStore((s) => s.toggleStepOptional);
  const deleteStep = useGuidesStore((s) => s.deleteStep);

  const tokens = useMemo(() => tokenize(raw), [raw]);
  const isHint = raw.startsWith("(hint)");
  const isOptional = raw.startsWith("optional:");

  return (
    <div className={styles.row}>
      <div className={styles.toolbar}>
        <button
          className={`${styles.toggle} ${isHint ? styles.toggleActive : ""}`}
          onClick={() => toggleHint(guideId, act, entryIdx, stepIdx)}
        >
          Hint
        </button>
        <button
          className={`${styles.toggle} ${isOptional ? styles.toggleActive : ""}`}
          onClick={() => toggleOptional(guideId, act, entryIdx, stepIdx)}
        >
          Optional
        </button>
        {/* Picker buttons land in Task 11 */}
        <button
          className={styles.deleteBtn}
          onClick={() => { if (confirm("Delete step?")) deleteStep(guideId, act, entryIdx, stepIdx); }}
        >
          &times;
        </button>
      </div>
      <input
        className={styles.rawInput}
        type="text"
        value={raw}
        onChange={(e) => setStepLine(guideId, act, entryIdx, stepIdx, e.currentTarget.value)}
        placeholder="Type step syntax…"
      />
      <div className={styles.preview}>
        <StepRenderer tokens={tokens} isHint={isHint} isOptional={isOptional} isOptionalHint={false} isLast={false} />
      </div>
    </div>
  );
}
