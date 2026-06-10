"use client";
import { Card, Timeline, Typography, Skeleton, Empty, Tag } from "antd";
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  RiseOutlined,
} from "@ant-design/icons";
import type { StopLossTakeProfitSignal } from "@g-fund/types";

const { Text } = Typography;

const LEVEL_CONFIG = {
  green: { color: "#52c41a", icon: <CheckCircleOutlined /> },
  yellow: { color: "#faad14", icon: <WarningOutlined /> },
  red: { color: "#ff4d4f", icon: <CloseCircleOutlined /> },
};

interface AlertTimelineProps {
  data: StopLossTakeProfitSignal[];
  loading: boolean;
}

export default function AlertTimeline({ data, loading }: AlertTimelineProps) {
  const triggered = data.filter((s) => s.triggered);

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
      {triggered.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无预警记录"
          style={{ margin: "24px 0" }}
        />
      ) : (
        <Timeline
          items={triggered.map((signal) => {
            const config = LEVEL_CONFIG[signal.level];
            return {
              dot: <span style={{ color: config.color }}>{config.icon}</span>,
              children: (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>{signal.fundName}</Text>
                    <Tag
                      color={signal.signalType === "take_profit" ? "green" : "red"}
                      style={{ margin: 0, fontSize: 11 }}
                    >
                      {signal.signalType === "take_profit" ? "止盈" : "止损"}
                    </Tag>
                    <Tag color={config.color} style={{ margin: 0, fontSize: 11 }}>
                      {config.icon} {signal.level === "green" ? "安全" : signal.level === "yellow" ? "警告" : "危险"}
                    </Tag>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {signal.message}
                  </Text>
                  <div style={{ display: "flex", gap: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      收益率：<Text style={{ color: config.color }}>{signal.pnlRate}</Text>
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      阈值：{signal.threshold}
                    </Text>
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
