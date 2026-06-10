"use client";
import { Card, Timeline, Typography, Skeleton, Empty, Tag } from "antd";
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import type { StopLossTakeProfitSignal } from "@g-fund/types";

const { Text } = Typography;

const SIGNAL_CONFIG = {
  take_profit: { color: "#52c41a", icon: <CheckCircleOutlined />, label: "止盈" },
  stop_loss: { color: "#ff4d4f", icon: <CloseCircleOutlined />, label: "止损" },
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
            const config = SIGNAL_CONFIG[signal.signalType];
            return {
              dot: <span style={{ color: config.color }}>{config.icon}</span>,
              children: (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>{signal.fundName}</Text>
                    <Tag color={config.color} style={{ margin: 0, fontSize: 11 }}>
                      {config.label}
                    </Tag>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {signal.message}
                  </Text>
                  <div style={{ display: "flex", gap: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      收益率：<Text style={{ color: config.color }}>{(parseFloat(signal.pnlRate) * 100).toFixed(2)}%</Text>
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
