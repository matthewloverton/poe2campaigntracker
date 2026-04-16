import { useGuidesStore } from "../../store/guidesStore";
import { DragList } from "../DragList/DragList";
import { StepRow } from "./StepRow";
import { storedGuideToPages } from "../../data/guide";

interface Props {
  guideId: string;
  act: number;
  entryIdx: number;
}

export function PageEditor({ guideId, act, entryIdx }: Props) {
  const isDefault = guideId === "default";
  const guide = useGuidesStore((s) => s.guides.find((g) => g.id === guideId));
  const addStep = useGuidesStore((s) => s.addStep);
  const reorderSteps = useGuidesStore((s) => s.reorderSteps);
  const setCondition = useGuidesStore((s) => s.setPageCondition);

  if (isDefault || !guide) {
    return (
      <div style={{ padding: 16, color: "var(--text-secondary)", fontSize: "0.75rem" }}>
        Default guide is read-only. Duplicate it to edit.
      </div>
    );
  }

  const entry = guide.acts[act - 1]?.entries[entryIdx];
  if (!entry) {
    return (
      <div style={{ padding: 16, color: "var(--text-secondary)" }}>
        Page not found.
      </div>
    );
  }

  const lines = entry.lines;
  const derived = storedGuideToPages(guide).find((p) => p.act === act && p.pageIndex === entryIdx);
  const isConditional = entry.type === "conditional";

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Target zone (derived)
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--accent-gold)", marginTop: 2 }}>
          {derived?.targetZoneName || "(none — add an areaid... line)"}
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem" }}>
        <input
          type="checkbox"
          checked={isConditional}
          onChange={(e) => {
            setCondition(
              guideId,
              act,
              entryIdx,
              e.currentTarget.checked ? ["league-start", "yes"] : null,
            );
          }}
        />
        Conditional page
      </label>

      {isConditional && entry.type === "conditional" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.72rem" }}>
          <select
            value={entry.condition[0]}
            onChange={(e) => setCondition(guideId, act, entryIdx, [e.currentTarget.value, entry.condition[1]])}
          >
            <option value="league-start">league-start</option>
          </select>
          <select
            value={entry.condition[1]}
            onChange={(e) => setCondition(guideId, act, entryIdx, [entry.condition[0], e.currentTarget.value])}
          >
            <option value="yes">yes</option>
            <option value="no">no</option>
          </select>
        </div>
      )}

      <div>
        <div style={{ fontSize: "0.6rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
          Steps
        </div>
        <DragList
          items={lines.map((_, i) => ({ id: String(i) }))}
          onReorder={(ids) => reorderSteps(guideId, act, entryIdx, ids.map(Number))}
          withHandle
          renderItem={(item, _i, handleProps) => {
            const i = Number(item.id);
            return (
              <StepRow
                guideId={guideId}
                act={act}
                entryIdx={entryIdx}
                stepIdx={i}
                raw={lines[i]}
                dragHandleProps={handleProps}
              />
            );
          }}
        />
        <button
          onClick={() => addStep(guideId, act, entryIdx)}
          style={{
            marginTop: 6, padding: "6px 10px", border: "1px dashed var(--border-color)",
            borderRadius: 4, color: "var(--text-secondary)", background: "none",
            cursor: "pointer", fontSize: "0.7rem",
          }}
        >
          + Add step
        </button>
      </div>
    </div>
  );
}
