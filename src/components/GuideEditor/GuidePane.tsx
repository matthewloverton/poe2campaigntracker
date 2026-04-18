import { useGuidesStore } from "../../store/guidesStore";
import { confirmDialog, alertDialog } from "../Dialog/Dialog";
import styles from "./GuideEditor.module.css";

interface Props {
  guideId: string;
  onSelectGuide: (id: string | null) => void;
}

const KNOWN_CONDITIONS: { key: string; label: string; values: string[] }[] = [
  { key: "league-start", label: "League start", values: ["yes", "no"] },
];

export function GuidePane({ guideId, onSelectGuide }: Props) {
  const isDefault = guideId === "default";
  const guide = useGuidesStore((s) => s.guides.find((g) => g.id === guideId));
  const rename = useGuidesStore((s) => s.renameGuide);
  const duplicate = useGuidesStore((s) => s.duplicateGuide);
  const del = useGuidesStore((s) => s.deleteGuide);
  const setConditions = useGuidesStore((s) => s.setActiveConditions);

  async function handleExport() {
    if (isDefault || !guide) return;
    const data = JSON.stringify(guide, null, 2);
    try {
      await navigator.clipboard.writeText(data);
      await alertDialog(`Copied "${guide.name}" to clipboard (${data.length.toLocaleString()} chars).`, { title: "Guide Exported" });
    } catch {
      // Fallback: download as file
      try {
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${guide.name.replace(/[^a-z0-9-_]+/gi, "_")}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        await alertDialog("Could not copy to clipboard or save file.", { title: "Export Failed" });
      }
    }
  }

  function handleDuplicate() {
    if (!guide && !isDefault) return;
    if (isDefault) {
      // Duplicate default by creating a new guide
      const id = useGuidesStore.getState().createGuideFromDefault("Default (copy)");
      onSelectGuide(id);
    } else {
      const newId = duplicate(guideId);
      onSelectGuide(newId);
    }
  }

  async function handleDelete() {
    if (isDefault || !guide) return;
    if (await confirmDialog(`Delete "${guide.name}"? This cannot be undone.`, { title: "Delete Guide", confirmLabel: "Delete", danger: true })) {
      del(guideId);
      onSelectGuide(null);
    }
  }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={{ fontSize: "0.62rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Name
        </label>
        <input
          key={guideId}
          type="text"
          defaultValue={isDefault ? "Default" : (guide?.name ?? "")}
          disabled={isDefault}
          onBlur={(e) => !isDefault && guide && rename(guideId, e.currentTarget.value)}
          style={{
            display: "block", marginTop: 4, padding: "6px 10px",
            background: "var(--bg-secondary)", border: "1px solid var(--border-color)",
            borderRadius: 4, color: "var(--text-primary)", fontSize: "0.8rem", width: 320,
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button className={styles.actionBtn} onClick={handleDuplicate}>
          {isDefault ? "Duplicate to New Guide" : "Duplicate"}
        </button>
        {!isDefault && (
          <>
            <button className={styles.actionBtn} onClick={handleExport}>Export JSON</button>
            <button className={styles.dangerBtn} onClick={handleDelete}>Delete</button>
          </>
        )}
      </div>

      {!isDefault && guide && (
        <div>
          <h4 style={{ fontSize: "0.7rem", margin: "16px 0 8px", color: "var(--accent-gold)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Active Conditions
          </h4>
          <p style={{ fontSize: "0.65rem", color: "var(--text-secondary)", opacity: 0.7, marginBottom: 8 }}>
            Playback filter applied when this guide is running. Does not affect editing.
          </p>
          {KNOWN_CONDITIONS.map((cond) => (
            <label key={cond.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: "0.72rem" }}>
              <span style={{ minWidth: 120 }}>{cond.label}</span>
              <select
                value={guide.activeConditions[cond.key] ?? cond.values[0]}
                onChange={(e) => setConditions(guideId, { [cond.key]: e.currentTarget.value })}
                style={{ padding: "3px 6px", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 3, color: "var(--text-primary)", fontSize: "0.7rem" }}
              >
                {cond.values.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
