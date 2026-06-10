"use client";
import { Drawer, Table, Empty, Typography } from "antd";
import type { ColumnsType } from "antd/es/table/interface";
import type { PositionListItem } from "@g-fund/types";

const { Text } = Typography;

const PROFIT_COLOR = "#dc2626";
const LOSS_COLOR = "#16a34a";

function PnlCell({ value, raw, onClick }: { value: string; raw?: number; onClick?: () => void }) {
  const n = raw ?? parseFloat(value);
  const color = n > 0 ? PROFIT_COLOR : n < 0 ? LOSS_COLOR : "#6b7280";
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

interface TotalProfitDrawerProps {
  open: boolean;
  onClose: () => void;
  data: PositionListItem[];
  onViewFundDetail?: (fundCode: string, fundName: string) => void;
}

export default function TotalProfitDrawer({ open, onClose, data, onViewFundDetail }: TotalProfitDrawerProps) {
  const totalCost = data.reduce((s, r) => s + parseFloat(r.costAmount), 0);
  const totalValue = data.reduce((s, r) => s + parseFloat(r.currentValue), 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlRate = totalCost > 0 ? totalPnl / totalCost : 0;

  const columns: ColumnsType<PositionListItem> = [
    { title: "基金代码", dataIndex: "fundCode", width: 100 },
    { title: "基金名称", dataIndex: "fundName", ellipsis: true },
    {
      title: "成本金额",
      dataIndex: "costAmount",
      width: 120,
      align: "right",
      render: (v: string) => `¥${parseFloat(v).toLocaleString()}`,
    },
    {
      title: "当前市值",
      dataIndex: "currentValue",
      width: 120,
      align: "right",
      render: (v: string) => `¥${parseFloat(v).toLocaleString()}`,
    },
    {
      title: "盈亏金额",
      dataIndex: "pnlAmount",
      width: 130,
      align: "right",
      render: (v: string, record) => (
        <PnlCell
          value={`¥${parseFloat(v).toLocaleString()}`}
          raw={parseFloat(v)}
          onClick={onViewFundDetail ? () => onViewFundDetail(record.fundCode, record.fundName) : undefined}
        />
      ),
    },
    {
      title: "盈亏率",
      dataIndex: "pnlRate",
      width: 100,
      align: "right",
      render: (v: string) => <PnlCell value={`${(parseFloat(v) * 100).toFixed(2)}%`} raw={parseFloat(v)} />,
    },
  ];

  return (
    <Drawer
      title="总收益明细"
      open={open}
      onClose={onClose}
      size={720}
      destroyOnHidden
    >
      {data.length === 0 ? (
        <Empty description="暂无持仓数据" />
      ) : (
        <Table
          rowKey="fundCode"
          columns={columns}
          dataSource={data}
          pagination={false}
          size="small"
          scroll={{ x: 600 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}>
                  <Text strong>合计</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  <Text strong>¥{totalCost.toLocaleString()}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} align="right">
                  <Text strong>¥{totalValue.toLocaleString()}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} align="right">
                  <Text strong style={{ color: totalPnl >= 0 ? PROFIT_COLOR : LOSS_COLOR }}>
                    {totalPnl >= 0 ? "+" : ""}¥{totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <Text strong style={{ color: totalPnlRate >= 0 ? PROFIT_COLOR : LOSS_COLOR }}>
                    {totalPnlRate >= 0 ? "+" : ""}{(totalPnlRate * 100).toFixed(2)}%
                  </Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      )}
    </Drawer>
  );
}
