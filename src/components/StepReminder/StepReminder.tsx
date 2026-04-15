import { useState, useRef, useEffect, useMemo } from "react";
import { useCustomizationsStore } from "../../store/customizationsStore";
import { searchGems } from "../../data/gems";
import { searchItems } from "../../data/items";
import { searchUniques } from "../../data/uniques";
import type { StepReminder as StepReminderType, ReminderRef } from "../../types/buildPlan";
import styles from "./StepReminder.module.css";

interface StepReminderProps {
  pageIndex: number;
  stepIndex: number;
}

type ReminderType = StepReminderType["type"];

const TYPE_LABELS: Record<ReminderType, string> = {
  gem: "Gem",
  gear: "Gear",
  craft: "Craft",
  note: "Note",
};

const REMINDER_TYPES: ReminderType[] = ["gem", "gear", "craft", "note"];

export function StepReminder({ pageIndex, stepIndex }: StepReminderProps) {
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

  const needsRef = selectedType === "gem" || selectedType === "gear";

  useEffect(() => {
    if (showForm) {
      if (needsRef) searchRef.current?.focus();
      else inputRef.current?.focus();
    }
  }, [showForm, needsRef]);

  // Search results
  const searchResults = useMemo(() => {
    if (!search.trim() || !needsRef) return [];
    if (selectedType === "gem") {
      return searchGems(search).slice(0, 8).map((g) => ({
        refId: g.id,
        refType: "gem" as const,
        name: g.name,
        iconPath: g.iconPath,
      }));
    }
    const items = searchItems(search).slice(0, 6).map((i) => ({
      refId: i.id,
      refType: "item" as const,
      name: i.name,
      iconPath: i.iconPath,
    }));
    const uniques = searchUniques(search).slice(0, 4).map((u) => ({
      refId: u.id,
      refType: "unique" as const,
      name: u.name,
      iconPath: u.iconPath,
    }));
    return [...items, ...uniques];
  }, [search, selectedType, needsRef]);

  function handleAdd() {
    setSelectedType("gem");
    setText("");
    setSearch("");
    setSelectedRef(null);
    setShowForm(true);
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
  }

  function handleCancel() {
    setText("");
    setSearch("");
    setSelectedRef(null);
    setShowForm(false);
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
            <div className={styles.searchWrap}>
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
              {searchResults.length > 0 && (
                <div className={styles.searchResults}>
                  {searchResults.map((r) => (
                    <button
                      key={r.refId}
                      className={styles.searchResult}
                      onClick={() => handleSelectRef(r)}
                    >
                      {r.iconPath && (
                        <img
                          className={styles.searchResultIcon}
                          src={`/assets/${r.iconPath}`}
                          alt=""
                        />
                      )}
                      <span>{r.name}</span>
                    </button>
                  ))}
                </div>
              )}
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
      ) : (
        <button className="stepReminderAddBtn" onClick={handleAdd} tabIndex={-1}>
          + add reminder
        </button>
      )}
    </>
  );
}
