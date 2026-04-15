import { useState, useCallback, useMemo } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, horizontalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import type { BuildPhase, PhaseTrigger } from "../../types/buildPlan";
import { areas } from "../../data/areas";
import styles from "./PhaseBar.module.css";

interface PhaseBarProps {
  phases: BuildPhase[];
  activePhaseId: string | null;
  onSelectPhase: (id: string) => void;
  onAddPhase: (name: string, trigger: PhaseTrigger) => void;
  onRemovePhase: (id: string) => void;
  onRenamePhase: (id: string, name: string) => void;
  onReorderPhases: (ids: string[]) => void;
  onUpdateTrigger: (id: string, trigger: PhaseTrigger) => void;
}

function SortablePhaseTab({
  phase, isActive, onSelect, onDoubleClick, onContextMenu, children,
}: {
  phase: BuildPhase;
  isActive: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: phase.id });
  const style = {
    transform: CSS.Transform.toString(transform ? { ...transform, y: 0 } : null),
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      title={`${phase.name} (double-click to rename, right-click to remove)`}
      {...attributes}
      {...listeners}
    >
      {children}
    </button>
  );
}

function triggerLabel(trigger: PhaseTrigger): string {
  switch (trigger.type) {
    case "level":
      return trigger.level ? `Lvl ${trigger.level}+` : "Level";
    case "zone":
      return trigger.zoneName ? capitalize(trigger.zoneName) : "Zone";
    case "manual":
      return "Manual";
  }
}

function capitalize(s: string): string {
  return s.replace(/(^|\s)\w/g, (c) => c.toUpperCase());
}

export function PhaseBar({
  phases,
  activePhaseId,
  onSelectPhase,
  onAddPhase,
  onRemovePhase,
  onRenamePhase,
  onReorderPhases,
  onUpdateTrigger,
}: PhaseBarProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTriggerType, setEditTriggerType] = useState<PhaseTrigger["type"]>("level");
  const [editLevel, setEditLevel] = useState("");
  const [editZoneId, setEditZoneId] = useState("");
  const [triggerType, setTriggerType] = useState<PhaseTrigger["type"]>("level");
  const [level, setLevel] = useState("");
  const [zoneId, setZoneId] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = sortedPhases.map((p) => p.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const reordered = [...ids];
    reordered.splice(from, 1);
    reordered.splice(to, 0, String(active.id));
    onReorderPhases(reordered);
  }

  function startEdit(phase: BuildPhase) {
    setEditingId(phase.id);
    setEditName(phase.name);
    setEditTriggerType(phase.trigger.type);
    setEditLevel(phase.trigger.level?.toString() ?? "");
    setEditZoneId(phase.trigger.zoneId ?? "");
  }

  function submitEdit() {
    if (!editingId) return;
    if (editName.trim()) onRenamePhase(editingId, editName.trim());
    const trigger: PhaseTrigger = { type: editTriggerType };
    if (editTriggerType === "level" && editLevel) trigger.level = parseInt(editLevel, 10) || undefined;
    if (editTriggerType === "zone" && editZoneId) {
      const area = areas.find((a) => a.id === editZoneId);
      trigger.zoneId = editZoneId;
      trigger.zoneName = area?.name;
    }
    onUpdateTrigger(editingId, trigger);
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

  // Campaign zones grouped by act for the dropdown
  const zonesByAct = useMemo(() => {
    const grouped = new Map<number, { id: string; name: string }[]>();
    for (const area of areas) {
      if (area.act > 4) continue; // campaign only
      const list = grouped.get(area.act) ?? [];
      list.push({ id: area.id, name: area.name });
      grouped.set(area.act, list);
    }
    return grouped;
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const trigger: PhaseTrigger = { type: triggerType };
    if (triggerType === "level" && level) {
      trigger.level = parseInt(level, 10) || undefined;
    }
    if (triggerType === "zone" && zoneId) {
      const area = areas.find((a) => a.id === zoneId);
      trigger.zoneId = zoneId;
      trigger.zoneName = area?.name;
    }

    onAddPhase(trimmed, trigger);
    setName("");
    setLevel("");
    setZoneId("");
    setTriggerType("level");
    setShowAdd(false);
  }, [name, triggerType, level, zoneId, onAddPhase]);

  const handleCancel = useCallback(() => {
    setName("");
    setLevel("");
    setZoneId("");
    setTriggerType("level");
    setShowAdd(false);
  }, []);

  return (
    <div className={styles.bar}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToParentElement]}>
        <SortableContext items={sortedPhases.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
          {sortedPhases.map((phase) => (
            editingId === phase.id ? (
              <div key={phase.id} className={styles.addForm}>
                <input
                  className={styles.addInput}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  autoFocus
                />
                <select
                  className={styles.addSelect}
                  value={editTriggerType}
                  onChange={(e) => setEditTriggerType(e.target.value as PhaseTrigger["type"])}
                >
                  <option value="level">At Level</option>
                  <option value="zone">At Zone</option>
                  <option value="manual">Manual</option>
                </select>
                {editTriggerType === "level" && (
                  <input
                    className={styles.levelInput}
                    type="number"
                    placeholder="Lvl"
                    min={1}
                    max={100}
                    value={editLevel}
                    onChange={(e) => setEditLevel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                )}
                {editTriggerType === "zone" && (
                  <select
                    className={styles.addSelect}
                    value={editZoneId}
                    onChange={(e) => setEditZoneId(e.target.value)}
                  >
                    <option value="">Select zone...</option>
                    {Array.from(zonesByAct.entries()).map(([act, zones]) => (
                      <optgroup key={act} label={`Act ${act}`}>
                        {zones.map((z) => (
                          <option key={z.id} value={z.id}>{capitalize(z.name)}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                )}
                <button className={`${styles.formBtn} ${styles.formBtnAdd}`} onClick={submitEdit}>Save</button>
                <button className={`${styles.formBtn} ${styles.formBtnCancel}`} onClick={cancelEdit}>Cancel</button>
              </div>
            ) : (
              <SortablePhaseTab
                key={phase.id}
                phase={phase}
                isActive={phase.id === activePhaseId}
                onSelect={() => onSelectPhase(phase.id)}
                onDoubleClick={() => startEdit(phase)}
                onContextMenu={(e) => { e.preventDefault(); onRemovePhase(phase.id); }}
              >
                <span className={styles.tabName}>{phase.name}</span>
                <span className={styles.tabTrigger}>
                  {triggerLabel(phase.trigger)}
                </span>
              </SortablePhaseTab>
            )
          ))}
        </SortableContext>
      </DndContext>

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
          {triggerType === "zone" && (
            <select
              className={styles.addSelect}
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
            >
              <option value="">Select zone...</option>
              {Array.from(zonesByAct.entries()).map(([act, zones]) => (
                <optgroup key={act} label={`Act ${act}`}>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{capitalize(z.name)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
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
