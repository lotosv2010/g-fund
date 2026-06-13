"use client";
import { Drawer, Space, Tag, Alert, Descriptions, Divider, Typography } from "antd";
import type { StopLossTakeProfitSignal } from "@g-fund/types";
import { SIGNAL_LEVEL_LABELS, DEEP_LOSS_DECISION_LABELS } from "@g-fund/types";

const { Text } = Typography;

const TYPE_LABELS: Record<string, string> = {
  take_profit: "止盈",
  stop_loss: "止损",
  warning: "预警",
  deep_loss: "深度套牢",
};

const TYPE_COLORS: Record<string, string> = {
  take_profit: "green",
  stop_loss: "red",
  warning: "orange",
  deep_loss: "red",
};

interface PositionSignalDrawerProps {
  open: boolean;
  fundCode: string;
  fundName: string;
  signals: StopLossTakeProfitSignal[];
  onClose: () => void;
}

export default function PositionSignalDrawer({
  open,
  fundCode,
  fundName,
  signals,
  onClose,
}: PositionSignalDrawerProps) {
  const isProfit = signals.length > 0 ? parseFloat(signals[0].pnlRate) >= 0 : false;

  return (
    <Drawer
      title={`${fundName}（${fundCode}）— 止盈止损信号`}
      open={open}
      onClose={onClose}
      width={480}
      destroyOnHidden
    >
      {signals.length === 0 ? (
        <Text type="secondary">暂无信号，持仓收益在安全区间</Text>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="成本价">¥{signals[0].costPrice}</Descriptions.Item>
            <Descriptions.Item label="当前价">¥{signals[0].currentPrice}</Descriptions.Item>
            <Descriptions.Item label="收益率">
              <Text style={{ color: isProfit ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
                {(parseFloat(signals[0].pnlRate) * 100).toFixed(2)}%
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="信号数">
              <Tag>{signals.length} 个</Tag>
            </Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: "8px 0" }} />

          {signals.map((s, i) => (
            <Alert
              key={i}
              type={s.level === "red" ? "error" : s.level === "yellow" ? "warning" : "info"}
              message={
                <Space>
                  <Tag color={TYPE_COLORS[s.signalType]}>{TYPE_LABELS[s.signalType]}</Tag>
                  {s.signalType === "warning" && (
                    <Tag color={
                      s.level === "red" ? "red"
                        : s.level === "yellow" ? "orange"
                          : s.level === "blue" ? "blue"
                            : "green"
                    }>
                      {SIGNAL_LEVEL_LABELS[s.level]}
                    </Tag>
                  )}
                  {s.message}
                </Space>
              }
              description={
                <Space direction="vertical" size={4}>
                  <Text type="secondary">阈值：{s.threshold}</Text>
                  {s.nextTierGap !== undefined && (
                    <Text type="secondary">
                      距下一档：{Math.abs(s.nextTierGap * 100).toFixed(1)}%
                    </Text>
                  )}
                  {s.deepLossDecision && (
                    <Text type="secondary">
                      决策：{DEEP_LOSS_DECISION_LABELS[s.deepLossDecision]}
                    </Text>
                  )}
                </Space>
              }
              showIcon
            />
          ))}
        </Space>
      )}
    </Drawer>
  );
}
