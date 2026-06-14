"use client";
import { Card, Skeleton, Empty, Tooltip, Progress } from "antd";
import { SafetyOutlined } from "@ant-design/icons";
import type { RiskSummaryResponse } from "@g-fund/types";

interface RiskSummaryCardProps {
  data: RiskSummaryResponse | null;
  loading: boolean;
}

function pct(value: number): string {
  return (value * 100).toFixed(2) + "%";
}

function riskColor(value: number, thresholds: [number, number]): string {
  if (value <= thresholds[0]) return "#52c41a";
  if (value <= thresholds[1]) return "#faad14";
  return "#ff4d4f";
}

export default function RiskSummaryCard({ data, loading }: RiskSummaryCardProps) {
  if (loading) {
    return (
      <Card title={<><SafetyOutlined /> 组合风险简表</>} style={{ height: "100%" }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  if (!data || data.snapshotDays < 2) {
    return (
      <Card title={<><SafetyOutlined /> 组合风险简表</>} style={{ height: "100%" }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="快照数据不足，无法计算风险指标"
          style={{ margin: "24px 0" }}
        />
      </Card>
    );
  }

  const metrics: { label: string; tooltip: string; value: number; thresholds: [number, number] }[] = [
    {
      label: "最大回撤",
      tooltip: "历史全周期内，从峰值到谷底的最大跌幅",
      value: data.maxDrawdown,
      thresholds: [0.1, 0.2],
    },
    {
      label: "年化波动率",
      tooltip: "基于日收益率标准差×√252，反映组合价格波动程度",
      value: data.annualizedVolatility,
      thresholds: [0.15, 0.3],
    },
    {
      label: "当前回撤",
      tooltip: "当前净值相对历史最高点的跌幅",
      value: data.currentDrawdown,
      thresholds: [0.05, 0.15],
    },
  ];

  return (
    <Card
      title={<><SafetyOutlined /> 组合风险简表</>}
      style={{ height: "100%" }}
      styles={{ body: { padding: "16px" } }}
      extra={
        <span style={{ fontSize: 12, color: "#8c8c8c" }}>
          基于 {data.snapshotDays} 个交易日
        </span>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {metrics.map((m) => {
          const color = riskColor(m.value, m.thresholds);
          const percent = Math.min(m.value / (m.thresholds[1] * 1.5), 1) * 100;
          return (
            <div key={m.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <Tooltip title={m.tooltip}>
                  <span style={{ fontSize: 13, color: "#595959", cursor: "default" }}>{m.label}</span>
                </Tooltip>
                <span style={{ fontSize: 15, fontWeight: 600, color }}>{pct(m.value)}</span>
              </div>
              <Progress
                percent={percent}
                showInfo={false}
                strokeColor={color}
                trailColor="#f0f0f0"
                size="small"
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
