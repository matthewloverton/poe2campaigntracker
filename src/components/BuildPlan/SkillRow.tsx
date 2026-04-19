import { useState } from "react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, horizontalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import type { SkillGroup, BuildGemEntry } from "../../types/buildPlan";
import { GEM_COLOR_CSS } from "../../types/itemDatabase";
import type { SkillDps } from "../../lib/dps";
import { DpsValue } from "../Dps/DpsValue";
import { DpsBreakdown } from "../Dps/DpsBreakdown";
import styles from "./SkillRow.module.css";

interface SkillRowProps {
  group: SkillGroup;
  /** Optional DPS result for this skill. When provided, inline DPS column renders. */
  dps?: SkillDps;
  /** Whether this is the primary skill (drives the star state). */
  isPrimary?: boolean;
  /** When provided, shows a star-toggle button. */
  onTogglePrimary?: () => void;

  onSkillClick: () => void;
  onSupportClick: (index: number) => void;
  onRemoveSupport: (index: number) => void;
  onRemoveSkill: () => void;
  onReorderSupports: (fromIndex: number, toIndex: number) => void;

  /** Current skill level (display). */
  skillLevel?: number;
  /** Callback when skill level changes. When undefined, no stepper is shown. */
  onSkillLevelChange?: (level: number) => void;
  /** Min level (typically the gem's craftingLevel). */
  minSkillLevel?: number;
  /** Max level (typically skillDetail.maxLevel). */
  maxSkillLevel?: number;
}

const SUPPORT_SLOTS = 5;

function SortableSupport({
  gem, index, onSupportClick, onRemoveSupport,
}: {
  gem: BuildGemEntry;
  index: number;
  onSupportClick: (index: number) => void;
  onRemoveSupport: (index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, active } = useSortable({
    id: `support-${index}`,
  });
  const style = {
    transform: CSS.Transform.toString(transform ? { ...transform, y: 0 } : null),
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const color = gem.color ? GEM_COLOR_CSS[gem.color] : GEM_COLOR_CSS.w;
  const icon = gem.iconPath ? `/assets/${gem.iconPath}` : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderColor: color }}
      className={`${styles.supportSocket} ${styles.supportFilled}`}
      onClick={() => { if (!active) onSupportClick(index); }}
      onContextMenu={(e) => { e.preventDefault(); if (!active) onRemoveSupport(index); }}
      title={`${gem.name} (click to replace, right-click to remove)`}
      {...attributes}
      {...listeners}
    >
      {icon ? (
        <img className={styles.supportImage} src={icon} alt={gem.name} />
      ) : (
        <span className={styles.supportFallback}>{gem.name}</span>
      )}
    </div>
  );
}

export function SkillRow({
  group,
  dps,
  isPrimary,
  onTogglePrimary,
  onSkillClick,
  onSupportClick,
  onRemoveSupport,
  onRemoveSkill,
  onReorderSupports,
  skillLevel,
  onSkillLevelChange,
  minSkillLevel,
  maxSkillLevel,
}: SkillRowProps) {
  const [expanded, setExpanded] = useState(false);

  const skill = group.skill;
  const skillColor = skill.color ? GEM_COLOR_CSS[skill.color] : GEM_COLOR_CSS.w;
  const skillIcon = skill.iconPath ? `/assets/${skill.iconPath}` : undefined;

  const supports: (BuildGemEntry | null)[] = [];
  for (let i = 0; i < SUPPORT_SLOTS; i++) {
    supports.push(group.supports[i] ?? null);
  }

  // Build sortable IDs for filled supports only
  const filledIndices = supports.map((s, i) => s ? i : -1).filter((i) => i >= 0);
  const sortableIds = filledIndices.map((i) => `support-${i}`);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = Number(String(active.id).replace("support-", ""));
    const toIdx = Number(String(over.id).replace("support-", ""));
    onReorderSupports(fromIdx, toIdx);
  }

  return (
    <div className={`${styles.row} ${expanded ? styles.expanded : ""}`}>
      <div className={styles.rowMain}>
        {/* Primary star (leftmost) */}
        {onTogglePrimary && (
          <button
            type="button"
            className={`${styles.primaryStar} ${isPrimary ? styles.primaryStarActive : ""}`}
            onClick={onTogglePrimary}
            aria-label={isPrimary ? "Primary skill" : "Mark as primary"}
            title={isPrimary ? "Primary skill" : "Mark as primary"}
          >
            ★
          </button>
        )}

        {/* Skill gem */}
        <div
          className={styles.skillGem}
          style={{ borderColor: skillColor }}
          onClick={onSkillClick}
          onContextMenu={(e) => { e.preventDefault(); onRemoveSkill(); }}
          title={`${skill.name} (click to replace, right-click to remove)`}
        >
          {skillIcon ? (
            <img className={styles.skillGemImage} src={skillIcon} alt={skill.name} />
          ) : (
            <span className={styles.skillGemFallback}>{skill.name}</span>
          )}
          <span className={styles.priorityBadge}>{group.priority + 1}</span>
        </div>

        {/* Skill name */}
        <span className={styles.skillName}>{skill.name}</span>

        {/* Support sockets */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToParentElement]}>
          <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
            <div className={styles.supports}>
              {supports.map((sup, i) => {
                if (!sup) {
                  return (
                    <div
                      key={i}
                      className={`${styles.supportSocket} ${styles.supportEmpty}`}
                      onClick={() => onSupportClick(i)}
                      title="Add support gem"
                    >
                      <span className={styles.emptyPlus}>+</span>
                    </div>
                  );
                }

                return (
                  <SortableSupport
                    key={i}
                    gem={sup}
                    index={i}
                    onSupportClick={onSupportClick}
                    onRemoveSupport={onRemoveSupport}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        {/* Level stepper */}
        {onSkillLevelChange && skillLevel !== undefined && (
          <div className={styles.levelStepper}>
            <button
              type="button"
              className={styles.levelButton}
              onClick={() => onSkillLevelChange(Math.max(minSkillLevel ?? 1, skillLevel - 1))}
              disabled={skillLevel <= (minSkillLevel ?? 1)}
              aria-label="Decrease skill level"
            >−</button>
            <span className={styles.levelValue}>L{skillLevel}</span>
            <button
              type="button"
              className={styles.levelButton}
              onClick={() => onSkillLevelChange(Math.min(maxSkillLevel ?? 40, skillLevel + 1))}
              disabled={skillLevel >= (maxSkillLevel ?? 40)}
              aria-label="Increase skill level"
            >+</button>
          </div>
        )}

        {/* DPS column */}
        <div className={styles.dpsColumn}>
          {dps ? (
            <button
              type="button"
              className={styles.dpsTrigger}
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse DPS breakdown" : "Expand DPS breakdown"}
            >
              <DpsValue dps={dps.dps} />
              <span className={styles.caret}>{expanded ? "▾" : "▸"}</span>
            </button>
          ) : (
            <span className={styles.dpsPlaceholder}>—</span>
          )}
        </div>
      </div>

      {expanded && dps && (
        <div className={styles.rowBreakdown}>
          <DpsBreakdown breakdown={dps.breakdown} />
        </div>
      )}
    </div>
  );
}
