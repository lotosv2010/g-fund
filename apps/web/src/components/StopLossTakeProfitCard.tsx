"use client";
import { Card, Tag, Typography, Skeleton, Empty, Tooltip } from "antd";
import { AlertOutlined, InfoCircleOutlined } from "@ant-design/icons";
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
  const SIGNAL_TYPE_ORDER: Record<string, number> = { deep_loss: 0, stop_loss: 1, take_profit: 2, warning: 3 };
  const LEVEL_ORDER: Record<string, number> = { red: 0, yellow: 1, blue: 2, green: 3 };
  const displaySignals = [...fundSignals.values()].sort((a, b) => {
    const ta = SIGNAL_TYPE_ORDER[a.signalType] ?? 9;
    const tb = SIGNAL_TYPE_ORDER[b.signalType] ?? 9;
    if (ta !== tb) return ta - tb;
    const la = LEVEL_ORDER[a.level] ?? 9;
    const lb = LEVEL_ORDER[b.level] ?? 9;
    return la - lb;
  });
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
      title={<><AlertOutlined /> 止盈止损 <Tooltip title="监控各基金收益率，当触及预设的止盈/止损阈值时发出信号。信号优先级：深度亏损 > 止损 > 止盈 > 预警"><InfoCircleOutlined style={{ fontSize: 13, color: "#999" }} /></Tooltip>{alertCount > 0 && <Tag color="red" style={{ marginLeft: 8 }}>{alertCount}</Tag>}</>}
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ color, flexShrink: 0 }}>{config.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <Text strong style={{ fontSize: 13, display: 'block' }} ellipsis>{signal.fundName}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{signal.fundCode}</Text>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
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
