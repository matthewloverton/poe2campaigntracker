import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, horizontalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SkillGroup, BuildGemEntry } from "../../types/buildPlan";
import { GEM_COLOR_CSS } from "../../types/itemDatabase";
import styles from "./SkillRow.module.css";

interface SkillRowProps {
  group: SkillGroup;
  onSupportClick: (index: number) => void;
  onRemoveSupport: (index: number) => void;
  onRemoveSkill: () => void;
  onReorderSupports: (fromIndex: number, toIndex: number) => void;
}

const SUPPORT_SLOTS = 5;

function SortableSupport({
  gem, index, onRemoveSupport,
}: {
  gem: BuildGemEntry;
  index: number;
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
      onClick={() => { if (!active) onRemoveSupport(index); }}
      title={`${gem.name} (click to remove, drag to reorder)`}
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
  onSupportClick,
  onRemoveSupport,
  onRemoveSkill,
  onReorderSupports,
}: SkillRowProps) {
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
    <div className={styles.row}>
      {/* Skill gem */}
      <div
        className={styles.skillGem}
        style={{ borderColor: skillColor }}
        onClick={onRemoveSkill}
        title={`${skill.name} (click to remove)`}
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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
                  onRemoveSupport={onRemoveSupport}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
