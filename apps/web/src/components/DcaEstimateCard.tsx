"use client";
import { Card, Typography, Skeleton, Empty, Progress, Tag, Space, Tooltip, Button, message } from "antd";
import { ScheduleOutlined, DollarOutlined, ThunderboltOutlined, InfoCircleOutlined, CheckCircleOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { useState, useCallback } from "react";
import type { DcaCalculation, DcaSnapshot } from "@g-fund/types";
import { dcaApi } from "@/lib/api-client";

const { Text, Title } = Typography;

interface DcaEstimateCardProps {
  data: DcaCalculation[];
  loading: boolean;
  snapshots?: DcaSnapshot[];
  onSnapshotUpdate?: () => void;
  nextDcaDate?: string | null;
}

const COEFFICIENT_LABELS: Record<string, string> = {
  p0: "QDII 申购",
  p1: "当日大盘",
  p2: "估值百分位",
  p3: "估值水平",
  p4: "优先级",
  tFactor: "大盘趋势",
};

function CoefficientTooltip({ item }: { item: DcaCalculation }) {
  const coefficients = [
    { key: "p0", value: item.p0 },
    { key: "p1", value: item.p1 },
    { key: "p2", value: item.p2 },
    { key: "p3", value: item.p3 },
    { key: "p4", value: item.p4 },
    { key: "tFactor", value: item.tFactor },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 160 }}>
      <Text strong style={{ fontSize: 12, marginBottom: 4 }}>系数明细</Text>
      {coefficients.map(({ key, value }) => (
        <div key={key} style={{ display: "flex", justifyContent: "space-between" }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{COEFFICIENT_LABELS[key]}</Text>
          <Text style={{ fontSize: 12, fontWeight: value !== 1 ? 600 : 400, color: value > 1 ? "#52c41a" : value < 1 ? "#ff4d4f" : undefined }}>
            {value.toFixed(2)}x
          </Text>
        </div>
      ))}
      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 4, marginTop: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <Text strong style={{ fontSize: 12 }}>基础金额</Text>
          <Text style={{ fontSize: 12 }}>¥{parseFloat(item.baseAmount).toFixed(0)}</Text>
        </div>
        {item.rebalanceAdjustment && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>再平衡调整</Text>
            <Text style={{ fontSize: 12, color: "#1677ff" }}>{item.rebalanceAdjustment > 0 ? "+" : ""}{(item.rebalanceAdjustment * 100).toFixed(0)}%</Text>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DcaEstimateCard({ data, loading, snapshots = [], onSnapshotUpdate, nextDcaDate: nextDcaDateProp }: DcaEstimateCardProps) {
  const [messageApi, contextHolder] = message.useMessage();
  const [executing, setExecuting] = useState<number | null>(null);
  const activeItems = data.filter((d) => !d.skipped);
  const totalAmount = activeItems.reduce((sum, d) => sum + parseFloat(d.finalAmount), 0);
  const bulletItems = activeItems.filter((d) => (d.bulletReserveAmount ?? 0) > 0);
  const hasBullet = bulletItems.length > 0;

  const snapshotMap = new Map(snapshots.map((s) => [s.fundCode, s]));

  const handleMarkExecuted = useCallback(async (snapshotId: number) => {
    setExecuting(snapshotId);
    try {
      await dcaApi.markExecuted(snapshotId);
      messageApi.success("已标记为已执行");
      onSnapshotUpdate?.();
    } catch {
      messageApi.error("标记失败");
    } finally {
      setExecuting(null);
    }
  }, [messageApi, onSnapshotUpdate]);

  const nextDcaDate = data.length > 0 ? data[0].nextDcaDate : (nextDcaDateProp ?? null);
  const isBiweeklyThursday = data.length > 0 ? data[0].isBiweeklyThursday : false;

  function formatNextDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${m}月${d}日`;
  }

  function getWeekday(dateStr: string | null): string {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split('-').map(Number);
    const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return days[new Date(y, m - 1, d).getDay()];
  }

  if (loading) {
    return (
      <Card title={<><ScheduleOutlined /> 定投预估</>} style={{ height: "100%" }}>
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card title={<><ScheduleOutlined /> 定投预估</>} style={{ height: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0" }}>
          <Text type="secondary">今日非定投日</Text>
          {nextDcaDate && (
            <div style={{ textAlign: "center" }}>
              <Text type="secondary" style={{ fontSize: 13 }}>下次定投</Text>
              <Title level={4} style={{ margin: "4px 0 0", color: "#1677ff" }}>
                {formatNextDate(nextDcaDate)}（{getWeekday(nextDcaDate)}）
              </Title>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={<><ScheduleOutlined /> 定投预估</>}
      style={{ height: "100%" }}
      styles={{ body: { padding: "12px 16px" } }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {isBiweeklyThursday ? "今日定投" : "下次定投"}
          </Text>
          <Title level={4} style={{ margin: "4px 0 0", color: "#1677ff" }}>
            {formatNextDate(nextDcaDate)}（{getWeekday(nextDcaDate)}）
          </Title>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderRadius: 8,
            background: "#f6ffed",
            border: "1px solid #b7eb8f",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <DollarOutlined style={{ fontSize: 20, color: "#52c41a" }} />
            <Text>预估总额</Text>
          </div>
          <Text strong style={{ fontSize: 20, color: "#52c41a" }}>
            ¥{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        </div>

        {hasBullet && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 6,
              background: "#fff7e6",
              border: "1px solid #ffd591",
            }}
          >
            <ThunderboltOutlined style={{ color: "#fa8c16" }} />
            <Text style={{ fontSize: 12 }}>
              子弹仓触发：沪深300单周跌幅超8%，额外加投
              <Tag color="orange" style={{ marginLeft: 4 }}>
                ¥{bulletItems.reduce((s, d) => s + (d.bulletReserveAmount ?? 0), 0).toFixed(0)}
              </Tag>
            </Text>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
          {contextHolder}
          {activeItems.map((item) => {
            const ratio = totalAmount > 0 ? (parseFloat(item.finalAmount) / totalAmount) * 100 : 0;
            const snapshot = snapshotMap.get(item.fundCode);
            const isExecuted = snapshot?.executed ?? false;
            return (
              <Tooltip key={item.fundCode} title={<CoefficientTooltip item={item} />} placement="left">
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <Space size={4}>
                      <Text style={{ fontSize: 13 }}>{item.fundName}</Text>
                      <InfoCircleOutlined style={{ fontSize: 11, color: "#999" }} />
                    </Space>
                    <Space size={4}>
                      {item.rebalanceAdjustment && (
                        <Tag color="blue" style={{ fontSize: 11, lineHeight: "18px", padding: "0 4px" }}>
                          再平衡
                        </Tag>
                      )}
                      <Text style={{ fontSize: 13 }}>¥{parseFloat(item.finalAmount).toFixed(0)}</Text>
                      {snapshot && (
                        isExecuted ? (
                          <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px" }}>
                            已执行
                          </Tag>
                        ) : (
                          <Button
                            type="link"
                            size="small"
                            icon={<ClockCircleOutlined />}
                            loading={executing === snapshot.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkExecuted(snapshot.id);
                            }}
                            style={{ fontSize: 10, padding: 0, height: 16 }}
                          >
                            待执行
                          </Button>
                        )
                      )}
                    </Space>
                  </div>
                  <Progress
                    percent={ratio}
                    showInfo={false}
                    size="small"
                    strokeColor={ratio > 30 ? "#52c41a" : "#1677ff"}
                  />
                </div>
              </Tooltip>
            );
          })}
          {activeItems.length > 4 && (
            <Text type="secondary" style={{ textAlign: "center", fontSize: 12 }}>
              共 {activeItems.length} 只基金
            </Text>
          )}
        </div>
      </div>
    </Card>
  );
}
