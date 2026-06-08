"use client";
import { Card, Empty, Skeleton } from "antd";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { PositionListItem } from "@g-fund/types";
import { useMemo } from "react";

const COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#6b7280"];

interface PositionPieProps {
  data: PositionListItem[];
  loading: boolean;
}

interface PieDatum {
  name: string;
  value: number;
}

export default function PositionPie({ data, loading }: PositionPieProps) {
  const chartData = useMemo<PieDatum[]>(() => {
    const map = new Map<string, number>();
    for (const pos of data) {
      const type = pos.type ?? "其他";
      map.set(type, (map.get(type) ?? 0) + parseFloat(pos.currentValue));
    }
    return Array.from(map, ([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [data]);

  if (loading) {
    return (
      <Card title="持仓分布" style={{ height: "100%" }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card title="持仓分布" style={{ height: "100%" }}>
        <Empty description="暂无持仓数据" />
      </Card>
    );
  }

  return (
    <Card title="持仓分布">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(val) => `¥${Number(val).toLocaleString()}`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
