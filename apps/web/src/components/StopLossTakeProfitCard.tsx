"use client";
import { Card, Tag, Typography, Skeleton, Empty } from "antd";
import { AlertOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from "@ant-design/icons";
import type { StopLossTakeProfitSignal } from "@g-fund/types";

const { Text } = Typography;

const SIGNAL_CONFIG: Record<StopLossTakeProfitSignal['signalType'], { color: string; icon: React.ReactNode; label: string }> = {
  take_profit: { color: "#52c41a", icon: <CheckCircleOutlined />, label: "止盈" },
  stop_loss: { color: "#ff4d4f", icon: <CloseCircleOutlined />, label: "止损" },
  warning: { color: "#faad14", icon: <WarningOutlined />, label: "预警" },
  deep_loss: { color: "#ff4d4f", icon: <CloseCircleOutlined />, label: "深度套牢" },
};

function formatNextTierGap(gap: number | undefined): string {
  if (gap === undefined || gap === null) return "";
  const prefix = gap > 0 ? "距止盈" : "距止损";
  return `${prefix} ${Math.abs(gap * 100).toFixed(1)}%`;
}

interface StopLossTakeProfitCardProps {
  data: StopLossTakeProfitSignal[];
  loading: boolean;
}

export default function StopLossTakeProfitCard({ data, loading }: StopLossTakeProfitCardProps) {
  const triggered = data.filter((s) => s.triggered);
  const hasAlerts = triggered.length > 0;

  if (loading) {
    return (
      <Card title={<><AlertOutlined /> 止盈止损</>} style={{ height: "100%" }}>
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    );
  }

  return (
    <Card
      title={<><AlertOutlined /> 止盈止损</>}
      style={{ height: "100%" }}
      styles={{ body: { padding: "12px 16px", maxHeight: 400, overflow: "auto" } }}
    >
      {!hasAlerts ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无触发信号"
          style={{ margin: "24px 0" }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {triggered.map((signal) => {
            const config = SIGNAL_CONFIG[signal.signalType];
            return (
              <div
                key={`${signal.fundCode}-${signal.signalType}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: `${config.color}10`,
                  border: `1px solid ${config.color}30`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: config.color }}>{config.icon}</span>
                  <div>
                    <Text strong style={{ fontSize: 13 }}>{signal.fundName}</Text>
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{signal.fundCode}</Text>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: config.color, fontWeight: 600 }}>
                      {(parseFloat(signal.pnlRate) * 100).toFixed(2)}%
                    </Text>
                    <Tag color={config.color} style={{ margin: 0 }}>
                      {config.label}
                    </Tag>
                  </div>
                  {signal.nextTierGap !== undefined && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {formatNextTierGap(signal.nextTierGap)}
                    </Text>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
