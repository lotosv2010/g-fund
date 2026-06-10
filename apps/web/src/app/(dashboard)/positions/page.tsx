"use client";
import { useState, useEffect, useCallback } from "react";
import { Tabs, Typography, Flex, Button, Popconfirm, message, Form, Input, DatePicker, List, Card, Modal, Table, Tag } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ShoppingCartOutlined, FileAddOutlined, ReloadOutlined } from "@ant-design/icons";
import type { PositionListItem, FundListItem, Transaction, CreateTransactionDto, DailyLog, CreateDailyLogDto, UpsertPositionDto } from "@g-fund/types";
import type { ColumnsType } from "antd/es/table/interface";
import { positionsApi, transactionsApi, fundsApi, dailyLogsApi, settingsApi } from "@/lib/api-client";
import PositionTable from "@/components/PositionTable";
import TransactionForm from "@/components/TransactionForm";
import TransactionLogDrawer from "@/components/TransactionLogDrawer";
import TotalProfitDrawer from "@/components/TotalProfitDrawer";
import FundProfitDrawer from "@/components/FundProfitDrawer";
import SyncPositionsButton from "@/components/SyncPositionsButton";
import PositionSnapshotModal from "@/components/PositionSnapshotModal";
import { TargetPositionCard } from "../funds/components/target-position-card";
import { SettingsModal } from "../funds/components/settings-modal";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function PositionsPage() {
  const [positions, setPositions] = useState<PositionListItem[]>([]);
  const [funds, setFunds] = useState<FundListItem[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
  const [logForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [tradeFundCode, setTradeFundCode] = useState<string>("");
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);
  const [logFundCode, setLogFundCode] = useState<string>("");

  const [totalProfitOpen, setTotalProfitOpen] = useState(false);
  const [fundProfitOpen, setFundProfitOpen] = useState(false);
  const [fundProfitCode, setFundProfitCode] = useState<string>("");
  const [fundProfitName, setFundProfitName] = useState<string>("");

  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [snapshotEditing, setSnapshotEditing] = useState<PositionListItem | null>(null);
  const [snapshotSubmitting, setSnapshotSubmitting] = useState(false);

  const [targetTotalPosition, setTargetTotalPosition] = useState<string>("0");
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);

  const [positionSearch, setPositionSearch] = useState("");
  const [logDateRange, setLogDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [txLogs, setTxLogs] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txDateRange, setTxDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs(), dayjs()]);

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
    loadFunds();
    loadDailyLogs();
  }, [loadPositions, loadFunds, loadDailyLogs]);

  const loadSettings = useCallback(async () => {
    try {
      const setting = await settingsApi.get("target_total_position");
      setTargetTotalPosition(setting.value);
    } catch {
      // setting may not exist yet
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const loadTxLogs = useCallback(async () => {
    setTxLoading(true);
    try {
      const data = await transactionsApi.list({
        startDate: txDateRange[0].format("YYYY-MM-DD"),
        endDate: txDateRange[1].format("YYYY-MM-DD"),
      });
      setTxLogs(data);
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setTxLoading(false);
    }
  }, [txDateRange, messageApi]);

  useEffect(() => { loadTxLogs(); }, [loadTxLogs]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([loadPositions(), loadFunds(), loadDailyLogs(), loadTxLogs(), loadSettings()]);
    } finally {
      setRefreshing(false);
    }
  }

  const filteredPositions = positions.filter((p) => {
    if (!positionSearch) return true;
    const q = positionSearch.toLowerCase();
    return p.fundCode.toLowerCase().includes(q) || p.fundName.toLowerCase().includes(q);
  });

  const filteredDailyLogs = dailyLogs.filter((log) => {
    if (!logDateRange) return true;
    const d = dayjs(log.logDate);
    return d.isAfter(logDateRange[0].startOf("day").subtract(1, "ms")) && d.isBefore(logDateRange[1].endOf("day").add(1, "ms"));
  });

  async function handleDeleteTransaction(id: number) {
    try {
      await transactionsApi.remove(id);
      messageApi.success("删除成功");
      loadPositions();
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

  function handleRowBuy(code: string) {
    setTradeFundCode(code);
    setTradeType("buy");
    setTradeModalOpen(true);
  }

  function handleRowSell(code: string) {
    setTradeFundCode(code);
    setTradeType("sell");
    setTradeModalOpen(true);
  }

  function handleViewLog(code: string) {
    setLogFundCode(code);
    setLogDrawerOpen(true);
  }

  function handlePnlClick(fundCode: string, fundName: string) {
    setFundProfitCode(fundCode);
    setFundProfitName(fundName);
    setFundProfitOpen(true);
  }

  function handleTotalViewFundDetail(fundCode: string, fundName: string) {
    setTotalProfitOpen(false);
    setFundProfitCode(fundCode);
    setFundProfitName(fundName);
    setFundProfitOpen(true);
  }

  function openTradeModal() {
    setTradeFundCode("");
    setTradeType("buy");
    setTradeModalOpen(true);
  }

  function openCreateSnapshot() {
    setSnapshotEditing(null);
    setSnapshotModalOpen(true);
  }

  function openEditSnapshot(record: PositionListItem) {
    setSnapshotEditing(record);
    setSnapshotModalOpen(true);
  }

  async function handleSnapshotSubmit(dto: UpsertPositionDto) {
    setSnapshotSubmitting(true);
    try {
      await positionsApi.upsert(dto);
      messageApi.success(snapshotEditing ? "持仓已修正" : "建仓成功");
      setSnapshotModalOpen(false);
      setSnapshotEditing(null);
      loadPositions();
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setSnapshotSubmitting(false);
    }
  }

  async function handleTradeSubmit(dto: CreateTransactionDto) {
    await transactionsApi.create(dto);
    setTradeModalOpen(false);
    loadPositions();
  }

  async function handleSettingsSave(values: { targetTotalPosition: number }) {
    setSettingsSubmitting(true);
    try {
      await settingsApi.set("target_total_position", String(values.targetTotalPosition));
      setTargetTotalPosition(String(values.targetTotalPosition));
      messageApi.success("目标总仓位已更新");
      setSettingsModalOpen(false);
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setSettingsSubmitting(false);
    }
  }

  const txColumns: ColumnsType<Transaction> = [
    { title: "交易日期", dataIndex: "tradeDate", width: 110 },
    { title: "基金名称", dataIndex: "fundName", width: 140, ellipsis: true },
    { title: "基金代码", dataIndex: "fundCode", width: 100 },
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
    {
      title: "状态",
      dataIndex: "status",
      width: 80,
      render: (v) => v === "pending"
        ? <Tag color="orange">待确认</Tag>
        : v === "cancelled"
          ? <Tag color="default">已取消</Tag>
          : <Tag color="green">已确认</Tag>,
    },
    { title: "备注", dataIndex: "note", ellipsis: true },
    {
      title: "操作",
      width: 70,
      fixed: "right",
      render: (_, record) => (
        <Popconfirm
          title={record.status === "pending" ? "确认删除？交易将取消" : "确认删除？持仓将自动回滚"}
          onConfirm={async () => {
            await handleDeleteTransaction(record.id);
            setTxLogs((prev) => prev.filter((t) => t.id !== record.id));
          }}
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
      children: (
        <>
          <Flex justify="flex-end" style={{ marginBottom: 12 }}>
            <Input.Search
              placeholder="搜索基金代码/名称"
              allowClear
              value={positionSearch}
              onChange={(e) => setPositionSearch(e.target.value)}
              style={{ width: 240 }}
            />
          </Flex>
          <PositionTable
            data={filteredPositions}
            loading={loading}
            onBuy={handleRowBuy}
            onSell={handleRowSell}
            onViewLog={handleViewLog}
            onEditSnapshot={openEditSnapshot}
            onPnlClick={handlePnlClick}
            onTotalPnlClick={() => setTotalProfitOpen(true)}
          />
        </>
      ),
    },
    {
      key: "tx-log",
      label: `交易日志（${txLogs.length}）`,
      children: (
        <>
          <Flex justify="flex-end" style={{ marginBottom: 12 }}>
            <DatePicker.RangePicker
              value={txDateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) setTxDateRange([dates[0], dates[1]]);
              }}
              allowClear={false}
            />
          </Flex>
          <Table
            rowKey="id"
            columns={txColumns}
            dataSource={txLogs}
            loading={txLoading}
            pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
            size="small"
            scroll={{ x: 900 }}
          />
        </>
      ),
    },
    {
      key: "daily-log",
      label: `投资日记（${filteredDailyLogs.length}）`,
      children: (
        <>
          <Flex justify="space-between" style={{ marginBottom: 12 }}>
            <DatePicker.RangePicker
              value={logDateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) setLogDateRange([dates[0], dates[1]]);
                else setLogDateRange(null);
              }}
              allowClear
              placeholder={["开始日期", "结束日期"]}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateLog}>
              写日记
            </Button>
          </Flex>
          <List
            loading={logLoading}
            dataSource={filteredDailyLogs}
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

  const logFundName = positions.find((p) => p.fundCode === logFundCode)?.fundName ?? logFundCode;

  return (
    <>
      {contextHolder}
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>交易与持仓</Title>
        <TargetPositionCard
          value={targetTotalPosition}
          onEdit={() => setSettingsModalOpen(true)}
        />
        <Flex gap={8}>
          <Button icon={<ReloadOutlined />} loading={refreshing} onClick={handleRefresh}>
            刷新
          </Button>
          <SyncPositionsButton onDone={() => loadPositions()} />
          <Button icon={<FileAddOutlined />} onClick={openCreateSnapshot}>
            建仓快照
          </Button>
          <Button type="primary" icon={<ShoppingCartOutlined />} onClick={openTradeModal}>
            新建交易
          </Button>
        </Flex>
      </Flex>
      <Tabs items={tabItems} />

      <Modal
        title={tradeFundCode ? `${tradeType === "buy" ? "买入" : "卖出"} — ${tradeFundCode}` : "新建交易"}
        open={tradeModalOpen}
        onCancel={() => setTradeModalOpen(false)}
        footer={null}
        destroyOnHidden
        width={480}
      >
        <TransactionForm
          funds={funds}
          onSubmit={handleTradeSubmit}
          defaultFundCode={tradeFundCode || undefined}
          defaultType={tradeType}
          availableShares={
            tradeType === "sell" && tradeFundCode
              ? parseFloat(positions.find((p) => p.fundCode === tradeFundCode)?.shares ?? "0")
              : undefined
          }
          positions={positions}
        />
      </Modal>

      <TransactionLogDrawer
        fundCode={logFundCode || null}
        fundName={logFundName}
        open={logDrawerOpen}
        onClose={() => setLogDrawerOpen(false)}
        onDelete={handleDeleteTransaction}
      />

      <TotalProfitDrawer
        open={totalProfitOpen}
        onClose={() => setTotalProfitOpen(false)}
        data={positions}
        onViewFundDetail={handleTotalViewFundDetail}
      />

      <FundProfitDrawer
        fundCode={fundProfitCode || null}
        fundName={fundProfitName}
        open={fundProfitOpen}
        onClose={() => setFundProfitOpen(false)}
      />

      <PositionSnapshotModal
        open={snapshotModalOpen}
        funds={funds}
        defaultFundCode={snapshotEditing?.fundCode}
        defaultCurrentValue={snapshotEditing?.currentValue}
        defaultPnlAmount={
          snapshotEditing
            ? String(parseFloat(snapshotEditing.currentValue) - parseFloat(snapshotEditing.costAmount))
            : undefined
        }
        submitting={snapshotSubmitting}
        onSubmit={handleSnapshotSubmit}
        onCancel={() => {
          setSnapshotModalOpen(false);
          setSnapshotEditing(null);
        }}
      />

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

      <SettingsModal
        open={settingsModalOpen}
        submitting={settingsSubmitting}
        initialValue={parseFloat(targetTotalPosition)}
        onSubmit={handleSettingsSave}
        onCancel={() => setSettingsModalOpen(false)}
      />
    </>
  );
}
