"use client";
import { useState, useEffect, useCallback } from "react";
import { Tabs, Typography, Flex, Table, Tag, Popconfirm, Button, message } from "antd";
import type { ColumnsType } from "antd/es/table/interface";
import type { PositionListItem, Transaction, FundListItem, CreateTransactionDto } from "@g-fund/types";
import { positionsApi, transactionsApi, fundsApi } from "@/lib/api-client";
import PositionTable from "@/components/PositionTable";
import TransactionForm from "@/components/TransactionForm";

const { Title } = Typography;

export default function PositionsPage() {
  const [positions, setPositions] = useState<PositionListItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [funds, setFunds] = useState<FundListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const loadPositions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await positionsApi.list();
      setPositions(data);
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const data = await transactionsApi.list();
      setTransactions(data);
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setTxLoading(false);
    }
  }, [messageApi]);

  const loadFunds = useCallback(async () => {
    try {
      const data = await fundsApi.list();
      setFunds(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadPositions();
    loadTransactions();
    loadFunds();
  }, [loadPositions, loadTransactions, loadFunds]);

  async function handleCreateTransaction(dto: CreateTransactionDto) {
    await transactionsApi.create(dto);
    loadPositions();
    loadTransactions();
  }

  async function handleDeleteTransaction(id: number) {
    try {
      await transactionsApi.remove(id);
      messageApi.success("删除成功");
      loadPositions();
      loadTransactions();
    } catch (e) {
      messageApi.error((e as Error).message);
    }
  }

  const txColumns: ColumnsType<Transaction> = [
    { title: "交易日期", dataIndex: "tradeDate", width: 120 },
    { title: "基金代码", dataIndex: "fundCode", width: 100 },
    { title: "基金名称", dataIndex: "fundName", ellipsis: true },
    {
      title: "类型", dataIndex: "type", width: 80,
      render: (v) => <Tag color={v === "buy" ? "green" : "red"}>{v === "buy" ? "买入" : "卖出"}</Tag>,
    },
    {
      title: "金额", dataIndex: "amount", width: 120, align: "right",
      render: (v) => `¥${parseFloat(v).toLocaleString()}`,
    },
    {
      title: "份额", dataIndex: "shares", width: 120, align: "right",
      render: (v) => v ? parseFloat(v).toLocaleString(undefined, { minimumFractionDigits: 4 }) : "—",
    },
    {
      title: "净值", dataIndex: "price", width: 100, align: "right",
      render: (v) => v ? parseFloat(v).toFixed(4) : "—",
    },
    { title: "备注", dataIndex: "note", ellipsis: true },
    {
      title: "操作", width: 80, fixed: "right",
      render: (_, record) => (
        <Popconfirm
          title="确认删除该交易记录？持仓将自动回滚"
          onConfirm={() => handleDeleteTransaction(record.id)}
          okText="删除"
          okButtonProps={{ danger: true }}
          cancelText="取消"
        >
          <Button type="link" danger size="small">删除</Button>
        </Popconfirm>
      ),
    },
  ];

  const tabItems = [
    {
      key: "positions",
      label: `当前持仓（${positions.length}）`,
      children: <PositionTable data={positions} loading={loading} />,
    },
    {
      key: "trade",
      label: "买入卖出",
      children: (
        <div style={{ maxWidth: 480 }}>
          <TransactionForm funds={funds} onSubmit={handleCreateTransaction} />
        </div>
      ),
    },
    {
      key: "log",
      label: `操作日志（${transactions.length}）`,
      children: (
        <Table
          rowKey="id"
          columns={txColumns}
          dataSource={transactions}
          loading={txLoading}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
          size="middle"
          scroll={{ x: 900 }}
        />
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>交易与持仓</Title>
      </Flex>
      <Tabs items={tabItems} />
    </>
  );
}
