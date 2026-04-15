import { useState, useRef, useEffect } from "react";
import { useCustomizationsStore } from "../../store/customizationsStore";
import type { StepReminder as StepReminderType } from "../../types";
import styles from "./StepReminder.module.css";

interface StepReminderProps {
  pageIndex: number;
  stepIndex: number;
}

type ReminderType = StepReminderType["type"];

const TYPE_ICONS: Record<ReminderType, string> = {
  gem: "💎",
  gear: "⚔",
  craft: "🔨",
  note: "📝",
};

const TYPE_LABELS: Record<ReminderType, string> = {
  gem: "gem",
  gear: "gear",
  craft: "craft",
  note: "note",
};

const REMINDER_TYPES: ReminderType[] = ["gem", "gear", "craft", "note"];

export function StepReminder({ pageIndex, stepIndex }: StepReminderProps) {
  const getRemindersForStep = useCustomizationsStore((s) => s.getRemindersForStep);
  const addReminder = useCustomizationsStore((s) => s.addReminder);
  const removeReminder = useCustomizationsStore((s) => s.removeReminder);

  // Subscribe to stepReminders so component re-renders on changes
  useCustomizationsStore((s) => s.stepReminders);

  const reminders = getRemindersForStep(pageIndex, stepIndex);

  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<ReminderType>("note");
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showForm) {
      inputRef.current?.focus();
    }
  }, [showForm]);

  function handleAdd() {
    setSelectedType("note");
    setText("");
    setShowForm(true);
  }

  function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) {
      setShowForm(false);
      return;
    }
    addReminder({
      id: crypto.randomUUID(),
      pageIndex,
      stepIndex,
      type: selectedType,
      text: trimmed,
    });
    setText("");
    setShowForm(false);
  }

  function handleCancel() {
    setText("");
    setShowForm(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  }

  return (
    <>
      {reminders.length > 0 && (
        <div className={styles.reminders}>
          {reminders.map((reminder) => (
            <div key={reminder.id} className={styles.reminderRow}>
              <span className={styles.reminderIcon}>{TYPE_ICONS[reminder.type]}</span>
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
                onClick={() => setSelectedType(type)}
              >
                {TYPE_ICONS[type]} {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
          <input
            ref={inputRef}
            className={styles.textInput}
            type="text"
            placeholder="Reminder text..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      ) : (
        <button className="stepReminderAddBtn" onClick={handleAdd} tabIndex={-1}>
          + add reminder
        </button>
      )}
    </>
  );
}
