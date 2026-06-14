"use client";
import { Card, Table, Tag, Empty, Skeleton, Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table/interface";
import type { Transaction } from "@g-fund/types";

interface RecentTradesProps {
  data: Transaction[];
  loading: boolean;
}

const columns: ColumnsType<Transaction> = [
  { title: "日期", dataIndex: "tradeDate", width: 100 },
  { title: "基金名称", dataIndex: "fundName", width: 160, ellipsis: true },
  {
    title: "类型", dataIndex: "type", width: 70,
    render: (v) => <Tag color={v === "buy" ? "green" : "red"}>{v === "buy" ? "买入" : "卖出"}</Tag>,
  },
  {
    title: "金额", dataIndex: "amount", width: 110, align: "right",
    render: (v) => `¥${parseFloat(v).toLocaleString()}`,
  },
  {
    title: "净值", dataIndex: "price", width: 90, align: "right",
    render: (v) => v ? parseFloat(v).toFixed(4) : "—",
  },
];

export default function RecentTrades({ data, loading }: RecentTradesProps) {
  if (loading) {
    return (
      <Card title={<span>最近交易 <Tooltip title="展示最近 5 笔买入/卖出交易记录，包括交易日期、基金名称、类型、金额和成交净值"><InfoCircleOutlined style={{ fontSize: 13, color: "#999" }} /></Tooltip></span>} style={{ height: "100%" }}>
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    );
  }

  const recent = data.slice(0, 5);

  return (
    <Card title={<span>最近交易 <Tooltip title="展示最近 5 笔买入/卖出交易记录，包括交易日期、基金名称、类型、金额和成交净值"><InfoCircleOutlined style={{ fontSize: 13, color: "#999" }} /></Tooltip></span>} style={{ height: "100%" }}>
      {recent.length === 0 ? (
        <Empty description="暂无交易记录" />
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={recent}
          pagination={false}
          size="small"
          scroll={{ x: 400 }}
        />
      )}
    </Card>
  );
}
