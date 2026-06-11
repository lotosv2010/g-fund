"use client";
import { Card, Progress, Tag, Typography, Skeleton, Space, Tooltip } from "antd";
import { FundOutlined, RocketOutlined, PauseCircleOutlined } from "@ant-design/icons";
import type { FundListItem } from "@g-fund/types";

const { Text } = Typography;

const STAGE_CONFIG = {
  dca: { color: "#1677ff", label: "定投期", icon: <RocketOutlined /> },
  holding: { color: "#52c41a", label: "持有期", icon: <PauseCircleOutlined /> },
} as const;

interface StageProgressCardProps {
  data: FundListItem[];
  loading: boolean;
}

export default function StageProgressCard({ data, loading }: StageProgressCardProps) {
  const fundsWithTarget = data.filter((f) => parseFloat(f.targetAmount) > 0);

  const totalCurrentValue = fundsWithTarget.reduce((sum, f) => sum + parseFloat(f.currentValue), 0);
  const totalTargetAmount = fundsWithTarget.reduce((sum, f) => sum + parseFloat(f.targetAmount), 0);
  const overallPercent = totalTargetAmount > 0 ? (totalCurrentValue / totalTargetAmount) * 100 : 0;

  const dcaCount = fundsWithTarget.filter((f) => f.lifecycleStage === "dca").length;
  const holdingCount = fundsWithTarget.filter((f) => f.lifecycleStage === "holding").length;

  if (loading) {
    return (
      <Card title={<><FundOutlined /> 阶段进度</>} style={{ height: "100%" }}>
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    );
  }

  if (fundsWithTarget.length === 0) {
    return (
      <Card title={<><FundOutlined /> 阶段进度</>} style={{ height: "100%" }}>
        <Text type="secondary">暂无目标金额配置</Text>
      </Card>
    );
  }

  return (
    <Card
      title={<><FundOutlined /> 阶段进度</>}
      style={{ height: "100%" }}
      styles={{ body: { padding: "12px 16px" } }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ textAlign: "center" }}>
          <Text type="secondary" style={{ fontSize: 13 }}>整体持仓 / 目标</Text>
          <Progress
            type="circle"
            percent={Math.min(overallPercent, 100)}
            size={100}
            strokeColor={overallPercent >= 80 ? "#52c41a" : "#1677ff"}
            format={(p) => (
              <div>
                <Text strong style={{ fontSize: 18 }}>{p?.toFixed(1)}%</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {overallPercent >= 80 ? "已达标" : "定投中"}
                </Text>
              </div>
            )}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          <Tag icon={<RocketOutlined />} color="blue">定投期 {dcaCount}</Tag>
          <Tag icon={<PauseCircleOutlined />} color="green">持有期 {holdingCount}</Tag>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {fundsWithTarget.slice(0, 4).map((fund) => {
            const percent = parseFloat(fund.targetAmount) > 0
              ? (parseFloat(fund.currentValue) / parseFloat(fund.targetAmount)) * 100
              : 0;
            const stage = fund.lifecycleStage;
            const config = STAGE_CONFIG[stage];
            return (
              <Tooltip
                key={fund.code}
                title={`当前: ¥${parseFloat(fund.currentValue).toLocaleString()} / 目标: ¥${parseFloat(fund.targetAmount).toLocaleString()}`}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <Space size={4}>
                      <Text style={{ fontSize: 12 }}>{fund.name}</Text>
                      <Tag color={config.color} style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px" }}>
                        {config.label}
                      </Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>{percent.toFixed(0)}%</Text>
                  </div>
                  <Progress
                    percent={Math.min(percent, 100)}
                    showInfo={false}
                    size="small"
                    strokeColor={percent >= 80 ? "#52c41a" : config.color}
                  />
                </div>
              </Tooltip>
            );
          })}
          {fundsWithTarget.length > 4 && (
            <Text type="secondary" style={{ textAlign: "center", fontSize: 12 }}>
              共 {fundsWithTarget.length} 只基金
            </Text>
          )}
        </div>
      </div>
    </Card>
  );
}
