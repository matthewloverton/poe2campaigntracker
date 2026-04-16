import { useState } from "react";
import { decodeBuildCode } from "../../lib/pob/codec";
import { importBuildXml } from "../../lib/pob/importBuild";
import { useCustomizationsStore } from "../../store/customizationsStore";
import type { ImportResult } from "../../lib/pob/types";
import styles from "./PoBImportModal.module.css";

interface Props {
  onClose: () => void;
}

export function PoBImportModal({ onClose }: Props) {
  const createPhases = useCustomizationsStore((s) => s.createPhasesFromPoB);
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);

  function handleImport() {
    setError(null);
    try {
      const xml = decodeBuildCode(raw);
      const result = importBuildXml(xml);
      setPreview(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }

  function handleConfirm() {
    if (!preview) return;
    createPhases(preview.phases);
    onClose();
  }

  const totalWarnings =
    (preview?.generalWarnings.length ?? 0) +
    (preview?.phases.reduce((acc, p) => acc + p.warnings.length, 0) ?? 0);
  const hasContent =
    (preview?.phases.length ?? 0) > 0 &&
    preview!.phases.some((p) => Object.keys(p.gear).length + p.gems.length > 0);

  return (
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>Import from Path of Building</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {!preview && (
          <div className={styles.body}>
            <label className={styles.label}>
              Paste a PoB build code (Import/Export → Generate Build Code in Path of Building):
            </label>
            <textarea
              className={styles.textarea}
              value={raw}
              onChange={(e) => setRaw(e.currentTarget.value)}
              rows={8}
              placeholder="eNrtW..."
              spellCheck={false}
            />
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.actions}>
              <button
                className={styles.primaryBtn}
                disabled={!raw.trim()}
                onClick={handleImport}
              >
                Parse Build
              </button>
            </div>
          </div>
        )}

        {preview && (
          <div className={styles.body}>
            <div className={styles.buildName}>{preview.buildName}</div>

            <div className={styles.phaseList}>
              {preview.phases.map((p, i) => (
                <div key={i} className={styles.phaseRow}>
                  <span className={styles.phaseName}>{p.name}</span>
                  <span className={styles.phaseMeta}>
                    {Object.keys(p.gear).length} items, {p.gems.length} skill groups
                  </span>
                  {p.warnings.length > 0 && (
                    <span className={styles.warnBadge}>{p.warnings.length} warnings</span>
                  )}
                </div>
              ))}
            </div>

            {totalWarnings > 0 && (
              <details className={styles.warnings}>
                <summary>{totalWarnings} warnings</summary>
                <ul>
                  {preview.generalWarnings.map((w, i) => <li key={`g-${i}`}>{w.message}</li>)}
                  {preview.phases.flatMap((p, i) =>
                    p.warnings.map((w, j) => (
                      <li key={`${i}-${j}`}><strong>{p.name}:</strong> {w.message}</li>
                    )),
                  )}
                </ul>
              </details>
            )}

            <div className={styles.actions}>
              <button className={styles.secondaryBtn} onClick={() => setPreview(null)}>
                Back
              </button>
              <button
                className={styles.primaryBtn}
                disabled={!hasContent}
                onClick={handleConfirm}
              >
                Create {preview.phases.length} phase{preview.phases.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
