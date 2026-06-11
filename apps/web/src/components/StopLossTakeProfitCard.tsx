"use client";
import { Card, Tag, Typography, Skeleton, Empty } from "antd";
import { AlertOutlined } from "@ant-design/icons";
import type { StopLossTakeProfitSignal } from "@g-fund/types";
import { SIGNAL_CONFIG, LEVEL_COLORS, formatPnlRate } from "@/lib/signal-config";

const { Text } = Typography;

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

  // 按 fundCode 分组，每只基金取最高优先级信号
  const fundSignals = new Map<string, StopLossTakeProfitSignal>();
  for (const s of data) {
    const existing = fundSignals.get(s.fundCode);
    if (!existing) {
      fundSignals.set(s.fundCode, s);
    } else {
      // 优先保留非绿色信号
      const existingIsGreen = existing.level === 'green' && existing.signalType === 'warning';
      const currentIsGreen = s.level === 'green' && s.signalType === 'warning';
      if (existingIsGreen && !currentIsGreen) {
        fundSignals.set(s.fundCode, s);
      }
    }
  }
  const displaySignals = [...fundSignals.values()];
  const alertCount = displaySignals.filter((s) => s.level !== 'green' || s.signalType !== 'warning').length;

  if (loading) {
    return (
      <Card title={<><AlertOutlined /> 止盈止损</>} style={{ height: "100%" }}>
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    );
  }

  return (
    <Card
      title={<><AlertOutlined /> 止盈止损{alertCount > 0 && <Tag color="red" style={{ marginLeft: 8 }}>{alertCount}</Tag>}</>}
      style={{ height: "100%" }}
      styles={{ body: { padding: "12px 16px", maxHeight: 400, overflow: "auto" } }}
    >
      {displaySignals.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无持仓数据"
          style={{ margin: "24px 0" }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {displaySignals.map((signal) => {
            const isGreen = signal.level === 'green' && signal.signalType === 'warning';
            const config = SIGNAL_CONFIG[signal.signalType] ?? SIGNAL_CONFIG.warning;
            const color = isGreen ? LEVEL_COLORS.green : (LEVEL_COLORS[signal.level] ?? config.color);
            return (
              <div
                key={`${signal.fundCode}-${signal.signalType}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: isGreen ? '#f6ffed10' : `${color}10`,
                  border: `1px solid ${isGreen ? '#f6ffed30' : `${color}30`}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color }}>{config.icon}</span>
                  <div>
                    <Text strong style={{ fontSize: 13, color: isGreen ? undefined : undefined }}>{signal.fundName}</Text>
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{signal.fundCode}</Text>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Text style={{ color, fontWeight: isGreen ? 400 : 600 }}>
                      {formatPnlRate(signal.pnlRate)}
                    </Text>
                    <Tag color={isGreen ? 'default' : color} style={{ margin: 0 }}>
                      {isGreen ? '正常' : config.label}
                    </Tag>
                  </div>
                  {!isGreen && signal.nextTierGap !== undefined && (
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
