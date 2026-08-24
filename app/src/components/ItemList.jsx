import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatIssueTooltip } from "../utils.js";

function ItemRowContent({ entry, dragHandleProps = null, handleRef = null }) {
  const editLabel = `Edit ${entry.title}${entry.privateTitle ? ` (${entry.privateTitle})` : ""}`;
  const issues = entry.issues ?? [];
  const hasIssues = issues.length > 0;
  const issueText = hasIssues ? formatIssueTooltip(issues) : "";
  return (
    <>
      {dragHandleProps ? (
        <button
          type="button"
          className="drag-handle"
          ref={handleRef}
          aria-label={`Reorder ${entry.title}${entry.privateTitle ? ` (${entry.privateTitle})` : ""}. Drag, or use arrow keys to move.`}
          data-tooltip={`Reorder ${entry.title}`}
          aria-describedby={hasIssues ? `issues-${entry.key}` : undefined}
          {...dragHandleProps}
        >
          <span aria-hidden="true">⋮⋮</span>
        </button>
      ) : null}
      {hasIssues ? (
        <span id={`issues-${entry.key}`} className="visually-hidden">
          {issueText}
        </span>
      ) : null}
      <button
        type="button"
        className="item-card"
        aria-label={editLabel}
        aria-describedby={hasIssues ? `issues-${entry.key}` : undefined}
        data-tooltip={hasIssues ? issueText : editLabel}
        onClick={() => entry.onClick?.()}
      >
        <span className="title">{entry.title}</span>
        {entry.privateTitle ? (
          <span className="private-name">
            <span className="private-tag">private</span> {entry.privateTitle}
          </span>
        ) : null}
        {entry.meta ? <span className="meta">{entry.meta}</span> : null}
      </button>
    </>
  );
}

function StaticRow({ entry }) {
  const hasIssues = (entry.issues?.length ?? 0) > 0 || entry.misaligned;
  return (
    <li
      className={["item-row", hasIssues ? "item-row-misaligned" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      <ItemRowContent
        entry={{
          ...entry,
          issues:
            entry.issues ??
            (entry.misaligned
              ? [
                  "Out of date order: missing a date here, or newer than the entry above.",
                ]
              : []),
        }}
      />
    </li>
  );
}

function SortableRow({ entry }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.key });
  const hasIssues = (entry.issues?.length ?? 0) > 0 || entry.misaligned;

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={[
        "item-row",
        hasIssues ? "item-row-misaligned" : "",
        isDragging ? "item-row-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ItemRowContent
        entry={{
          ...entry,
          issues:
            entry.issues ??
            (entry.misaligned
              ? [
                  "Out of date order: missing a date here, or newer than the entry above.",
                ]
              : []),
        }}
        handleRef={setActivatorNodeRef}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </li>
  );
}

function itemsSignature(items) {
  return items.map((entry) => entry.key).join("\0");
}

export function ItemList({
  items,
  emptyLabel = "No items yet.",
  onReorder,
}) {
  const [localItems, setLocalItems] = useState(items);
  const [activeId, setActiveId] = useState(null);

  // Sync from parent when the saved order changes (not during an active drag).
  useEffect(() => {
    if (activeId) return;
    setLocalItems(items);
  }, [items, activeId]);

  const ids = useMemo(
    () => localItems.map((entry) => entry.key),
    [localItems],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (!localItems.length) {
    return <p className="empty">{emptyLabel}</p>;
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!onReorder || !over || active.id === over.id) return;

    const oldIndex = localItems.findIndex((entry) => entry.key === active.id);
    const newIndex = localItems.findIndex((entry) => entry.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(localItems, oldIndex, newIndex);
    setLocalItems(next);
    onReorder(next);
  }

  if (!onReorder) {
    return (
      <ul className="item-list" aria-label="Editable items">
        {items.map((entry) => (
          <StaticRow key={entry.key} entry={entry} />
        ))}
      </ul>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) => setActiveId(String(event.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul
          className={`item-list${activeId ? " item-list-dragging" : ""}`}
          aria-label="Editable items"
          data-order={itemsSignature(localItems)}
        >
          {localItems.map((entry) => (
            <SortableRow key={entry.key} entry={entry} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
