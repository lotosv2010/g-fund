"use client";
import { Drawer, List, Tag, Empty, Typography } from "antd";
import {
  RiseOutlined,
  FallOutlined,
  AlertOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import type { AnomalyAlert, AnomalyType, AnomalySeverity } from "@g-fund/types";

const { Text } = Typography;

const TYPE_CONFIG: Record<AnomalyType, { label: string; icon: React.ReactNode; color: string }> = {
  price_surge: { label: "涨幅异动", icon: <RiseOutlined />, color: "orange" },
  price_drop: { label: "跌幅异动", icon: <FallOutlined />, color: "volcano" },
  valuation_high: { label: "估值偏高", icon: <ExclamationCircleOutlined />, color: "gold" },
  valuation_low: { label: "估值偏低", icon: <InfoCircleOutlined />, color: "blue" },
  stop_loss: { label: "止损触发", icon: <AlertOutlined />, color: "red" },
  take_profit: { label: "止盈触发", icon: <RiseOutlined />, color: "green" },
};

const SEVERITY_BORDER: Record<AnomalySeverity, string> = {
  danger: "#ff4d4f",
  warning: "#faad14",
  info: "#1677ff",
};

interface AnomalyDrawerProps {
  open: boolean;
  onClose: () => void;
  alerts: AnomalyAlert[];
}

export default function AnomalyDrawer({ open, onClose, alerts }: AnomalyDrawerProps) {
  return (
    <Drawer
      title={`异动提示（${alerts.length}）`}
      placement="right"
      width={400}
      open={open}
      onClose={onClose}
    >
      {alerts.length === 0 ? (
        <Empty description="暂无异动" />
      ) : (
        <List
          dataSource={alerts}
          renderItem={(alert) => {
            const cfg = TYPE_CONFIG[alert.type];
            return (
              <List.Item
                style={{
                  borderLeft: `3px solid ${SEVERITY_BORDER[alert.severity]}`,
                  paddingLeft: 12,
                  marginBottom: 8,
                  alignItems: "flex-start",
                }}
              >
                <List.Item.Meta
                  title={
                    <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Tag color={cfg.color} icon={cfg.icon} style={{ margin: 0 }}>
                        {cfg.label}
                      </Tag>
                      <Text strong>{alert.fundName}</Text>
                    </span>
                  }
                  description={<span style={{ fontSize: 13 }}>{alert.message}</span>}
                />
              </List.Item>
            );
          }}
        />
      )}
    </Drawer>
  );
}
