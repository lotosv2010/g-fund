"use client";
import { Card, Timeline, Typography, Skeleton, Empty, Tag } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import type { SlpSignalLog } from "@g-fund/types";
import { DEEP_LOSS_DECISION_LABELS } from "@g-fund/types";
import { SIGNAL_CONFIG, LEVEL_COLORS, formatPnlRate } from "@/lib/signal-config";

const { Text } = Typography;

interface AlertTimelineProps {
  data: SlpSignalLog[];
  loading: boolean;
}

export default function AlertTimeline({ data, loading }: AlertTimelineProps) {
  const SIGNAL_TYPE_ORDER: Record<string, number> = { deep_loss: 0, stop_loss: 1, take_profit: 2, warning: 3 };
  const LEVEL_ORDER: Record<string, number> = { red: 0, yellow: 1, blue: 2, green: 3 };

  // 按 (fundCode, signalType, date) 去重，保留同组最新一条
  const deduped = new Map<string, SlpSignalLog>();
  for (const log of data) {
    const dateKey = new Date(log.triggeredAt).toISOString().split("T")[0];
    const key = `${log.fundCode}|${log.signalType}|${dateKey}`;
    const existing = deduped.get(key);
    if (!existing || new Date(log.triggeredAt) > new Date(existing.triggeredAt)) {
      deduped.set(key, log);
    }
  }

  const sorted = [...deduped.values()].sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    const ta = SIGNAL_TYPE_ORDER[a.signalType] ?? 9;
    const tb = SIGNAL_TYPE_ORDER[b.signalType] ?? 9;
    if (ta !== tb) return ta - tb;
    const la = LEVEL_ORDER[a.level] ?? 9;
    const lb = LEVEL_ORDER[b.level] ?? 9;
    if (la !== lb) return la - lb;
    return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime();
  });

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
      styles={{ body: { padding: "12px 16px", height: "calc(100% - 56px)", overflow: "auto" } }}
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
                        收益率：<Text style={{ color: LEVEL_COLORS[log.level] }}>{formatPnlRate(log.pnlRate)}</Text>
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
