import { useGuidesStore } from "../../store/guidesStore";
import { DragList } from "../DragList/DragList";
import { storedGuideToPages } from "../../data/guide";

interface Props {
  guideId: string;
  act: number;
  onSelectPage: (entryIdx: number) => void;
}

export function ActPane({ guideId, act, onSelectPage }: Props) {
  const isDefault = guideId === "default";
  const guide = useGuidesStore((s) => s.guides.find((g) => g.id === guideId));
  const addPage = useGuidesStore((s) => s.addPage);
  const deletePage = useGuidesStore((s) => s.deletePage);
  const reorderPages = useGuidesStore((s) => s.reorderPages);

  if (isDefault || !guide) {
    return (
      <div style={{ padding: 16, color: "var(--text-secondary)", fontSize: "0.75rem" }}>
        Default guide is read-only. Duplicate it to edit.
      </div>
    );
  }

  const entries = guide.acts[act - 1]?.entries ?? [];
  const derived = storedGuideToPages(guide).filter((p) => p.act === act);

  const items = entries.map((e, i) => {
    const page = derived.find((p) => p.pageIndex === i);
    const label = page?.targetZoneName || (e.type === "conditional" ? "(conditional)" : "(empty)");
    return { id: String(i), label, type: e.type };
  });

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <h4 style={{ fontSize: "0.75rem", color: "var(--accent-gold)", textTransform: "uppercase", letterSpacing: 0.5, margin: 0 }}>
        {act <= 4 ? `Act ${act}` : `Postgame ${act - 4}`} — Pages
      </h4>

      <DragList
        items={items}
        onReorder={(ids) => reorderPages(guideId, act, ids.map(Number))}
        renderItem={(item) => {
          const i = Number(item.id);
          const m = items.find((x) => x.id === item.id)!;
          return (
            <div
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", border: "1px solid var(--border-color)",
                borderRadius: 4, background: "var(--bg-secondary)",
              }}
            >
              <span style={{ color: "var(--text-secondary)", fontSize: "0.6rem", width: 24 }}>
                {i + 1}.
              </span>
              <span
                onClick={() => onSelectPage(i)}
                style={{ flex: 1, cursor: "pointer", fontSize: "0.75rem" }}
              >
                {m.label}
              </span>
              {m.type === "conditional" && (
                <span style={{ fontSize: "0.55rem", color: "var(--accent-teal)" }}>cond</span>
              )}
              <button
                onClick={() => {
                  if (confirm("Delete this page?")) deletePage(guideId, act, i);
                }}
                style={{ background: "none", border: "none", color: "var(--color-red, #d9534f)", cursor: "pointer" }}
              >
                &times;
              </button>
            </div>
          );
        }}
      />

      <button
        onClick={() => addPage(guideId, act)}
        style={{
          padding: "6px 10px", border: "1px dashed var(--border-color)",
          borderRadius: 4, color: "var(--text-secondary)", background: "none",
          cursor: "pointer", fontSize: "0.7rem", alignSelf: "flex-start",
        }}
      >
        + Add page
      </button>
    </div>
  );
}
