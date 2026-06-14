"use client";
import { Card, Empty, Skeleton } from "antd";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DailySnapshot, BenchmarkComparisonResponse } from "@g-fund/types";
import { useMemo } from "react";

interface PnLChartProps {
  data?: DailySnapshot[];
  benchmark?: BenchmarkComparisonResponse | null;
  loading?: boolean;
}

export default function PnLChart({ data, benchmark, loading }: PnLChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const sorted = [...data].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));

    // 按日期排序的基准点列表，用于最近邻填充
    const benchmarkPoints = benchmark
      ? [...benchmark.points].sort((a, b) => a.date.localeCompare(b.date))
      : [];

    function nearestBenchmark(date: string): number | null {
      if (benchmarkPoints.length === 0) return null;
      // 找最近的基准点（优先 <=，否则取最早的）
      let best = benchmarkPoints[0];
      for (const p of benchmarkPoints) {
        if (p.date <= date) best = p;
        else break;
      }
      return best.benchmarkCumReturn;
    }

    return sorted.map((s) => {
      const totalValue = parseFloat(s.totalValue);
      const totalCost = parseFloat(s.totalCost);
      const portfolioCumReturn = totalCost > 0 ? (totalValue - totalCost) / totalCost : 0;
      const bm = nearestBenchmark(s.snapshotDate);
      return {
        date: s.snapshotDate.slice(5),
        portfolioCumReturn: parseFloat((portfolioCumReturn * 100).toFixed(2)),
        benchmarkCumReturn: bm !== null ? parseFloat((bm * 100).toFixed(2)) : null,
      };
    });
  }, [data, benchmark]);

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

  const hasBenchmark = chartData.some((d) => d.benchmarkCumReturn !== null);

  return (
    <Card title="盈亏曲线" style={{ height: "100%" }} styles={{ body: { height: "calc(100% - 56px)", overflow: "hidden" } }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v) => `${v}%`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            formatter={(val: unknown, name: unknown) => [
              `${Number(val).toFixed(2)}%`,
              name === "portfolioCumReturn" ? "组合收益率" : benchmark?.benchmarkName ?? "沪深300",
            ]}
            labelFormatter={(label) => `日期: ${label}`}
          />
          {hasBenchmark && <Legend formatter={(name) => name === "portfolioCumReturn" ? "组合收益率" : benchmark?.benchmarkName ?? "沪深300"} />}
          <Line
            type="monotone"
            dataKey="portfolioCumReturn"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            name="portfolioCumReturn"
          />
          {hasBenchmark && (
            <Line
              type="monotone"
              dataKey="benchmarkCumReturn"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              connectNulls
              name="benchmarkCumReturn"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}
