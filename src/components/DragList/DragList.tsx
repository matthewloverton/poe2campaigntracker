import { ReactNode, HTMLAttributes } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** Props the consumer spreads onto its chosen drag-handle element. */
export type DragHandleProps = HTMLAttributes<HTMLElement>;

interface DragListProps {
  items: { id: string }[];
  onReorder: (ids: string[]) => void;
  /**
   * Render the row. When `withHandle` is true, spread `handleProps` on the
   * element you want to be the drag affordance — clicks elsewhere in the row
   * (e.g. text selection in inputs) won't initiate a drag.
   */
  renderItem: (
    item: { id: string },
    index: number,
    handleProps: DragHandleProps,
  ) => ReactNode;
  /** When true, the wrapper does not capture pointer events; only the handle does. */
  withHandle?: boolean;
}

interface SortableItemProps {
  id: string;
  withHandle: boolean;
  children: (handleProps: DragHandleProps) => ReactNode;
}

function SortableItem({ id, withHandle, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id });
  const yOnly = transform ? { ...transform, x: 0 } : null;
  const style = {
    transform: CSS.Transform.toString(yOnly),
    transition: "none",
    opacity: isDragging ? 0.5 : 1,
    cursor: withHandle ? "default" : "grab",
  };
  const handleProps = { ...attributes, ...listeners } as DragHandleProps;
  const wrapperProps = withHandle ? {} : handleProps;
  return (
    <div ref={setNodeRef} style={style} {...wrapperProps}>
      {children(handleProps)}
    </div>
  );
}

export function DragList({ items, onReorder, renderItem, withHandle = false }: DragListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      const newItems = [...items];
      const [moved] = newItems.splice(oldIndex, 1);
      newItems.splice(newIndex, 0, moved);
      onReorder(newItems.map((i) => i.id));
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => (
          <SortableItem key={item.id} id={item.id} withHandle={withHandle}>
            {(handleProps) => renderItem(item, index, handleProps)}
          </SortableItem>
        ))}
      </SortableContext>
    </DndContext>
  );
}
