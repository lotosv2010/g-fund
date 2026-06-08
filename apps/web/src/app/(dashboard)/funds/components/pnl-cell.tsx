"use client";

interface PnlCellProps {
  value: string;
}

export function PnlCell({ value }: PnlCellProps) {
  const n = parseFloat(value);
  const color = n > 0 ? "#dc2626" : n < 0 ? "#16a34a" : "#6b7280";
  const prefix = n > 0 ? "+" : "";
  return <span style={{ color }}>{prefix}{value}</span>;
}
