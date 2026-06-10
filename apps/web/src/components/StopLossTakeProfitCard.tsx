"use client";
import { Card, Tag, Typography, Skeleton, Empty } from "antd";
import { AlertOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined } from "@ant-design/icons";
import type { StopLossTakeProfitSignal } from "@g-fund/types";

const { Text } = Typography;

const LEVEL_CONFIG = {
  green: { color: "#52c41a", icon: <CheckCircleOutlined />, label: "安全" },
  yellow: { color: "#faad14", icon: <WarningOutlined />, label: "警告" },
  red: { color: "#ff4d4f", icon: <CloseCircleOutlined />, label: "危险" },
};

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
      styles={{ body: { padding: "12px 16px" } }}
    >
      {!hasAlerts ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无触发信号"
          style={{ margin: "24px 0" }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {triggered.slice(0, 5).map((signal) => {
            const config = LEVEL_CONFIG[signal.level];
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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: config.color, fontWeight: 600 }}>
                    {signal.pnlRate}
                  </Text>
                  <Tag color={config.color} style={{ margin: 0 }}>
                    {signal.signalType === "take_profit" ? "止盈" : "止损"}
                  </Tag>
                </div>
              </div>
            );
          })}
          {triggered.length > 5 && (
            <Text type="secondary" style={{ textAlign: "center", fontSize: 12 }}>
              还有 {triggered.length - 5} 个信号...
            </Text>
          )}
        </div>
      )}
    </Card>
  );
}
