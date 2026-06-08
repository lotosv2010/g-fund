"use client";
import { useState, useEffect, useCallback } from "react";
import { Tabs, Typography, Flex, Table, Tag, Popconfirm, Button, message, Form, Input, DatePicker, List, Card, Modal } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table/interface";
import type { PositionListItem, Transaction, FundListItem, CreateTransactionDto, DailyLog, CreateDailyLogDto } from "@g-fund/types";
import { positionsApi, transactionsApi, fundsApi, dailyLogsApi } from "@/lib/api-client";
import PositionTable from "@/components/PositionTable";
import TransactionForm from "@/components/TransactionForm";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function PositionsPage() {
  const [positions, setPositions] = useState<PositionListItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [funds, setFunds] = useState<FundListItem[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
  const [logForm] = Form.useForm();
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

  const loadDailyLogs = useCallback(async () => {
    setLogLoading(true);
    try {
      const data = await dailyLogsApi.list();
      setDailyLogs(data);
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setLogLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    loadPositions();
    loadTransactions();
    loadFunds();
    loadDailyLogs();
  }, [loadPositions, loadTransactions, loadFunds, loadDailyLogs]);

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

  function openCreateLog() {
    setEditingLog(null);
    logForm.resetFields();
    logForm.setFieldsValue({ logDate: dayjs() });
    setLogModalOpen(true);
  }

  function openEditLog(log: DailyLog) {
    setEditingLog(log);
    logForm.setFieldsValue({
      logDate: dayjs(log.logDate),
      summary: log.summary ?? "",
      marketNote: log.marketNote ?? "",
    });
    setLogModalOpen(true);
  }

  async function handleSaveLog() {
    try {
      const values = await logForm.validateFields();
      const dto: CreateDailyLogDto = {
        logDate: values.logDate.format("YYYY-MM-DD"),
        summary: values.summary || undefined,
        marketNote: values.marketNote || undefined,
      };
      if (editingLog) {
        await dailyLogsApi.update(editingLog.id, dto);
        messageApi.success("更新成功");
      } else {
        await dailyLogsApi.create(dto);
        messageApi.success("保存成功");
      }
      setLogModalOpen(false);
      loadDailyLogs();
    } catch (e) {
      if ((e as Error).message) messageApi.error((e as Error).message);
    }
  }

  async function handleDeleteLog(id: number) {
    try {
      await dailyLogsApi.remove(id);
      messageApi.success("删除成功");
      loadDailyLogs();
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
    {
      key: "daily-log",
      label: `投资日记（${dailyLogs.length}）`,
      children: (
        <>
          <Flex justify="flex-end" style={{ marginBottom: 12 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateLog}>
              写日记
            </Button>
          </Flex>
          <List
            loading={logLoading}
            dataSource={dailyLogs}
            locale={{ emptyText: "暂无日记，点击「写日记」开始记录" }}
            renderItem={(log) => (
              <Card
                size="small"
                style={{ marginBottom: 8 }}
                title={
                  <Flex align="center" gap={8}>
                    <Text strong>{log.logDate}</Text>
                  </Flex>
                }
                extra={
                  <Flex gap={4}>
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditLog(log)} />
                    <Popconfirm title="确认删除？" onConfirm={() => handleDeleteLog(log.id)}>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Flex>
                }
              >
                {log.summary && <div style={{ marginBottom: 8 }}>{log.summary}</div>}
                {log.marketNote && (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    市场观察：{log.marketNote}
                  </Text>
                )}
                {!log.summary && !log.marketNote && <Text type="secondary">（空日记）</Text>}
              </Card>
            )}
          />
        </>
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

      <Modal
        title={editingLog ? "编辑日记" : "写日记"}
        open={logModalOpen}
        onOk={handleSaveLog}
        onCancel={() => setLogModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={logForm} layout="vertical">
          <Form.Item name="logDate" label="日期" rules={[{ required: true, message: "请选择日期" }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="summary" label="操作摘要">
            <TextArea rows={2} placeholder="今日操作记录..." />
          </Form.Item>
          <Form.Item name="marketNote" label="市场观察">
            <TextArea rows={2} placeholder="市场走势、板块动态..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
