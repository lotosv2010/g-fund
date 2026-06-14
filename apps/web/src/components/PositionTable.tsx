"use client";
import { Table, Typography, Button, Space, Tag, Dropdown } from "antd";
import { ShoppingCartOutlined, TagOutlined, FileTextOutlined, EditOutlined, AlertOutlined, MoreOutlined, OpenAIOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table/interface";
import type { PositionListItem } from "@g-fund/types";
import {
  LIFECYCLE_STAGE_LABELS,
  type LifecycleStage, type SignalLevel, type StopLossTakeProfitSignal, type FundListItem,
} from "@g-fund/types";

const { Text } = Typography;

function PnlCell({ value, raw, onClick }: { value: string; raw?: number; onClick?: () => void }) {
  const n = raw ?? parseFloat(value);
  const color = n > 0 ? "#dc2626" : n < 0 ? "#16a34a" : "#6b7280";
  const prefix = n > 0 ? "+" : "";
  return (
    <span
      style={{ color, cursor: onClick ? "pointer" : undefined, textDecoration: onClick ? "underline" : undefined }}
      onClick={onClick}
    >
      {prefix}{value}
    </span>
  );
}

interface PositionTableProps {
  data: PositionListItem[];
  loading: boolean;
  signals?: StopLossTakeProfitSignal[];
  funds?: FundListItem[];
  onBuy?: (fundCode: string) => void;
  onSell?: (fundCode: string) => void;
  onViewLog?: (fundCode: string) => void;
  onEditSnapshot?: (record: PositionListItem) => void;
  onPnlClick?: (fundCode: string, fundName: string) => void;
  onSignal?: (fundCode: string, fundName: string) => void;
  onAiAnalysis?: (fundCode: string, fundName: string) => void;
}

export default function PositionTable({ data, loading, signals = [], funds = [], onBuy, onSell, onViewLog, onEditSnapshot, onPnlClick, onSignal, onAiAnalysis }: PositionTableProps) {
  const totalCost = data.reduce((s, r) => s + parseFloat(r.costAmount), 0);
  const totalValue = data.reduce((s, r) => s + parseFloat(r.currentValue), 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlRate = totalCost > 0 ? totalPnl / totalCost : 0;

  function getSignalPriority(record: PositionListItem): number {
    const fundSignals = signals.filter((s) => s.fundCode === record.fundCode && s.triggered);
    if (fundSignals.length === 0) return -1;
    const typeOrder: Record<string, number> = { deep_loss: 4, stop_loss: 3, take_profit: 2, warning: 1, rebound: 0 };
    return Math.max(...fundSignals.map((s) => typeOrder[s.signalType] ?? 0));
  }

  const columns: ColumnsType<PositionListItem> = [
    { title: "基金代码", dataIndex: "fundCode", width: 100 },
    { title: "基金名称", dataIndex: "fundName", width: 200, ellipsis: true },
    {
      title: "预警等级",
      width: 110,
      align: "center",
      sorter: (a, b) => getSignalPriority(a) - getSignalPriority(b),
      render: (_, record) => {
        const fundSignals = signals.filter((s) => s.fundCode === record.fundCode && s.triggered);
        if (fundSignals.length === 0) return <Tag color="green">正常</Tag>;

        // 优先级：deep_loss > stop_loss > take_profit > warning > rebound
        const typeOrder: Record<string, number> = { deep_loss: 4, stop_loss: 3, take_profit: 2, warning: 1, rebound: 0 };
        const worst = fundSignals.reduce((w, s) => (typeOrder[s.signalType] ?? 0) > (typeOrder[w.signalType] ?? 0) ? s : w);

        const labelMap: Record<string, [string, string]> = {
          deep_loss:   ["深度套牢", "error"],
          stop_loss:   ["触发止损", "error"],
          take_profit: ["触发止盈", "success"],
          warning:     worst.level === "blue" ? ["低估关注", "processing"] : worst.level === "yellow" ? ["接近止损", "warning"] : worst.level === "red" ? ["接近止盈", "volcano"] : ["正常", "default"],
          rebound:     ["反弹信号", "cyan"],
        };
        const [label, color] = labelMap[worst.signalType] ?? ["信号", "default"];
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: "生命周期",
      width: 90,
      align: "center",
      sorter: (a, b) => {
        const order = { dca: 0, holding: 1 };
        const sa = order[(funds.find((f) => f.code === a.fundCode)?.lifecycleStage ?? "dca") as LifecycleStage] ?? 0;
        const sb = order[(funds.find((f) => f.code === b.fundCode)?.lifecycleStage ?? "dca") as LifecycleStage] ?? 0;
        return sa - sb;
      },
      render: (_, record) => {
        const fund = funds.find((f) => f.code === record.fundCode);
        const stage = (fund?.lifecycleStage ?? "dca") as LifecycleStage;
        return (
          <Tag color={stage === "holding" ? "purple" : "cyan"}>
            {LIFECYCLE_STAGE_LABELS[stage]}
          </Tag>
        );
      },
    },
    {
      title: "持有份额", dataIndex: "shares", width: 120, align: "right",
      sorter: (a, b) => parseFloat(a.shares) - parseFloat(b.shares),
      render: (v) => parseFloat(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    {
      title: "成本价", dataIndex: "costPrice", width: 100, align: "right",
      sorter: (a, b) => parseFloat(a.costPrice) - parseFloat(b.costPrice),
      render: (v) => parseFloat(v).toFixed(4),
    },
    {
      title: "成本金额", dataIndex: "costAmount", width: 120, align: "right",
      sorter: (a, b) => parseFloat(a.costAmount) - parseFloat(b.costAmount),
      render: (v) => `¥${parseFloat(v).toLocaleString()}`,
    },
    {
      title: "当前市值", dataIndex: "currentValue", width: 120, align: "right",
      sorter: (a, b) => parseFloat(a.currentValue) - parseFloat(b.currentValue),
      render: (v) => `¥${parseFloat(v).toLocaleString()}`,
    },
    {
      title: "盈亏金额", dataIndex: "pnlAmount", width: 120, align: "right",
      sorter: (a, b) => parseFloat(a.pnlAmount) - parseFloat(b.pnlAmount),
      render: (v, record) => (
        <PnlCell
          value={`¥${parseFloat(v).toLocaleString()}`}
          raw={parseFloat(v)}
          onClick={onPnlClick ? () => onPnlClick(record.fundCode, record.fundName) : undefined}
        />
      ),
    },
    {
      title: "盈亏率", dataIndex: "pnlRate", width: 100, align: "right",
      sorter: (a, b) => parseFloat(a.pnlRate) - parseFloat(b.pnlRate),
      render: (v) => <PnlCell value={`${(parseFloat(v) * 100).toFixed(2)}%`} raw={parseFloat(v)} />,
    },
    ...(onBuy || onSell || onViewLog || onEditSnapshot || onSignal || onAiAnalysis
      ? [
          {
            title: "操作",
            width: 120,
            fixed: "right" as const,
            render: (_: unknown, record: PositionListItem) => (
              <Space size="small">
                {onAiAnalysis && (
                  <Button type="link" size="small" icon={<OpenAIOutlined />} onClick={() => onAiAnalysis(record.fundCode, record.fundName)}>
                    AI
                  </Button>
                )}
                <Dropdown
                  menu={{
                    items: [
                      ...(onSignal ? [{ key: "signal", label: <span style={{ color: "#1677ff" }}>信号</span>, icon: <AlertOutlined style={{ color: "#1677ff" }} /> }] : []),
                      ...(onBuy ? [{ key: "buy", label: <span style={{ color: "#1677ff" }}>买入</span>, icon: <ShoppingCartOutlined style={{ color: "#1677ff" }} /> }] : []),
                      ...(onSell ? [{ key: "sell", label: <span style={{ color: "#1677ff" }}>卖出</span>, icon: <TagOutlined style={{ color: "#1677ff" }} /> }] : []),
                      ...(onEditSnapshot ? [{ key: "edit", label: <span style={{ color: "#1677ff" }}>修正</span>, icon: <EditOutlined style={{ color: "#1677ff" }} /> }] : []),
                      ...(onViewLog ? [{ key: "log", label: <span style={{ color: "#1677ff" }}>日志</span>, icon: <FileTextOutlined style={{ color: "#1677ff" }} /> }] : []),
                    ],
                    onClick: ({ key }) => {
                      if (key === "signal") onSignal?.(record.fundCode, record.fundName);
                      if (key === "buy") onBuy?.(record.fundCode);
                      if (key === "sell") onSell?.(record.fundCode);
                      if (key === "edit") onEditSnapshot?.(record);
                      if (key === "log") onViewLog?.(record.fundCode);
                    },
                  }}
                  trigger={["click"]}
                >
                  <Button type="link" size="small" icon={<MoreOutlined />} style={{ color: "#1677ff" }} />
                </Dropdown>
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <Table
        rowKey="fundCode"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={false}
        size="middle"
        scroll={{ x: 1200 }}
        summary={() => {
          return (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={6}>
                  <div style={{ whiteSpace: "nowrap" }}><Text strong>合计</Text></div>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6} align="right">
                  <div style={{ whiteSpace: "nowrap", textAlign: "right" }}><Text strong>¥{totalCost.toLocaleString()}</Text></div>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} align="right">
                  <div style={{ whiteSpace: "nowrap", textAlign: "right" }}><Text strong>¥{totalValue.toLocaleString()}</Text></div>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={8} align="right">
                  <div style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    <Text strong style={{ color: totalPnl >= 0 ? "#dc2626" : "#16a34a" }}>
                      {totalPnl >= 0 ? "+" : ""}¥{totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  </div>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={9} align="right">
                  <div style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    <Text strong style={{ color: totalPnlRate >= 0 ? "#dc2626" : "#16a34a" }}>
                      {totalPnlRate >= 0 ? "+" : ""}{(totalPnlRate * 100).toFixed(2)}%
                    </Text>
                  </div>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          );
        }}
      />
    </>
  );
}
