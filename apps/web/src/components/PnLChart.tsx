"use client";
import { Card, Empty, Skeleton } from "antd";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { DailySnapshot } from "@g-fund/types";
import { useMemo } from "react";

interface PnLChartProps {
  data?: DailySnapshot[];
  loading?: boolean;
}

export default function PnLChart({ data, loading }: PnLChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const sorted = [...data].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
    return sorted.map((s, i) => {
      const pnl = parseFloat(s.totalPnl);
      const prevPnl = i > 0 ? parseFloat(sorted[i - 1].totalPnl) : 0;
      return {
        date: s.snapshotDate.slice(5),
        dailyPnl: i > 0 ? pnl - prevPnl : pnl,
        cumPnl: pnl,
        value: parseFloat(s.totalValue),
      };
    });
  }, [data]);

  if (loading) {
    return (
      <Card title="盈亏曲线" style={{ height: "100%" }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card title="盈亏曲线" style={{ height: "100%" }}>
        <Empty description="暂无快照数据，请先生成快照" style={{ padding: "40px 0" }} />
      </Card>
    );
  }

  return (
    <Card title="盈亏曲线">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(val, name) => [
              `¥${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
              name === "dailyPnl" ? "当日盈亏" : "累计盈亏",
            ]}
            labelFormatter={(label) => `日期: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="dailyPnl"
            stroke="#2563eb"
            fill="#2563eb"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
