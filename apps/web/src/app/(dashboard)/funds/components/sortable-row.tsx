"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  "data-row-key"?: string;
}

export function SortableRow(props: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props["data-row-key"] ?? "",
  });
  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { position: "relative" as const, zIndex: 9999, opacity: 0.8 } : {}),
  };
  return <tr {...props} ref={setNodeRef} style={style} {...attributes} {...listeners} />;
}
