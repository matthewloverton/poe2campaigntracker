import { useMemo, useRef } from "react";
import { tokenize } from "../../lib/tokenizer";
import { StepRenderer } from "../StepRenderer";
import { useGuidesStore } from "../../store/guidesStore";
import type { DragHandleProps } from "../DragList/DragList";
import styles from "./StepRow.module.css";
import { IconPicker } from "./pickers/IconPicker";
import { ZonePicker } from "./pickers/ZonePicker";
import { ColorPicker } from "./pickers/ColorPicker";
import { SimplePicker } from "./pickers/SimplePicker";

interface Props {
  guideId: string;
  act: number;
  entryIdx: number;
  stepIdx: number;
  raw: string;
  dragHandleProps?: DragHandleProps;
}

export function StepRow({ guideId, act, entryIdx, stepIdx, raw, dragHandleProps }: Props) {
  const setStepLine = useGuidesStore((s) => s.setStepLine);
  const toggleHint = useGuidesStore((s) => s.toggleStepHint);
  const toggleOptional = useGuidesStore((s) => s.toggleStepOptional);
  const deleteStep = useGuidesStore((s) => s.deleteStep);

  const tokens = useMemo(() => tokenize(raw), [raw]);
  const isHint = raw.startsWith("(hint)");
  const isOptional = raw.startsWith("optional:");

  const inputRef = useRef<HTMLInputElement | null>(null);

  function insertAtCursor(snippet: string) {
    const el = inputRef.current;
    if (!el) return setStepLine(guideId, act, entryIdx, stepIdx, raw + snippet);
    const start = el.selectionStart ?? raw.length;
    const end = el.selectionEnd ?? raw.length;
    const next = raw.slice(0, start) + snippet + raw.slice(end);
    setStepLine(guideId, act, entryIdx, stepIdx, next);
    // restore focus + cursor position after re-render
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className={styles.row}>
      <div className={styles.toolbar}>
        {dragHandleProps && (
          <span
            {...dragHandleProps}
            className={styles.dragHandle}
            title="Drag to reorder"
          >
            ⋮⋮
          </span>
        )}
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
        <IconPicker onInsert={insertAtCursor} />
        <ZonePicker onInsert={insertAtCursor} />
        <ColorPicker onInsert={insertAtCursor} />
        <SimplePicker label="Quest" format={(v) => `(quest:${v})`} onInsert={insertAtCursor} />
        <SimplePicker label="Arena" format={(v) => `arena:${v}`} onInsert={insertAtCursor} />
        <SimplePicker
          label="Class"
          format={(v) => `<${v}>`}
          onInsert={insertAtCursor}
          suggestions={["witch", "warrior", "ranger", "monk", "mercenary", "sorceress", "druid"]}
        />
        <button
          className={styles.deleteBtn}
          onClick={() => { if (confirm("Delete step?")) deleteStep(guideId, act, entryIdx, stepIdx); }}
        >
          &times;
        </button>
      </div>
      <input
        ref={inputRef}
        className={styles.rawInput}
        type="text"
        value={raw}
        onChange={(e) => setStepLine(guideId, act, entryIdx, stepIdx, e.currentTarget.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        placeholder="Type step syntax…"
      />
      <div className={styles.preview}>
        <StepRenderer tokens={tokens} isHint={isHint} isOptional={isOptional} isOptionalHint={false} isLast={false} />
      </div>
    </div>
  );
}
