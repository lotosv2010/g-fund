"use client";
import { Card, Col, Row, Skeleton, Typography } from "antd";
import type { PositionListItem } from "@g-fund/types";

const { Text } = Typography;

const PROFIT_COLOR = "#16a34a";
const LOSS_COLOR = "#dc2626";

interface StatCardsProps {
  data: PositionListItem[];
  loading: boolean;
}

export default function StatCards({ data, loading }: StatCardsProps) {
  const totalAssets = data.reduce((s, r) => s + parseFloat(r.currentValue), 0);
  const totalCost = data.reduce((s, r) => s + parseFloat(r.costAmount), 0);
  const totalPnl = totalAssets - totalCost;
  const totalPnlRate = totalCost > 0 ? totalPnl / totalCost : 0;
  const isProfit = totalPnl >= 0;

  const cards = [
    {
      title: "总资产",
      content: `¥${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${data.length} 只基金`,
      color: undefined as string | undefined,
    },
    {
      title: "总盈亏",
      content: `${totalPnl >= 0 ? "+" : ""}¥${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${totalPnlRate >= 0 ? "+" : ""}${(totalPnlRate * 100).toFixed(2)}%`,
      color: isProfit ? PROFIT_COLOR : LOSS_COLOR,
    },
    {
      title: "今日盈亏",
      content: "—",
      sub: "待接入",
      color: undefined as string | undefined,
    },
    {
      title: "持仓数量",
      content: `${data.length}`,
      sub: "只基金",
      color: undefined as string | undefined,
    },
  ];

  if (loading) {
    return (
      <Row gutter={[16, 16]}>
        {cards.map((_, i) => (
          <Col key={i} xs={24} sm={12} lg={6}>
            <Card style={{ height: "100%" }}>
              <Skeleton active paragraph={false} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <Row gutter={[16, 16]} align="stretch">
      {cards.map((card) => (
        <Col key={card.title} xs={24} sm={12} lg={6}>
          <Card style={{ height: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>{card.title}</Text>
              <Text strong style={{ fontSize: 24, color: card.color, lineHeight: 1.3 }}>
                {card.content}
              </Text>
              <Text type="secondary" style={{ fontSize: 12, color: card.color ?? undefined }}>{card.sub}</Text>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
