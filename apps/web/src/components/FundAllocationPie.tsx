"use client";
import { Card, Empty, Skeleton, Typography, Tooltip } from "antd";
import { FundOutlined, InfoCircleOutlined } from "@ant-design/icons";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { PositionListItem } from "@g-fund/types";

const Pie = dynamic(() => import("@ant-design/charts").then((m) => m.Pie), { ssr: false });

const { Text } = Typography;

const COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a",
  "#0891b2", "#6b7280", "#d97706", "#dc2626", "#059669",
  "#7c2d12", "#1e40af", "#9333ea", "#be185d", "#c2410c",
  "#0369a1", "#4f46e5", "#9f1239", "#c2410c", "#15803d",
];

interface FundAllocationPieProps {
  data: PositionListItem[];
  loading: boolean;
}

export default function FundAllocationPie({ data, loading }: FundAllocationPieProps) {
  const { chartData, totalValue } = useMemo(() => {
    const total = data.reduce((sum, pos) => sum + parseFloat(pos.currentValue), 0);
    const items = data
      .map((pos) => ({
        fundName: pos.fundName.length > 8 ? pos.fundName.slice(0, 8) + "..." : pos.fundName,
        amount: parseFloat(pos.currentValue),
        ratio: total > 0 ? parseFloat(pos.currentValue) / total : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { chartData: items, totalValue: total };
  }, [data]);

  const colors = useMemo(() => chartData.map((_, i) => COLORS[i % COLORS.length]), [chartData]);

  if (loading) {
    return (
      <Card title={<><FundOutlined /> 基金持仓占比 <Tooltip title="展示各基金在总持仓中的金额占比，帮助识别集中度风险"><InfoCircleOutlined style={{ fontSize: 13, color: "#999" }} /></Tooltip></>} style={{ height: "100%" }}>
        <Skeleton active paragraph={{ rows: 5 }} />
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card title={<><FundOutlined /> 基金持仓占比 <Tooltip title="展示各基金在总持仓中的金额占比，帮助识别集中度风险"><InfoCircleOutlined style={{ fontSize: 13, color: "#999" }} /></Tooltip></>} style={{ height: "100%" }}>
        <Empty description="暂无持仓数据" />
      </Card>
    );
  }

  return (
    <Card
      title={<><FundOutlined /> 基金持仓占比 <Tooltip title="展示各基金在总持仓中的金额占比，帮助识别集中度风险"><InfoCircleOutlined style={{ fontSize: 13, color: "#999" }} /></Tooltip></>}
      style={{ height: "100%" }}
      styles={{ body: { padding: "12px 16px", display: "flex", flexDirection: "column", height: "calc(100% - 56px)", overflow: "hidden" } }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <Pie
          height={280}
          data={chartData}
          angleField="amount"
          colorField="fundName"
          color={colors}
          radius={0.85}
          innerRadius={0.55}
          legend={{
            position: "bottom",
            layout: "flex",
            maxRows: 4,
          }}
          label={false}
          tooltip={{
            title: (d: { fundName?: string }) => d.fundName ?? "",
            items: [
              (d: { amount?: number; ratio?: number }) => ({
                name: "金额",
                value: `¥${Math.round(d.amount ?? 0).toLocaleString()}`,
              }),
              (d: { amount?: number; ratio?: number }) => ({
                name: "占比",
                value: `${((d.ratio ?? 0) * 100).toFixed(1)}%`,
              }),
            ],
          }}
          statistic={{
            title: {
              style: { fontSize: 12, color: "#666" },
              content: "总持仓",
            },
            content: {
              style: { fontSize: 14, fontWeight: 600 },
              content: `¥${Math.round(totalValue / 10000).toLocaleString()}万`,
            },
          }}
        />
      </div>
      <div style={{ textAlign: "right", marginTop: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          合计：¥{Math.round(totalValue).toLocaleString()} · {chartData.length} 只基金
        </Text>
      </div>
    </Card>
  );
}
