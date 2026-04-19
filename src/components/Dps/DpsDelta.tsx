import { useMemo, useState } from "react";
import { useDps } from "../../hooks/useDps";
import { snapshotFromPhase, swapWeapon } from "../../lib/dps";
import type { BuildPhase, BuildGearEntry } from "../../types/buildPlan";
import type { RollMode } from "../../lib/dps";
import { DpsValue, formatDps } from "./DpsValue";
import { DpsBreakdown } from "./DpsBreakdown";
import styles from "./DpsDelta.module.css";

interface DpsDeltaProps {
  /** The active Build Plan phase providing gear + skills context. */
  phase: BuildPhase | null;
  /** The weapon currently being rolled in the Craft Emulator. */
  rolledWeapon: BuildGearEntry | null;
  /** Optional starting skill id to preselect. */
  initialSkillId?: string;
  /** Roll mode to use for the calculation. Defaults to "actual". */
  rollMode?: RollMode;
}

export function DpsDelta({
  phase,
  rolledWeapon,
  initialSkillId = "",
  rollMode = "actual",
}: DpsDeltaProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState(initialSkillId);

  // Base (current Build Plan) and swapped (with rolled weapon) snapshots.
  const baseSnap = useMemo(() => {
    if (!phase) return null;
    return snapshotFromPhase(phase, selectedSkillId, rollMode);
  }, [phase, selectedSkillId, rollMode]);

  const swappedSnap = useMemo(() => {
    if (!baseSnap || !rolledWeapon) return null;
    return swapWeapon(baseSnap, rolledWeapon);
  }, [baseSnap, rolledWeapon]);

  // useDps must be called unconditionally; pass an empty snapshot fallback.
  const EMPTY_SNAP = useMemo(
    () => ({
      gear: {
        weapon: null, weaponSwap: null,
        offhand: null, offhandSwap: null,
        helmet: null, bodyArmour: null,
        gloves: null, boots: null,
        belt: null, amulet: null,
        ring1: null, ring2: null,
      },
      skillGroups: [],
      primarySkillId: "",
      rollMode,
    }),
    [rollMode],
  );

  const baseResults = useDps(baseSnap ?? EMPTY_SNAP);
  const swappedResults = useDps(swappedSnap ?? EMPTY_SNAP);

  if (!phase || !rolledWeapon || baseSnap === null) {
    return null;
  }

  const pick = (results: typeof baseResults) =>
    results.find((r) => r.skillId === (selectedSkillId || baseSnap.primarySkillId))
      ?? results[0];
  const before = pick(baseResults);
  const after = pick(swappedResults);

  if (!before || !after) {
    return (
      <div className={styles.card}>
        <span className={styles.muted}>No active skill to compare against.</span>
      </div>
    );
  }

  const delta = after.dps - before.dps;
  const pct = before.dps > 0 ? (delta / before.dps) * 100 : 0;
  const deltaClass = delta > 0.05 ? styles.gain : delta < -0.05 ? styles.loss : styles.neutral;

  return (
    <div className={styles.card}>
      <header className={styles.header}>
        <span className={styles.label}>Impact on</span>
        <select
          className={styles.skillSelect}
          value={selectedSkillId || baseSnap.primarySkillId}
          onChange={(e) => setSelectedSkillId(e.target.value)}
        >
          {baseResults.map((r) => (
            <option key={r.skillId} value={r.skillId}>{r.skillName}</option>
          ))}
        </select>
      </header>
      <div className={styles.values}>
        <DpsValue dps={before.dps} suffix="" />
        <span className={styles.arrow}>→</span>
        <DpsValue dps={after.dps} suffix="DPS" />
      </div>
      <div className={`${styles.delta} ${deltaClass}`}>
        <span>
          {delta >= 0 ? "+" : "−"}
          {formatDps(Math.abs(delta))} DPS
          {" "}
          ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
        </span>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse breakdown" : "Expand breakdown"}
        >
          {expanded ? "▾" : "▸"}
        </button>
      </div>
      {expanded && (
        <div className={styles.breakdowns}>
          <div className={styles.breakdownCol}>
            <h5 className={styles.breakdownTitle}>Current</h5>
            <DpsBreakdown breakdown={before.breakdown} />
          </div>
          <div className={styles.breakdownCol}>
            <h5 className={styles.breakdownTitle}>Rolled</h5>
            <DpsBreakdown breakdown={after.breakdown} />
          </div>
        </div>
      )}
    </div>
  );
}
