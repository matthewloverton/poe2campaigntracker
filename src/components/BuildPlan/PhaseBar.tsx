import { useState, useCallback } from "react";
import type { BuildPhase, PhaseTrigger } from "../../types/buildPlan";
import styles from "./PhaseBar.module.css";

interface PhaseBarProps {
  phases: BuildPhase[];
  activePhaseId: string | null;
  onSelectPhase: (id: string) => void;
  onAddPhase: (name: string, trigger: PhaseTrigger) => void;
  onRemovePhase: (id: string) => void;
  onRenamePhase: (id: string, name: string) => void;
}

function triggerLabel(trigger: PhaseTrigger): string {
  switch (trigger.type) {
    case "level":
      return trigger.level ? `Lvl ${trigger.level}+` : "Level";
    case "zone":
      return trigger.zoneName ?? "Zone";
    case "manual":
      return "Manual";
  }
}

export function PhaseBar({
  phases,
  activePhaseId,
  onSelectPhase,
  onAddPhase,
  onRemovePhase,
  onRenamePhase,
}: PhaseBarProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [triggerType, setTriggerType] = useState<PhaseTrigger["type"]>("level");
  const [level, setLevel] = useState("");

  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const trigger: PhaseTrigger = { type: triggerType };
    if (triggerType === "level" && level) {
      trigger.level = parseInt(level, 10) || undefined;
    }

    onAddPhase(trimmed, trigger);
    setName("");
    setLevel("");
    setTriggerType("level");
    setShowAdd(false);
  }, [name, triggerType, level, onAddPhase]);

  const handleCancel = useCallback(() => {
    setName("");
    setLevel("");
    setTriggerType("level");
    setShowAdd(false);
  }, []);

  return (
    <div className={styles.bar}>
      {sortedPhases.map((phase) => (
        editingId === phase.id ? (
          <div key={phase.id} className={`${styles.tab} ${styles.tabActive}`}>
            <input
              className={styles.editInput}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (editName.trim()) onRenamePhase(phase.id, editName.trim());
                  setEditingId(null);
                }
                if (e.key === "Escape") setEditingId(null);
              }}
              onBlur={() => {
                if (editName.trim()) onRenamePhase(phase.id, editName.trim());
                setEditingId(null);
              }}
              autoFocus
            />
          </div>
        ) : (
          <button
            key={phase.id}
            className={`${styles.tab} ${phase.id === activePhaseId ? styles.tabActive : ""}`}
            onClick={() => onSelectPhase(phase.id)}
            onDoubleClick={() => { setEditingId(phase.id); setEditName(phase.name); }}
            onContextMenu={(e) => { e.preventDefault(); onRemovePhase(phase.id); }}
            title={`${phase.name} (double-click to rename, right-click to remove)`}
          >
            <span className={styles.tabName}>{phase.name}</span>
            <span className={styles.tabTrigger}>
              {triggerLabel(phase.trigger)}
            </span>
          </button>
        )
      ))}

      {showAdd ? (
        <div className={styles.addForm}>
          <input
            className={styles.addInput}
            type="text"
            placeholder="Phase name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") handleCancel();
            }}
            autoFocus
          />
          <select
            className={styles.addSelect}
            value={triggerType}
            onChange={(e) =>
              setTriggerType(e.target.value as PhaseTrigger["type"])
            }
          >
            <option value="level">At Level</option>
            <option value="zone">At Zone</option>
            <option value="manual">Manual</option>
          </select>
          {triggerType === "level" && (
            <input
              className={styles.levelInput}
              type="number"
              placeholder="Lvl"
              min={1}
              max={100}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
                if (e.key === "Escape") handleCancel();
              }}
            />
          )}
          <button
            className={`${styles.formBtn} ${styles.formBtnAdd}`}
            onClick={handleSubmit}
          >
            Add
          </button>
          <button
            className={`${styles.formBtn} ${styles.formBtnCancel}`}
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          className={styles.addBtn}
          onClick={() => setShowAdd(true)}
          title="Add phase"
        >
          +
        </button>
      )}
    </div>
  );
}
