import { useState, useRef, useEffect, useMemo, useImperativeHandle, forwardRef } from "react";
import { useCustomizationsStore } from "../../store/customizationsStore";
import { searchGems } from "../../data/gems";
import { searchItems } from "../../data/items";
import { searchUniques } from "../../data/uniques";
import type { StepReminder as StepReminderType, ReminderRef } from "../../types/buildPlan";
import styles from "./StepReminder.module.css";

interface StepReminderProps {
  pageIndex: number;
  stepIndex: number;
  onOpenChange?: (open: boolean) => void;
}

export interface StepReminderHandle {
  openForm: () => void;
}

type ReminderType = StepReminderType["type"];

const TYPE_LABELS: Record<ReminderType, string> = {
  gem: "Gem",
  gear: "Gear",
  craft: "Craft",
  note: "Note",
};

const REMINDER_TYPES: ReminderType[] = ["gem", "gear", "note"];

export const StepReminder = forwardRef<StepReminderHandle, StepReminderProps>(function StepReminder({ pageIndex, stepIndex, onOpenChange }, ref) {
  const getRemindersForStep = useCustomizationsStore((s) => s.getRemindersForStep);
  const addReminder = useCustomizationsStore((s) => s.addReminder);
  const removeReminder = useCustomizationsStore((s) => s.removeReminder);
  useCustomizationsStore((s) => s.stepReminders);

  const reminders = getRemindersForStep(pageIndex, stepIndex);

  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<ReminderType>("gem");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [selectedRef, setSelectedRef] = useState<ReminderRef | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const needsRef = selectedType === "gem" || selectedType === "gear";

  useImperativeHandle(ref, () => ({
    openForm: () => handleAdd(),
  }));

  useEffect(() => {
    if (showForm) {
      if (needsRef) searchRef.current?.focus();
      else inputRef.current?.focus();
    }
  }, [showForm, needsRef]);

  // Build plan entries for quick reference
  const buildPhases = useCustomizationsStore((s) => s.buildPhases);
  const activePhaseId = useCustomizationsStore((s) => s.activePhaseId);
  const activePhase = buildPhases.find((p) => p.id === activePhaseId);

  const buildPlanRefs = useMemo(() => {
    if (!activePhase) return { gems: [] as ReminderRef[], gear: [] as ReminderRef[] };
    const gems: ReminderRef[] = [];
    for (const group of activePhase.gems) {
      gems.push({ refId: group.skill.gemId ?? group.skill.id, refType: "gem", name: group.skill.name, iconPath: group.skill.iconPath });
      for (const sup of group.supports) {
        if (sup) gems.push({ refId: sup.gemId ?? sup.id, refType: "gem", name: sup.name, iconPath: sup.iconPath });
      }
    }
    const gear: ReminderRef[] = [];
    for (const entry of Object.values(activePhase.gear)) {
      if (!entry) continue;
      gear.push({ refId: entry.baseItemId ?? entry.id, refType: entry.uniqueId ? "unique" : "item", name: entry.base, iconPath: entry.iconPath });
    }
    return { gems, gear };
  }, [activePhase]);

  // Search results
  const searchResults = useMemo(() => {
    if (!needsRef) return [];
    const q = search.trim().toLowerCase();

    if (selectedType === "gem") {
      // Show build plan gems first, then database search
      const planMatches = q
        ? buildPlanRefs.gems.filter((g) => g.name.toLowerCase().includes(q))
        : buildPlanRefs.gems;
      const planIds = new Set(planMatches.map((g) => g.refId));
      const dbResults = q
        ? searchGems(search).filter((g) => !planIds.has(g.id)).slice(0, 6).map((g) => ({
            refId: g.id, refType: "gem" as const, name: g.name, iconPath: g.iconPath,
          }))
        : [];
      return [...planMatches, ...dbResults];
    }

    // Gear: build plan first, then database
    const planMatches = q
      ? buildPlanRefs.gear.filter((g) => g.name.toLowerCase().includes(q))
      : buildPlanRefs.gear;
    const planIds = new Set(planMatches.map((g) => g.refId));
    const dbItems = q
      ? searchItems(search).filter((i) => !planIds.has(i.id)).slice(0, 4).map((i) => ({
          refId: i.id, refType: "item" as const, name: i.name, iconPath: i.iconPath,
        }))
      : [];
    const dbUniques = q
      ? searchUniques(search).filter((u) => !planIds.has(u.id)).slice(0, 3).map((u) => ({
          refId: u.id, refType: "unique" as const, name: u.name, iconPath: u.iconPath,
        }))
      : [];
    return [...planMatches, ...dbItems, ...dbUniques];
  }, [search, selectedType, needsRef, buildPlanRefs]);

  function handleAdd() {
    setSelectedType("gem");
    setText("");
    setSearch("");
    setSelectedRef(null);
    setShowForm(true);
    onOpenChange?.(true);
  }

  function handleSave() {
    if (needsRef && !selectedRef) return;
    const reminderText = needsRef
      ? (text.trim() || selectedRef?.name || "")
      : text.trim();
    if (!reminderText) { setShowForm(false); return; }

    addReminder({
      id: crypto.randomUUID(),
      pageIndex,
      stepIndex,
      type: selectedType,
      text: reminderText,
      ...(selectedRef && { ref: selectedRef }),
    });
    setText("");
    setSearch("");
    setSelectedRef(null);
    setShowForm(false);
    onOpenChange?.(false);
  }

  function handleCancel() {
    setText("");
    setSearch("");
    setSelectedRef(null);
    setShowForm(false);
    onOpenChange?.(false);
  }

  function handleSelectRef(ref: ReminderRef) {
    setSelectedRef(ref);
    setSearch("");
    if (!text.trim()) setText(ref.name);
  }

  return (
    <>
      {reminders.length > 0 && (
        <div className={styles.reminders}>
          {reminders.map((reminder) => (
            <div key={reminder.id} className={styles.reminderRow}>
              {reminder.ref?.iconPath ? (
                <img
                  className={styles.reminderRefIcon}
                  src={`/assets/${reminder.ref.iconPath}`}
                  alt=""
                />
              ) : (
                <span className={styles.reminderTypeBadge}>
                  {TYPE_LABELS[reminder.type]}
                </span>
              )}
              <span className={`${styles.reminderText} ${styles[reminder.type]}`}>
                {reminder.text}
              </span>
              <button
                className={styles.removeBtn}
                title="Remove reminder"
                onClick={() => removeReminder(reminder.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className={styles.addForm}>
          <div className={styles.typePicker}>
            {REMINDER_TYPES.map((type) => (
              <button
                key={type}
                className={`${styles.typeBtn} ${selectedType === type ? styles.active : ""}`}
                onClick={() => { setSelectedType(type); setSelectedRef(null); setSearch(""); }}
              >
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          {needsRef && !selectedRef && (
            <div className={styles.searchWrap} ref={searchWrapRef}>
              <input
                ref={searchRef}
                className={styles.textInput}
                type="text"
                placeholder={`Search ${selectedType === "gem" ? "gems" : "items"}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") handleCancel();
                }}
              />
              {searchResults.length > 0 && searchWrapRef.current && (() => {
                const rect = searchWrapRef.current!.getBoundingClientRect();
                return (
                <div
                  className={styles.searchResults}
                  style={{ top: rect.bottom, left: rect.left, width: rect.width }}
                >
                  {(() => {
                    const planCount = selectedType === "gem" ? buildPlanRefs.gems.length : buildPlanRefs.gear.length;
                    const planResults = searchResults.slice(0, search.trim() ? searchResults.length : planCount);
                    const dbResults = searchResults.slice(planCount);
                    return (
                      <>
                        {planResults.length > 0 && !search.trim() && (
                          <div className={styles.searchSectionLabel}>Build Plan</div>
                        )}
                        {planResults.map((r) => (
                          <button key={`plan-${r.refId}`} className={styles.searchResult} onClick={() => handleSelectRef(r)}>
                            {r.iconPath && <img className={styles.searchResultIcon} src={`/assets/${r.iconPath}`} alt="" />}
                            <span>{r.name}</span>
                          </button>
                        ))}
                        {dbResults.length > 0 && (
                          <div className={styles.searchSectionLabel}>Database</div>
                        )}
                        {dbResults.map((r) => (
                          <button key={`db-${r.refId}`} className={styles.searchResult} onClick={() => handleSelectRef(r)}>
                            {r.iconPath && <img className={styles.searchResultIcon} src={`/assets/${r.iconPath}`} alt="" />}
                            <span>{r.name}</span>
                          </button>
                        ))}
                      </>
                    );
                  })()}
                </div>
                );
              })()}
            </div>
          )}

          {needsRef && selectedRef && (
            <div className={styles.selectedRef}>
              {selectedRef.iconPath && (
                <img
                  className={styles.selectedRefIcon}
                  src={`/assets/${selectedRef.iconPath}`}
                  alt=""
                />
              )}
              <span className={styles.selectedRefName}>{selectedRef.name}</span>
              <button
                className={styles.selectedRefClear}
                onClick={() => { setSelectedRef(null); setSearch(""); }}
              >
                ×
              </button>
            </div>
          )}

          {(!needsRef || selectedRef) && (
            <input
              ref={inputRef}
              className={styles.textInput}
              type="text"
              placeholder={needsRef ? "Note (optional)..." : "Reminder text..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleSave(); }
                else if (e.key === "Escape") handleCancel();
              }}
            />
          )}

          <div className={styles.formActions}>
            <button className={styles.saveBtn} onClick={handleSave} disabled={needsRef && !selectedRef}>
              Add
            </button>
            <button className={styles.cancelBtn} onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
});
