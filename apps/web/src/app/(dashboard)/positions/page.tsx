"use client";
import { useState, useEffect, useCallback } from "react";
import { Tabs, Typography, Flex, Button, Popconfirm, message, Form, Input, DatePicker, List, Card, Modal } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ShoppingCartOutlined, FileAddOutlined } from "@ant-design/icons";
import type { PositionListItem, FundListItem, CreateTransactionDto, DailyLog, CreateDailyLogDto, UpsertPositionDto } from "@g-fund/types";
import { positionsApi, transactionsApi, fundsApi, dailyLogsApi, settingsApi } from "@/lib/api-client";
import PositionTable from "@/components/PositionTable";
import TransactionForm from "@/components/TransactionForm";
import TransactionLogDrawer from "@/components/TransactionLogDrawer";
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

  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [snapshotEditing, setSnapshotEditing] = useState<PositionListItem | null>(null);
  const [snapshotSubmitting, setSnapshotSubmitting] = useState(false);

  const [targetTotalPosition, setTargetTotalPosition] = useState<string>("0");
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);

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

  const tabItems = [
    {
      key: "positions",
      label: `当前持仓（${positions.length}）`,
      children: (
        <PositionTable
          data={positions}
          loading={loading}
          onBuy={handleRowBuy}
          onSell={handleRowSell}
          onViewLog={handleViewLog}
          onEditSnapshot={openEditSnapshot}
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
