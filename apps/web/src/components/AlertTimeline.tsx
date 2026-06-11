"use client";
import { Card, Timeline, Typography, Skeleton, Empty, Tag } from "antd";
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import type { SlpSignalLog, SignalLevel } from "@g-fund/types";
import { DEEP_LOSS_DECISION_LABELS } from "@g-fund/types";

const { Text } = Typography;

const SIGNAL_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  take_profit: { color: "#52c41a", icon: <CheckCircleOutlined />, label: "止盈" },
  stop_loss: { color: "#ff4d4f", icon: <CloseCircleOutlined />, label: "止损" },
  warning: { color: "#faad14", icon: <WarningOutlined />, label: "预警" },
  deep_loss: { color: "#ff4d4f", icon: <CloseCircleOutlined />, label: "深度套牢" },
};

const LEVEL_COLORS: Record<SignalLevel, string> = {
  green: "#52c41a",
  blue: "#1677ff",
  yellow: "#faad14",
  red: "#ff4d4f",
};

interface AlertTimelineProps {
  data: SlpSignalLog[];
  loading: boolean;
}

export default function AlertTimeline({ data, loading }: AlertTimelineProps) {
  const sorted = [...data].sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());

  if (loading) {
    return (
      <Card title={<><ClockCircleOutlined /> 预警时间线</>} style={{ height: "100%" }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  return (
    <Card
      title={<><ClockCircleOutlined /> 预警时间线</>}
      style={{ height: "100%" }}
      styles={{ body: { padding: "12px 16px", maxHeight: 400, overflow: "auto" } }}
    >
      {sorted.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无预警记录"
          style={{ margin: "24px 0" }}
        />
      ) : (
        <Timeline
          items={sorted.slice(0, 10).map((log) => {
            const config = SIGNAL_CONFIG[log.signalType] ?? SIGNAL_CONFIG.warning;
            const time = new Date(log.triggeredAt);
            const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
            return {
              dot: <span style={{ color: LEVEL_COLORS[log.level] ?? config.color }}>{config.icon}</span>,
              children: (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>{log.fundCode}</Text>
                    <Tag color={config.color} style={{ margin: 0, fontSize: 11 }}>
                      {config.label}
                    </Tag>
                    {log.resolved && <Tag color="default" style={{ fontSize: 10 }}>已解决</Tag>}
                  </div>
                  {log.message && (
                    <Text type="secondary" style={{ fontSize: 12 }}>{log.message}</Text>
                  )}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {log.pnlRate && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        收益率：<Text style={{ color: LEVEL_COLORS[log.level] }}>{(parseFloat(log.pnlRate) * 100).toFixed(2)}%</Text>
                      </Text>
                    )}
                    {log.deepLossDecision && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        决策：{DEEP_LOSS_DECISION_LABELS[log.deepLossDecision]}
                      </Text>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>{timeStr}</Text>
                  </div>
                </div>
              ),
            };
          })}
        />
      )}
    </Card>
  );
}
