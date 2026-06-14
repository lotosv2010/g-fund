"use client";
import { Card, Table, Tag, Empty, Skeleton } from "antd";
import type { ColumnsType } from "antd/es/table/interface";
import type { Transaction } from "@g-fund/types";

interface RecentTradesProps {
  data: Transaction[];
  loading: boolean;
}

const columns: ColumnsType<Transaction> = [
  { title: "日期", dataIndex: "tradeDate", width: 110 },
  { title: "基金名称", dataIndex: "fundName", ellipsis: true },
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
      <Card title="最近交易" style={{ height: "100%" }}>
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    );
  }

  const recent = data.slice(0, 5);

  return (
    <Card title="最近交易" style={{ height: "100%" }}>
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
