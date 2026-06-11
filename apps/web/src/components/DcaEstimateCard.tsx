"use client";
import { Card, Typography, Skeleton, Empty, Progress, Tag, Space } from "antd";
import { ScheduleOutlined, DollarOutlined, ThunderboltOutlined } from "@ant-design/icons";
import type { DcaCalculation } from "@g-fund/types";

const { Text, Title } = Typography;

interface DcaEstimateCardProps {
  data: DcaCalculation[];
  loading: boolean;
}

export default function DcaEstimateCard({ data, loading }: DcaEstimateCardProps) {
  const activeItems = data.filter((d) => !d.skipped);
  const totalAmount = activeItems.reduce((sum, d) => sum + parseFloat(d.finalAmount), 0);
  const bulletItems = activeItems.filter((d) => (d.bulletReserveAmount ?? 0) > 0);
  const hasBullet = bulletItems.length > 0;

  const nextDcaDate = data.length > 0 ? data[0].nextDcaDate : null;
  const isBiweeklyThursday = data.length > 0 ? data[0].isBiweeklyThursday : false;

  function formatNextDate(dateStr: string | null): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function getWeekday(dateStr: string | null): string {
    if (!dateStr) return "";
    const days = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return days[new Date(dateStr).getDay()];
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
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无定投配置或非定投日"
          style={{ margin: "24px 0" }}
        />
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

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activeItems.slice(0, 4).map((item) => {
            const ratio = totalAmount > 0 ? (parseFloat(item.finalAmount) / totalAmount) * 100 : 0;
            return (
              <div key={item.fundCode}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 13 }}>{item.fundName}</Text>
                  <Space size={4}>
                    {item.rebalanceAdjustment && (
                      <Tag color="blue" style={{ fontSize: 11, lineHeight: "18px", padding: "0 4px" }}>
                        再平衡
                      </Tag>
                    )}
                    <Text style={{ fontSize: 13 }}>¥{parseFloat(item.finalAmount).toFixed(0)}</Text>
                  </Space>
                </div>
                <Progress
                  percent={ratio}
                  showInfo={false}
                  size="small"
                  strokeColor={ratio > 30 ? "#52c41a" : "#1677ff"}
                />
              </div>
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
