"use client";
import { Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table/interface";
import type { PositionListItem } from "@g-fund/types";

const { Text } = Typography;

function PnlCell({ value }: { value: string }) {
  const n = parseFloat(value);
  const color = n > 0 ? "#dc2626" : n < 0 ? "#16a34a" : "#6b7280";
  const prefix = n > 0 ? "+" : "";
  return <span style={{ color }}>{prefix}{value}</span>;
}

interface PositionTableProps {
  data: PositionListItem[];
  loading: boolean;
}

export default function PositionTable({ data, loading }: PositionTableProps) {
  const totalCost = data.reduce((s, r) => s + parseFloat(r.costAmount), 0);
  const totalValue = data.reduce((s, r) => s + parseFloat(r.currentValue), 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlRate = totalCost > 0 ? totalPnl / totalCost : 0;

  const columns: ColumnsType<PositionListItem> = [
    { title: "基金代码", dataIndex: "fundCode", width: 100 },
    { title: "基金名称", dataIndex: "fundName", ellipsis: true },
    {
      title: "持有份额", dataIndex: "shares", width: 120, align: "right",
      render: (v) => parseFloat(v).toLocaleString(undefined, { minimumFractionDigits: 4 }),
    },
    {
      title: "成本价", dataIndex: "costPrice", width: 100, align: "right",
      render: (v) => parseFloat(v).toFixed(4),
    },
    {
      title: "成本金额", dataIndex: "costAmount", width: 120, align: "right",
      render: (v) => `¥${parseFloat(v).toLocaleString()}`,
    },
    {
      title: "当前市值", dataIndex: "currentValue", width: 120, align: "right",
      render: (v) => `¥${parseFloat(v).toLocaleString()}`,
    },
    {
      title: "盈亏金额", dataIndex: "pnlAmount", width: 120, align: "right",
      render: (v) => <PnlCell value={`¥${parseFloat(v).toLocaleString()}`} />,
    },
    {
      title: "盈亏率", dataIndex: "pnlRate", width: 100, align: "right",
      render: (v) => <PnlCell value={`${(parseFloat(v) * 100).toFixed(2)}%`} />,
    },
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
        scroll={{ x: 900 }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={4}>
                <Text strong>合计</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                <Text strong>¥{totalCost.toLocaleString()}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right">
                <Text strong>¥{totalValue.toLocaleString()}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} align="right">
                <Text strong style={{ color: totalPnl >= 0 ? "#dc2626" : "#16a34a" }}>
                  {totalPnl >= 0 ? "+" : ""}¥{totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7} align="right">
                <Text strong style={{ color: totalPnlRate >= 0 ? "#dc2626" : "#16a34a" }}>
                  {totalPnlRate >= 0 ? "+" : ""}{(totalPnlRate * 100).toFixed(2)}%
                </Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </>
  );
}
