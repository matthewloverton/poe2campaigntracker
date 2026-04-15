import { useState, useRef, useEffect } from "react";
import { useCustomizationsStore } from "../../store/customizationsStore";
import styles from "./InlineNote.module.css";

interface InlineNoteProps {
  pageIndex: number;
  stepIndex: number;
  /** If true, immediately open the edit input (e.g. triggered from parent) */
  forceEdit?: boolean;
  onEditDone?: () => void;
}

export function InlineNote({ pageIndex, stepIndex, forceEdit, onEditDone }: InlineNoteProps) {
  const { getNote, setNote, removeNote } = useCustomizationsStore();
  const existingNote = getNote(pageIndex, stepIndex);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // React to forceEdit from parent (e.g. double-click on a step with no note)
  useEffect(() => {
    if (forceEdit && !editing) {
      setDraft(existingNote ?? "");
      setEditing(true);
    }
  }, [forceEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus when entering edit mode
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  function openEdit() {
    setDraft(existingNote ?? "");
    setEditing(true);
  }

  function save() {
    const trimmed = draft.trim();
    if (trimmed) {
      setNote(pageIndex, stepIndex, trimmed);
    } else {
      removeNote(pageIndex, stepIndex);
    }
    setEditing(false);
    onEditDone?.();
  }

  function cancel() {
    setEditing(false);
    onEditDone?.();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      save();
    } else if (e.key === "Escape") {
      cancel();
    }
  }

  if (editing) {
    return (
      <div className={styles.noteEdit}>
        <input
          ref={inputRef}
          className={styles.noteInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={save}
          placeholder="Add a note..."
        />
      </div>
    );
  }

  if (existingNote) {
    return (
      <div className={styles.noteDisplay} onClick={openEdit} title="Click to edit note">
        <span className={styles.noteIcon}>📝</span>
        <span className={styles.noteText}>{existingNote}</span>
      </div>
    );
  }

  // No note exists — render nothing; parent shows "add note" affordance via CSS hover
  return null;
}
