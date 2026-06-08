"use client";

import { HolderOutlined } from "@ant-design/icons";
import { useSortable } from "@dnd-kit/sortable";

interface DragHandleProps {
  id: string;
}

export function DragHandle({ id }: DragHandleProps) {
  const { attributes, listeners, setNodeRef } = useSortable({ id });
  return (
    <HolderOutlined
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ cursor: "grab", color: "#999", fontSize: 16 }}
    />
  );
}
