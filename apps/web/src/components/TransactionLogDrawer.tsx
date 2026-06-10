"use client";
import { useState, useEffect } from "react";
import { Drawer, Table, Tag, Popconfirm, Button, message, Empty } from "antd";
import type { ColumnsType } from "antd/es/table/interface";
import type { Transaction } from "@g-fund/types";
import { transactionsApi } from "@/lib/api-client";

interface TransactionLogDrawerProps {
  fundCode: string | null;
  fundName: string;
  open: boolean;
  onClose: () => void;
  onDelete: (id: number) => Promise<void>;
}

export default function TransactionLogDrawer({ fundCode, fundName, open, onClose, onDelete }: TransactionLogDrawerProps) {
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!open || !fundCode) return;
    setLoading(true);
    transactionsApi
      .list({ fundCode })
      .then(setData)
      .catch((e) => messageApi.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [open, fundCode, messageApi]);

  const columns: ColumnsType<Transaction> = [
    { title: "交易日期", dataIndex: "tradeDate", width: 110 },
    {
      title: "类型",
      dataIndex: "type",
      width: 70,
      render: (v) => <Tag color={v === "buy" ? "green" : "red"}>{v === "buy" ? "买入" : "卖出"}</Tag>,
    },
    {
      title: "金额",
      dataIndex: "amount",
      width: 120,
      align: "right",
      render: (v) => `¥${parseFloat(v).toLocaleString()}`,
    },
    {
      title: "份额",
      dataIndex: "shares",
      width: 110,
      align: "right",
      render: (v) => (v ? parseFloat(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"),
    },
    {
      title: "净值",
      dataIndex: "price",
      width: 90,
      align: "right",
      render: (v) => (v ? parseFloat(v).toFixed(4) : "—"),
    },
    { title: "备注", dataIndex: "note", ellipsis: true },
    {
      title: "操作",
      width: 70,
      fixed: "right",
      render: (_, record) => (
        <Popconfirm
          title="确认删除该交易记录？持仓将自动回滚"
          onConfirm={async () => {
            await onDelete(record.id);
            setData((prev) => prev.filter((t) => t.id !== record.id));
          }}
          okText="删除"
          okButtonProps={{ danger: true }}
          cancelText="取消"
        >
          <Button type="link" danger size="small">
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Drawer
        title={`${fundName} — 操作日志`}
        open={open}
        onClose={onClose}
        size={520}
        destroyOnHidden
      >
        {data.length === 0 && !loading ? (
          <Empty description="暂无交易记录" />
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data}
            loading={loading}
            pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 条` }}
            size="small"
            scroll={{ x: 600 }}
          />
        )}
      </Drawer>
    </>
  );
}
