"use client";
import { Card, Tag, Typography, Skeleton, Empty, Tooltip } from "antd";
import { SwapOutlined, InfoCircleOutlined } from "@ant-design/icons";
import type { RebalanceResponse } from "@g-fund/types";

const { Text } = Typography;

interface RebalanceCardProps {
  data: RebalanceResponse | null;
  loading: boolean;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatRatio(ratio: number): string {
  return ratio.toFixed(1) + "%";
}

export default function RebalanceCard({ data, loading }: RebalanceCardProps) {
  if (loading) {
    return (
      <Card title={<><SwapOutlined /> 再平衡建议</>} style={{ height: "100%" }}>
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    );
  }

  const suggestions = data?.suggestions ?? [];
  const actionCount = suggestions.length;

  return (
    <Card
      title={
        <>
          <SwapOutlined /> 再平衡建议 <Tooltip title="当基金实际持仓比例偏离目标配置超过阈值时，生成买入/卖出建议以恢复平衡"><InfoCircleOutlined style={{ fontSize: 13, color: "#999" }} /></Tooltip>
          {actionCount > 0 && (
            <Tag color="blue" style={{ marginLeft: 8 }}>{actionCount}</Tag>
          )}
        </>
      }
      style={{ height: "100%" }}
      styles={{ body: { padding: "12px 16px", maxHeight: 400, overflow: "auto" } }}
    >
      {suggestions.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={data ? "仓位均衡，无需调整" : "暂无持仓数据"}
          style={{ margin: "24px 0" }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {suggestions.map((s) => {
            const isBuy = s.action === "buy";
            const color = isBuy ? "#52c41a" : "#ff4d4f";
            const deviationAbs = Math.abs(s.deviation).toFixed(1);
            return (
              <div
                key={s.fundCode}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: `${color}10`,
                  border: `1px solid ${color}30`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ minWidth: 0 }}>
                    <Text strong style={{ fontSize: 13, display: "block" }} ellipsis>
                      {s.fundName}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{s.fundCode}</Text>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                    <Text style={{ color, fontWeight: 600, fontSize: 14 }}>
                      {isBuy ? "+" : "-"}¥{formatAmount(s.amount)}
                    </Text>
                    <Tag color={isBuy ? "success" : "error"} style={{ margin: 0 }}>
                      {isBuy ? "买入" : "卖出"}
                    </Tag>
                  </div>
                  <Tooltip title={`当前 ${formatRatio(s.currentRatio)} → 目标 ${formatRatio(s.targetRatio)}`}>
                    <Text type="secondary" style={{ fontSize: 11, cursor: "default" }}>
                      偏离 {s.deviation > 0 ? "+" : "-"}{deviationAbs}%
                    </Text>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
