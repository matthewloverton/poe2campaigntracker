import { useEffect, useRef, useState } from "react";
import styles from "./Dialog.module.css";

interface DialogRequest {
  id: number;
  kind: "confirm" | "alert";
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  resolve: (v: boolean) => void;
}

let nextId = 0;
let listener: ((reqs: DialogRequest[]) => void) | null = null;
let queue: DialogRequest[] = [];

function push(req: Omit<DialogRequest, "id" | "resolve">): Promise<boolean> {
  return new Promise((resolve) => {
    const entry: DialogRequest = { ...req, id: ++nextId, resolve };
    queue = [...queue, entry];
    listener?.(queue);
  });
}

function resolveAndRemove(id: number, value: boolean) {
  const entry = queue.find((r) => r.id === id);
  if (!entry) return;
  entry.resolve(value);
  queue = queue.filter((r) => r.id !== id);
  listener?.(queue);
}

export function confirmDialog(
  message: string,
  opts: { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean } = {}
): Promise<boolean> {
  return push({ kind: "confirm", message, ...opts });
}

export function alertDialog(
  message: string,
  opts: { title?: string; confirmLabel?: string } = {}
): Promise<boolean> {
  return push({ kind: "alert", message, ...opts });
}

export function DialogHost() {
  const [reqs, setReqs] = useState<DialogRequest[]>(queue);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    listener = setReqs;
    return () => { listener = null; };
  }, []);

  const current = reqs[0];

  useEffect(() => {
    if (!current) return;
    confirmBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && current.kind === "confirm") {
        resolveAndRemove(current.id, false);
      } else if (e.key === "Enter") {
        resolveAndRemove(current.id, true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  if (!current) return null;

  const isConfirm = current.kind === "confirm";

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget && isConfirm) {
          resolveAndRemove(current.id, false);
        }
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true">
        {current.title && <div className={styles.title}>{current.title}</div>}
        <div className={styles.message}>{current.message}</div>
        <div className={styles.actions}>
          {isConfirm && (
            <button
              className={styles.btnCancel}
              onClick={() => resolveAndRemove(current.id, false)}
            >
              {current.cancelLabel ?? "Cancel"}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            className={current.danger ? styles.btnDanger : styles.btnConfirm}
            onClick={() => resolveAndRemove(current.id, true)}
          >
            {current.confirmLabel ?? (isConfirm ? "Confirm" : "OK")}
          </button>
        </div>
      </div>
    </div>
  );
}
