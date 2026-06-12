"use client";
import { Card, Col, Row, Skeleton, Typography } from "antd";
import type { PositionListItem, DailySnapshot } from "@g-fund/types";

const { Text } = Typography;

const PROFIT_COLOR = "#dc2626";
const LOSS_COLOR = "#16a34a";

interface StatCardsProps {
  data: PositionListItem[];
  loading: boolean;
  todaySnapshot?: DailySnapshot | null;
  yesterdaySnapshot?: DailySnapshot | null;
  onTotalAssetsClick?: () => void;
  onTotalPnlClick?: () => void;
}

export default function StatCards({ data, loading, todaySnapshot, yesterdaySnapshot, onTotalAssetsClick, onTotalPnlClick }: StatCardsProps) {
  const totalAssets = data.reduce((s, r) => s + parseFloat(r.currentValue), 0);
  const totalCost = data.reduce((s, r) => s + parseFloat(r.costAmount), 0);
  const totalPnl = totalAssets - totalCost;
  const totalPnlRate = totalCost > 0 ? totalPnl / totalCost : 0;
  const isProfit = totalPnl >= 0;

  const todayPnl = todaySnapshot && yesterdaySnapshot
    ? parseFloat(todaySnapshot.totalValue) - parseFloat(yesterdaySnapshot.totalValue)
    : null;
  const todayProfit = todayPnl !== null ? todayPnl >= 0 : null;

  const cards = [
    {
      title: "总资产",
      content: `¥${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${data.length} 只基金`,
      color: undefined as string | undefined,
      onClick: onTotalAssetsClick,
    },
    {
      title: "总盈亏",
      content: `${totalPnl >= 0 ? "+" : ""}¥${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `${totalPnlRate >= 0 ? "+" : ""}${(totalPnlRate * 100).toFixed(2)}%`,
      color: isProfit ? PROFIT_COLOR : LOSS_COLOR,
      onClick: onTotalPnlClick,
    },
    {
      title: "今日盈亏",
      content: todayPnl !== null
        ? `${todayPnl >= 0 ? "+" : ""}¥${todayPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "—",
      sub: todaySnapshot ? `市值 ¥${parseFloat(todaySnapshot.totalValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "暂无快照",
      color: todayProfit !== null ? (todayProfit ? PROFIT_COLOR : LOSS_COLOR) : undefined,
      onClick: undefined,
    },
    {
      title: "持仓数量",
      content: `${data.length}`,
      sub: "只基金",
      color: undefined as string | undefined,
      onClick: undefined,
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
          <Card
            style={{ height: "100%", cursor: card.onClick ? "pointer" : undefined }}
            onClick={card.onClick}
            hoverable={!!card.onClick}
          >
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
