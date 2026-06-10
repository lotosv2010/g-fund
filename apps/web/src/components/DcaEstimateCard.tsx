"use client";
import { Card, Typography, Skeleton, Empty, Progress } from "antd";
import { ScheduleOutlined, DollarOutlined } from "@ant-design/icons";
import type { DcaCalculation } from "@g-fund/types";

const { Text, Title } = Typography;

function getNextDcaDate(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day <= 4 ? 4 - day : 11 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return `${next.getMonth() + 1}月${next.getDate()}日`;
}

interface DcaEstimateCardProps {
  data: DcaCalculation[];
  loading: boolean;
}

export default function DcaEstimateCard({ data, loading }: DcaEstimateCardProps) {
  const activeItems = data.filter((d) => !d.skipped);
  const totalAmount = activeItems.reduce((sum, d) => sum + parseFloat(d.finalAmount), 0);

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
          description="暂无定投配置"
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
          <Text type="secondary" style={{ fontSize: 13 }}>下次定投</Text>
          <Title level={4} style={{ margin: "4px 0 0", color: "#1677ff" }}>
            {getNextDcaDate()}（周四）
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

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activeItems.slice(0, 4).map((item) => {
            const ratio = totalAmount > 0 ? (parseFloat(item.finalAmount) / totalAmount) * 100 : 0;
            return (
              <div key={item.fundCode}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 13 }}>{item.fundName}</Text>
                  <Text style={{ fontSize: 13 }}>¥{parseFloat(item.finalAmount).toFixed(0)}</Text>
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
